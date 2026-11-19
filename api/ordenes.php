<?php
// GET   api/ordenes.php                         → lista de órdenes
// GET   api/ordenes.php?id=N                    → detalle de una orden (incluye pagos)
// GET   api/ordenes.php?historial=RFC           → últimas órdenes de un cliente
// POST  api/ordenes.php                         → crear orden {tipo, aseguradora, num_siniestro, deducible, piezas[], cargos[], ...}
// PATCH api/ordenes.php?id=N&accion=datos       → editar tipo y datos del seguro
// PATCH api/ordenes.php?id=N&accion=etapa       → cambiar etapa {etapa}
// PATCH api/ordenes.php?id=N&accion=cancelar    → cancelar orden pendiente (devuelve anticipos)

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/repositorio.php';
$user = require_api_auth();

$metodo = request_method();
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
$accion = $_GET['accion'] ?? '';

const ETAPA_LABEL = ['recibido' => 'Recibido', 'reparacion' => 'En reparación', 'listo' => 'Listo para entregar'];

try {
    if ($metodo === 'GET' && $id > 0) {
        $o = obtener_orden($id);
        if ($o === null) {
            json_error('Orden no encontrada', 404);
        }
        $o['fecha_creacion'] = iso_utc($o['fecha_creacion']);
        $o['pagos'] = pagos_de_orden($id);
        unset($o['venta'], $o['usuario']);
        json_out($o);
    }

    if ($metodo === 'GET' && isset($_GET['historial'])) {
        json_out(historial_cliente((string) $_GET['historial']));
    }

    if ($metodo === 'GET') {
        json_out(listar_ordenes());
    }

    if ($metodo === 'POST') {
        $body = read_json_body();
        $idVehiculo = (int) ($body['id_vehiculo'] ?? 0);
        $rfc = str_or_null($body, 'rfc_cliente');
        $observaciones = str_or_null($body, 'observaciones');
        $km = km_or_null($body);
        if ($idVehiculo <= 0 || $rfc === null) {
            json_error('Vehículo y cliente son requeridos', 400);
        }
        if (!db_one('SELECT 1 FROM vehiculocliente WHERE id_vehiculo = ? AND rfc_cliente = ?', [$idVehiculo, $rfc])) {
            json_error('El vehículo no pertenece al cliente seleccionado', 400);
        }
        $seguro = normalizar_seguro($body, aseguradoras());
        $piezas = array_map(
            static fn ($p): array => normalizar_pieza(is_array($p) ? $p : [], $seguro['tipo']),
            is_array($body['piezas'] ?? null) ? $body['piezas'] : []
        );
        $cargos = array_map(
            static fn ($c): array => normalizar_cargo(is_array($c) ? $c : []),
            is_array($body['cargos'] ?? null) ? $body['cargos'] : []
        );

        $nuevoId = db_transaction(static fn (PDO $pdo): int =>
            crear_orden($pdo, $idVehiculo, $rfc, $observaciones, $km, $seguro, $piezas, $cargos, $user['id']));

        registrar_auditoria("Generó orden #{$nuevoId} para cliente RFC: {$rfc}", 'ordenes');
        json_out(['id_orden' => $nuevoId], 201);
    }

    if ($metodo === 'PATCH' && $id > 0 && $accion === 'etapa') {
        $etapa = read_json_body()['etapa'] ?? '';
        if (!in_array($etapa, ETAPAS, true)) {
            json_error('Etapa inválida', 400);
        }
        $st = db_query("UPDATE ordenservicio SET etapa = ? WHERE id_orden = ? AND estado = 'pendiente'", [$etapa, $id]);
        if ($st->rowCount() === 0 && !db_one("SELECT 1 FROM ordenservicio WHERE id_orden = ? AND estado = 'pendiente'", [$id])) {
            json_error('Solo se puede cambiar la etapa de órdenes pendientes', 409);
        }
        registrar_auditoria("Orden #{$id}: etapa \"" . ETAPA_LABEL[$etapa] . '"', 'ordenes');
        json_out(['ok' => true, 'etapa' => $etapa]);
    }

    if ($metodo === 'PATCH' && $id > 0 && $accion === 'datos') {
        $seguro = normalizar_seguro(read_json_body(), aseguradoras());
        db_transaction(static fn (PDO $pdo) => actualizar_seguro($pdo, $id, $seguro));
        registrar_auditoria("Orden #{$id}: datos " . ($seguro['tipo'] === 'seguro'
            ? sprintf('de seguro (%s, deducible $%.2f)', $seguro['aseguradora'], $seguro['deducible'])
            : 'cambiados a particular'), 'ordenes');
        json_out(['ok' => true]);
    }

    if ($metodo === 'PATCH' && $id > 0 && $accion === 'cancelar') {
        $devuelto = db_transaction(static function (PDO $pdo) use ($id, $user): float {
            $st = $pdo->prepare('SELECT estado FROM ordenservicio WHERE id_orden = ? FOR UPDATE');
            $st->execute([$id]);
            $orden = $st->fetch();
            if (!$orden) {
                throw new ErrorNegocio('Orden no encontrada', 404);
            }
            if ($orden['estado'] !== 'pendiente') {
                throw new ErrorNegocio('Solo se pueden cancelar órdenes pendientes', 409);
            }
            $pdo->prepare("UPDATE ordenservicio SET estado = 'cancelado' WHERE id_orden = ?")->execute([$id]);

            // Anticipos recibidos: se registra la devolución por método para que el corte de caja cuadre
            $st = $pdo->prepare("SELECT metodo, SUM(monto) AS total FROM pago
                                 WHERE id_orden = ? AND tipo IN ('anticipo','devolucion') GROUP BY metodo HAVING total > 0");
            $st->execute([$id]);
            $ins = $pdo->prepare("INSERT INTO pago (id_orden, tipo, monto, metodo, fecha, id_usuario) VALUES (?, 'devolucion', ?, ?, ?, ?)");
            $total = 0.0;
            foreach ($st->fetchAll() as $p) {
                $ins->execute([$id, -1 * (float) $p['total'], $p['metodo'], now_utc(), $user['id']]);
                $total += (float) $p['total'];
            }
            return round($total, 2);
        });
        registrar_auditoria("Canceló orden #{$id}" . ($devuelto > 0 ? sprintf(' (devolvió $%.2f)', $devuelto) : ''), 'ordenes');
        json_out(['ok' => true, 'devuelto' => $devuelto]);
    }

    json_error('Método no permitido', 405);
} catch (ErrorNegocio $e) {
    json_error($e->getMessage(), $e->getCode() ?: 400);
} catch (Throwable $e) {
    log_error('API órdenes', $e);
    json_error('Error al procesar la orden', 500);
}
