<?php
// GET  api/ventas.php?orden=N  → venta (recibo) de una orden, con datos del taller
// POST api/ventas.php          → cobrar una orden pendiente
//      {id_orden, aplica_iva, metodo_pago, descuento_tipo: monto|porcentaje, descuento_valor}
// Los importes salen de la orden: piezas cobrables, mano de obra, extras y deducible (ver includes/cobro.php).

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/repositorio.php';
$user = require_api_auth();

$metodo = request_method();

try {
    if ($metodo === 'GET') {
        $idOrden = (int) ($_GET['orden'] ?? 0);
        $o = $idOrden > 0 ? obtener_orden($idOrden) : null;
        if ($o === null || $o['venta'] === null) {
            json_error('Venta no encontrada', 404);
        }
        $v = $o['venta'];
        json_out([
            'id_venta'      => $v['id_venta'],
            'id_orden'      => $o['id_orden'],
            'fecha_venta'   => iso_utc($v['fecha_venta']),
            'subtotal'      => $v['subtotal'],
            'importe_piezas' => $v['piezas'],
            'mano_obra'     => $v['mano_obra'],
            'extras'        => $v['extras'],
            'deducible'     => $v['deducible'],
            'descuento'     => $v['descuento'],
            'iva'           => $v['iva'],
            'precio_total'  => $v['precio_total'],
            'anticipo'      => $v['anticipo'],
            'metodo_pago'   => $v['metodo_pago'],
            'estado_pago'   => $v['estado_pago'],
            'kilometraje'   => $o['kilometraje'],
            'tipo'          => $o['tipo'],
            'aseguradora'   => $o['aseguradora'],
            'num_siniestro' => $o['num_siniestro'],
            'cliente'       => $o['cliente'],
            'vehiculo'      => $o['vehiculo'],
            'piezas'        => array_values(array_filter($o['piezas'], static fn (array $p): bool => $p['estado'] !== 'devuelta')),
            'cargos'        => $o['cargos'],
            'taller'        => config_taller(),
        ]);
    }

    if ($metodo === 'POST') {
        $body = read_json_body();
        $idOrden = (int) ($body['id_orden'] ?? 0);
        $aplicaIva = (bool) ($body['aplica_iva'] ?? true);
        $metodoPago = in_array($body['metodo_pago'] ?? '', METODOS_PAGO, true) ? $body['metodo_pago'] : 'efectivo';
        $descTipo = ($body['descuento_tipo'] ?? 'monto') === 'porcentaje' ? 'porcentaje' : 'monto';
        $descValor = (float) ($body['descuento_valor'] ?? 0);

        if ($idOrden <= 0) {
            json_error('Datos incompletos para registrar la venta', 400);
        }
        $orden = obtener_orden($idOrden);
        if ($orden === null) {
            json_error('Orden no encontrada', 404);
        }
        if ($orden['estado'] !== 'pendiente' || $orden['venta'] !== null) {
            json_error('Esta orden ya no se puede cobrar', 409);
        }
        $faltan = piezas_bloqueantes($idOrden);
        if ($faltan) {
            json_error('Faltan piezas por instalar: ' . implode(', ', array_column($faltan, 'nombre')), 409);
        }

        $anticipo = (float) $orden['anticipo'];
        $k = calcular_cobro($orden['tipo'], $orden['piezas'], $orden['cargos'], $orden['deducible'], $descTipo, $descValor, $aplicaIva, $anticipo);

        $idVenta = db_transaction(static function (PDO $pdo) use ($idOrden, $orden, $k, $anticipo, $metodoPago, $user): int {
            $st = $pdo->prepare("UPDATE ordenservicio SET estado = 'completado', etapa = 'listo' WHERE id_orden = ? AND estado = 'pendiente'");
            $st->execute([$idOrden]);
            if ($st->rowCount() === 0) {
                throw new ErrorNegocio('La orden cambió de estado. Recarga la página.', 409);
            }
            // Revisión dentro de la transacción por si alguien cambió una pieza mientras tanto
            $st = $pdo->prepare("SELECT COUNT(*) FROM orden_pieza WHERE id_orden = ? AND estado IN ('pendiente','recibida')");
            $st->execute([$idOrden]);
            if ((int) $st->fetchColumn() > 0) {
                throw new ErrorNegocio('Faltan piezas por instalar. Recarga la página.', 409);
            }
            $ahora = now_utc();
            // subtotal = importe de piezas cobradas (mismo significado que en ventas anteriores)
            $pdo->prepare("INSERT INTO venta (id_orden, rfc_cliente, subtotal, piezas, mano_obra, extras, deducible, descuento, iva, precio_total, anticipo, metodo_pago, estado_pago, fecha_venta)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pagado', ?)")
                ->execute([$idOrden, $orden['cliente']['rfc'], $k['piezas'], $k['piezas'], $k['mano_obra'], $k['extras'], $k['deducible'],
                    $k['descuento'], $k['iva'], $k['total'], $anticipo, $metodoPago, $ahora]);
            $idVenta = (int) $pdo->lastInsertId();
            if ($k['restante'] > 0) {
                $pdo->prepare("INSERT INTO pago (id_orden, tipo, monto, metodo, fecha, id_usuario) VALUES (?, 'liquidacion', ?, ?, ?, ?)")
                    ->execute([$idOrden, $k['restante'], $metodoPago, $ahora, $user['id']]);
            }
            return $idVenta;
        });

        registrar_auditoria(sprintf('Cobró orden #%d por $%.2f (%s)', $idOrden, $k['total'], $metodoPago), 'ventas');
        json_out(['id_venta' => $idVenta, 'precio_total' => $k['total'], 'cobrado_ahora' => $k['restante']], 201);
    }

    json_error('Método no permitido', 405);
} catch (ErrorNegocio $e) {
    json_error($e->getMessage(), $e->getCode() ?: 400);
} catch (Throwable $e) {
    log_error('API ventas', $e);
    json_error('Error al registrar la venta', 500);
}
