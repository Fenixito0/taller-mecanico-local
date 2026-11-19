<?php
// Consultas de órdenes, ventas y reportes compartidas por la API y la exportación a Excel.

/** Error de negocio cuyo mensaje se puede mostrar al usuario (el código es el estado HTTP). */
final class ErrorNegocio extends RuntimeException
{
}

const ETAPAS = ['recibido', 'reparacion', 'listo'];
const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'];
const MAX_CANTIDAD = 999;

require_once __DIR__ . '/cobro.php';
require_once __DIR__ . '/piezas.php';
require_once __DIR__ . '/cotizaciones.php';
require_once __DIR__ . '/catalogo.php';

/** Datos del taller (nombre, dirección...) con valores por defecto. */
function config_taller(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $cfg = [
        'nombre_taller'  => 'Taller Mecánico',
        'eslogan'        => 'Sistema de gestión',
        'direccion'      => '',
        'telefono'       => '',
        'rfc'            => '',
        'mensaje_recibo' => 'Gracias por su preferencia',
    ];
    try {
        foreach (db_all('SELECT clave, valor FROM configuracion') as $r) {
            if (array_key_exists($r['clave'], $cfg)) {
                $cfg[$r['clave']] = (string) $r['valor'];
            }
        }
    } catch (Throwable $e) {
        log_error('config_taller', $e); // tabla aún no migrada: se usan los valores por defecto
    }
    try {
        $cfg['aseguradoras'] = aseguradoras();
    } catch (Throwable $e) {
        $cfg['aseguradoras'] = [];
        log_error('config_taller aseguradoras', $e);
    }
    return $cfg;
}

/** Kilometraje opcional y razonable (0 a 2,000,000). */
function km_or_null(array $body): ?int
{
    $v = $body['kilometraje'] ?? null;
    if ($v === null || $v === '') {
        return null;
    }
    if (!is_numeric($v) || (int) $v < 0 || (int) $v > 2000000) {
        throw new ErrorNegocio('Kilometraje inválido', 400);
    }
    return (int) $v;
}

/**
 * Suma de anticipos de varias órdenes (descontando devoluciones).
 * @param int[] $ids
 * @return array<int,float>
 */
function anticipos_por_orden(array $ids): array
{
    if (!$ids) {
        return [];
    }
    $marcas = implode(',', array_fill(0, count($ids), '?'));
    $rows = db_all(
        "SELECT id_orden, SUM(monto) AS total FROM pago WHERE tipo IN ('anticipo','devolucion') AND id_orden IN ($marcas) GROUP BY id_orden",
        array_map('intval', $ids)
    );
    $map = [];
    foreach ($rows as $r) {
        $map[(int) $r['id_orden']] = round((float) $r['total'], 2);
    }
    return $map;
}

/** Pagos (anticipos, liquidación, devoluciones) de una orden. */
function pagos_de_orden(int $idOrden): array
{
    return array_map(static fn (array $p): array => [
        'id_pago' => (int) $p['id_pago'],
        'tipo'    => $p['tipo'],
        'monto'   => (float) $p['monto'],
        'metodo'  => $p['metodo'],
        'fecha'   => iso_utc($p['fecha']),
        'usuario' => $p['username'],
    ], db_all(
        'SELECT p.*, u.username FROM pago p LEFT JOIN usuario u ON u.id_usuario = p.id_usuario WHERE p.id_orden = ? ORDER BY p.fecha',
        [$idOrden]
    ));
}

function nombre_completo(array $c): string
{
    return trim(implode(' ', array_filter([$c['nombre'] ?? null, $c['apellido_paterno'] ?? null, $c['apellido_materno'] ?? null])));
}

const SQL_ORDEN_BASE = "SELECT o.*,
        c.rfc, c.nombre, c.apellido_paterno, c.apellido_materno, c.telefono, c.correo,
        v.marca, v.modelo, v.anio, v.color, v.placas,
        u.nombre AS usuario_nombre, u.username AS usuario_username,
        vt.id_venta, vt.subtotal AS v_subtotal, vt.mano_obra AS v_mano_obra, vt.iva AS v_iva,
        vt.piezas AS v_piezas, vt.extras AS v_extras, vt.deducible AS v_deducible,
        vt.precio_total AS v_total, vt.descuento AS v_descuento, vt.anticipo AS v_anticipo, vt.metodo_pago AS v_metodo, vt.estado_pago AS v_estado, vt.fecha_venta AS v_fecha
    FROM ordenservicio o
    JOIN cliente c  ON c.rfc = o.rfc_cliente
    JOIN vehiculo v ON v.id_vehiculo = o.id_vehiculo
    LEFT JOIN usuario u ON u.id_usuario = o.id_usuario
    LEFT JOIN venta vt  ON vt.id_orden = o.id_orden";

/** Campos del tipo de orden y del seguro. */
function datos_seguro(array $o): array
{
    return [
        'tipo'          => $o['tipo'] ?? 'particular',
        'aseguradora'   => $o['aseguradora'] ?? null,
        'num_siniestro' => $o['num_siniestro'] ?? null,
        'deducible'     => (float) ($o['deducible'] ?? 0),
    ];
}

/** Lista de órdenes para la pantalla de órdenes. */
function listar_ordenes(): array
{
    $rows = db_all(SQL_ORDEN_BASE . ' ORDER BY o.fecha_creacion DESC');
    $ids = array_column($rows, 'id_orden');
    $piezas = piezas_por_orden($ids);
    $cargos = cargos_por_orden($ids);
    $anticipos = anticipos_por_orden($ids);
    return array_map(static fn (array $o): array => [
        'id_orden'       => (int) $o['id_orden'],
        'fecha_creacion' => iso_utc($o['fecha_creacion']),
        'estado'         => $o['estado'],
        'observaciones'  => $o['observaciones'],
        'etapa'          => $o['etapa'],
        'kilometraje'    => $o['kilometraje'] !== null ? (int) $o['kilometraje'] : null,
        'anticipo'       => $anticipos[(int) $o['id_orden']] ?? 0.0,
        'total_venta'    => $o['v_total'] !== null ? (float) $o['v_total'] : null,
        'rfc'            => $o['rfc_cliente'],
        'telefono'       => $o['telefono'],
        'cliente'        => nombre_completo($o),
        'placas'         => $o['placas'],
        'vehiculo'       => trim(($o['marca'] ?? '') . " {$o['modelo']} {$o['anio']}"),
        'piezas'         => $piezas[(int) $o['id_orden']] ?? [],
        'cargos'         => $cargos[(int) $o['id_orden']] ?? [],
    ] + datos_seguro($o), $rows);
}

/** Orden con todos sus datos relacionados, o null si no existe. */
function obtener_orden(int $id): ?array
{
    $o = db_one(SQL_ORDEN_BASE . ' WHERE o.id_orden = ?', [$id]);
    if ($o === null) {
        return null;
    }
    $venta = $o['id_venta'] === null ? null : [
        'id_venta'     => (int) $o['id_venta'],
        'subtotal'     => (float) $o['v_subtotal'],
        'piezas'       => (float) $o['v_piezas'],
        'mano_obra'    => (float) $o['v_mano_obra'],
        'extras'       => (float) $o['v_extras'],
        'deducible'    => (float) $o['v_deducible'],
        'iva'          => (float) $o['v_iva'],
        'precio_total' => (float) $o['v_total'],
        'descuento'    => (float) $o['v_descuento'],
        'anticipo'     => (float) $o['v_anticipo'],
        'metodo_pago'  => $o['v_metodo'],
        'estado_pago'  => $o['v_estado'],
        'fecha_venta'  => $o['v_fecha'],
    ];
    return [
        'id_orden'       => (int) $o['id_orden'],
        'estado'         => $o['estado'],
        'etapa'          => $o['etapa'],
        'kilometraje'    => $o['kilometraje'] !== null ? (int) $o['kilometraje'] : null,
        'anticipo'       => anticipos_por_orden([$id])[$id] ?? 0.0,
        'fecha_creacion' => $o['fecha_creacion'],
        'observaciones'  => $o['observaciones'],
        'usuario'        => $o['usuario_username'] !== null ? ($o['usuario_nombre'] ?: $o['usuario_username']) : null,
        'cliente'        => [
            'rfc'              => $o['rfc'],
            'nombre'           => $o['nombre'],
            'apellido_paterno' => $o['apellido_paterno'],
            'apellido_materno' => $o['apellido_materno'],
            'telefono'         => $o['telefono'],
            'correo'           => $o['correo'],
        ],
        'vehiculo'       => [
            'marca'  => $o['marca'],
            'modelo' => $o['modelo'],
            'anio'   => (int) $o['anio'],
            'color'  => $o['color'],
            'placas' => $o['placas'],
        ],
        'piezas'         => piezas_por_orden([$id])[$id] ?? [],
        'cargos'         => cargos_por_orden([$id])[$id] ?? [],
        'venta'          => $venta,
    ] + datos_seguro($o);
}

/** Datos del reporte de órdenes en un rango (fechas locales). */
function reporte_ordenes(DateTimeImmutable $desde, DateTimeImmutable $hasta): array
{
    $rows = db_all(
        SQL_ORDEN_BASE . ' WHERE o.fecha_creacion BETWEEN ? AND ? ORDER BY o.fecha_creacion DESC',
        [to_utc_sql($desde), to_utc_sql($hasta)]
    );
    $detalles = piezas_por_orden(array_column($rows, 'id_orden'));

    $lista = array_map(static function (array $o) use ($detalles): array {
        $piezas = array_values(array_filter($detalles[(int) $o['id_orden']] ?? [], static fn (array $p): bool => $p['estado'] !== 'devuelta'));
        return [
            'id_orden'        => (int) $o['id_orden'],
            'fecha'           => iso_utc($o['fecha_creacion']),
            'fecha_raw'       => $o['fecha_creacion'],
            'estado'          => $o['estado'],
            'cliente'         => "{$o['nombre']} {$o['apellido_paterno']}",
            'rfc'             => $o['rfc'],
            'vehiculo'        => trim(($o['marca'] ?? '') . " {$o['modelo']}"),
            'placas'          => $o['placas'],
            'tipo'            => $o['tipo'],
            'aseguradora'     => $o['aseguradora'],
            'num_piezas'      => count($piezas),
            'piezas_pendientes' => count(array_filter($piezas, static fn (array $p): bool => $p['estado'] !== 'instalada')),
            'total_venta'     => $o['v_total'] !== null ? (float) $o['v_total'] : null,
        ];
    }, $rows);

    $contar = static fn (string $estado): int => count(array_filter($lista, static fn ($o) => $o['estado'] === $estado));
    return [
        'desde'   => $desde->format(DATE_ATOM),
        'hasta'   => $hasta->format(DATE_ATOM),
        'resumen' => [
            'total'       => count($lista),
            'pendientes'  => $contar('pendiente'),
            'completadas' => $contar('completado'),
            'canceladas'  => $contar('cancelado'),
        ],
        'ordenes' => $lista,
    ];
}

/** Datos del reporte de ingresos (ventas pagadas) en un rango (fechas locales). */
function reporte_ventas(DateTimeImmutable $desde, DateTimeImmutable $hasta, int $topLimite = 10): array
{
    $rows = db_all(
        "SELECT vt.*, c.nombre, c.apellido_paterno, v.marca, v.modelo, o.tipo, o.aseguradora
         FROM venta vt
         JOIN cliente c ON c.rfc = vt.rfc_cliente
         JOIN ordenservicio o ON o.id_orden = vt.id_orden
         JOIN vehiculo v ON v.id_vehiculo = o.id_vehiculo
         WHERE vt.fecha_venta BETWEEN ? AND ? AND vt.estado_pago = 'pagado'
         ORDER BY vt.fecha_venta DESC",
        [to_utc_sql($desde), to_utc_sql($hasta)]
    );
    $detalles = piezas_por_orden(array_column($rows, 'id_orden'));

    $porMetodo = ['efectivo' => 0.0, 'tarjeta' => 0.0, 'transferencia' => 0.0];
    $conteoMetodo = ['efectivo' => 0, 'tarjeta' => 0, 'transferencia' => 0];
    $refMap = [];
    $totales = ['piezas' => 0.0, 'mano_obra' => 0.0, 'extras' => 0.0, 'deducible' => 0.0, 'iva' => 0.0, 'total' => 0.0];
    $lista = [];

    foreach ($rows as $v) {
        $total = (float) $v['precio_total'];
        $porMetodo[$v['metodo_pago']] += $total;
        $conteoMetodo[$v['metodo_pago']]++;
        foreach (['piezas', 'mano_obra', 'extras', 'deducible'] as $campo) {
            $totales[$campo] += (float) $v[$campo];
        }
        $totales['iva'] += (float) $v['iva'];
        $totales['total'] += $total;

        foreach ($detalles[(int) $v['id_orden']] ?? [] as $d) {
            if ($d['estado'] === 'devuelta') {
                continue;
            }
            $k = mb_strtolower($d['nombre']);
            $refMap[$k] ??= ['nombre' => $d['nombre'], 'cantidad' => 0, 'ingreso' => 0.0];
            $refMap[$k]['cantidad'] += $d['cantidad'];
            $refMap[$k]['ingreso'] += importe_piezas_cobrables([$d]);
        }

        $lista[] = [
            'id_venta'    => (int) $v['id_venta'],
            'id_orden'    => (int) $v['id_orden'],
            'fecha'       => iso_utc($v['fecha_venta']),
            'fecha_raw'   => $v['fecha_venta'],
            'cliente'     => "{$v['nombre']} {$v['apellido_paterno']}",
            'vehiculo'    => trim(($v['marca'] ?? '') . " {$v['modelo']}"),
            'metodo_pago' => $v['metodo_pago'],
            'tipo'        => $v['tipo'],
            'aseguradora' => $v['aseguradora'],
            'piezas'      => (float) $v['piezas'],
            'mano_obra'   => (float) $v['mano_obra'],
            'extras'      => (float) $v['extras'],
            'deducible'   => (float) $v['deducible'],
            'iva'         => (float) $v['iva'],
            'total'       => $total,
        ];
    }

    $top = array_values($refMap);
    usort($top, static fn ($a, $b) => $b['cantidad'] <=> $a['cantidad']);
    if ($topLimite > 0) {
        $top = array_slice($top, 0, $topLimite);
    }

    $n = count($lista);
    return [
        'desde'   => $desde->format(DATE_ATOM),
        'hasta'   => $hasta->format(DATE_ATOM),
        'resumen' => [
            'total_ventas'    => $n,
            'total_ingresos'  => $totales['total'],
            'total_piezas'     => round($totales['piezas'], 2),
            'total_mano_obra'  => round($totales['mano_obra'], 2),
            'total_extras'     => round($totales['extras'], 2),
            'total_deducibles' => round($totales['deducible'], 2),
            'total_iva'       => $totales['iva'],
            'promedio_ticket' => $n > 0 ? $totales['total'] / $n : 0,
            'por_metodo'      => $porMetodo,
            'conteo_metodo'   => $conteoMetodo,
        ],
        'top_piezas'      => $top,
        'ventas'          => $lista,
    ];
}

/** Últimas órdenes de un cliente (para el historial en Generar Orden). */
function historial_cliente(string $rfc, int $limite = 8): array
{
    $rows = db_all(SQL_ORDEN_BASE . ' WHERE o.rfc_cliente = ? ORDER BY o.fecha_creacion DESC LIMIT ' . max(1, min(50, $limite)), [$rfc]);
    $detalles = piezas_por_orden(array_column($rows, 'id_orden'));
    return array_map(static fn (array $o): array => [
        'id_orden'    => (int) $o['id_orden'],
        'fecha'       => iso_utc($o['fecha_creacion']),
        'estado'      => $o['estado'],
        'id_vehiculo' => (int) $o['id_vehiculo'],
        'vehiculo'    => trim(($o['marca'] ?? '') . " {$o['modelo']}"),
        'placas'      => $o['placas'],
        'kilometraje' => $o['kilometraje'] !== null ? (int) $o['kilometraje'] : null,
        'total'       => $o['v_total'] !== null ? (float) $o['v_total'] : null,
        'refacciones' => array_map(
            static fn (array $r): string => $r['cantidad'] > 1 ? "{$r['nombre']} ×{$r['cantidad']}" : $r['nombre'],
            $detalles[(int) $o['id_orden']] ?? []
        ),
    ], $rows);
}
