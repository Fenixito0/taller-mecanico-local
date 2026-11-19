<?php
/**
 * Cotizaciones con conceptos libres (siempre particulares).
 * Conceptos: pieza (se convierte en pieza de la orden), mano_obra y extra (se convierten en cargos).
 */

declare(strict_types=1);

const TIPOS_CONCEPTO = ['pieza', 'mano_obra', 'extra'];
/** Prefijo con el que el asistente marca piezas extra dentro de una cotización. */
const PREFIJO_EXTRA = 'EXTRA · ';

/** Valida un concepto recibido del navegador. */
function normalizar_concepto(array $in): array
{
    $tipo = $in['tipo'] ?? '';
    if (!in_array($tipo, TIPOS_CONCEPTO, true)) {
        throw new ErrorNegocio('Tipo de concepto inválido', 400);
    }
    $concepto = texto_requerido($in['concepto'] ?? null, 150, 'El concepto');
    $cantidad = (int) ($in['cantidad'] ?? 1);
    if ($cantidad < 1 || $cantidad > MAX_CANTIDAD) {
        throw new ErrorNegocio("Cantidad inválida en \"{$concepto}\"", 400);
    }
    $precio = monto_o_null($in['precio_unitario'] ?? null, 'Precio');
    if ($precio === null) {
        throw new ErrorNegocio("Indica el precio de \"{$concepto}\"", 400);
    }
    return [
        'tipo'            => $tipo,
        'concepto'        => $concepto,
        'lado'            => $tipo === 'pieza' ? lado_a_bd($in['lado'] ?? null) : 'N/A',
        'cantidad'        => $cantidad,
        'precio_unitario' => $precio,
    ];
}

function crear_cotizacion(PDO $pdo, int $idVehiculo, string $rfc, ?string $obs, ?int $km, array $conceptos, ?int $idUsuario): int
{
    if (!$conceptos) {
        throw new ErrorNegocio('Agrega al menos un concepto a la cotización', 400);
    }
    $pdo->prepare('INSERT INTO cotizacion (rfc_cliente, id_vehiculo, id_usuario, fecha, observaciones, kilometraje) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$rfc, $idVehiculo, $idUsuario, now_utc(), $obs, $km]);
    $cid = (int) $pdo->lastInsertId();
    $ins = $pdo->prepare('INSERT INTO cotizacion_concepto (id_cotizacion, tipo, concepto, lado, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($conceptos as $c) {
        $ins->execute([$cid, $c['tipo'], $c['concepto'], $c['lado'], $c['cantidad'], $c['precio_unitario']]);
    }
    return $cid;
}

/** @param int[] $ids @return array<int, list<array>> */
function conceptos_por_cotizacion(array $ids): array
{
    if (!$ids) {
        return [];
    }
    $marcas = implode(',', array_fill(0, count($ids), '?'));
    $map = [];
    foreach (db_all("SELECT * FROM cotizacion_concepto WHERE id_cotizacion IN ($marcas) ORDER BY id_concepto", array_map('intval', $ids)) as $c) {
        $map[(int) $c['id_cotizacion']][] = [
            'tipo'            => $c['tipo'],
            'concepto'        => $c['concepto'],
            'lado'            => lado_a_cliente($c['lado']),
            'cantidad'        => (int) $c['cantidad'],
            'precio_unitario' => (float) $c['precio_unitario'],
        ];
    }
    return $map;
}

/** Suma cantidad × precio (sin IVA). */
function total_conceptos(array $conceptos): float
{
    return round(array_sum(array_map(static fn (array $c): float => $c['cantidad'] * $c['precio_unitario'], $conceptos)), 2);
}

/** Crea una orden particular a partir de la cotización y la marca como convertida. Devuelve el id de la orden. */
function convertir_cotizacion(PDO $pdo, int $idCotizacion, ?int $idUsuario): int
{
    $st = $pdo->prepare('SELECT * FROM cotizacion WHERE id_cotizacion = ? FOR UPDATE');
    $st->execute([$idCotizacion]);
    $k = $st->fetch();
    if (!$k) {
        throw new ErrorNegocio('Cotización no encontrada', 404);
    }
    if ($k['estado'] !== 'abierta') {
        throw new ErrorNegocio('Esta cotización ya se convirtió en orden', 409);
    }
    $piezas = [];
    $cargos = [];
    foreach (conceptos_por_cotizacion([$idCotizacion])[$idCotizacion] ?? [] as $c) {
        if ($c['tipo'] === 'pieza') {
            $esExtra = str_starts_with($c['concepto'], PREFIJO_EXTRA);
            $nombre = $esExtra ? substr($c['concepto'], strlen(PREFIJO_EXTRA)) : $c['concepto'];
            $piezas[] = normalizar_pieza(['nombre' => mb_substr($nombre, 0, 100), 'lado' => $c['lado'], 'origen' => 'taller',
                'cantidad' => $c['cantidad'], 'precio_unitario' => $c['precio_unitario'], 'es_extra' => $esExtra], 'particular');
            continue;
        }
        $monto = round($c['cantidad'] * $c['precio_unitario'], 2);
        if ($monto > 0) { // un cargo de $0 no aporta nada a la orden
            $cargos[] = normalizar_cargo(['tipo' => $c['tipo'], 'concepto' => $c['concepto'], 'monto' => $monto]);
        }
    }
    $seguro = normalizar_seguro(['tipo' => 'particular'], aseguradoras());
    $oid = crear_orden($pdo, (int) $k['id_vehiculo'], $k['rfc_cliente'], $k['observaciones'],
        $k['kilometraje'] !== null ? (int) $k['kilometraje'] : null, $seguro, $piezas, $cargos, $idUsuario);
    $pdo->prepare("UPDATE cotizacion SET estado = 'convertida', id_orden = ? WHERE id_cotizacion = ?")->execute([$oid, $idCotizacion]);
    return $oid;
}
