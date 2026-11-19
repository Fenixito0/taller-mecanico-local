<?php
// GET api/caja.php?fecha=YYYY-MM-DD → corte de caja del día (hora local)

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/repositorio.php';
require_api_auth();

try {
    $fecha = (string) ($_GET['fecha'] ?? '');
    if (!es_fecha_valida($fecha)) {
        $fecha = (new DateTimeImmutable('now'))->format('Y-m-d');
    }
    [$desde, $hasta] = rango_fechas($fecha, $fecha);

    $pagos = db_all(
        "SELECT p.*, u.username, c.nombre, c.apellido_paterno, v.placas
         FROM pago p
         JOIN ordenservicio o ON o.id_orden = p.id_orden
         JOIN cliente c ON c.rfc = o.rfc_cliente
         JOIN vehiculo v ON v.id_vehiculo = o.id_vehiculo
         LEFT JOIN usuario u ON u.id_usuario = p.id_usuario
         WHERE p.fecha BETWEEN ? AND ? ORDER BY p.fecha",
        [to_utc_sql($desde), to_utc_sql($hasta)]
    );

    $porMetodo = array_fill_keys(METODOS_PAGO, 0.0);
    $porTipo = ['anticipo' => 0.0, 'liquidacion' => 0.0, 'devolucion' => 0.0];
    $lista = [];
    foreach ($pagos as $p) {
        $m = (float) $p['monto'];
        $porMetodo[$p['metodo']] += $m;
        $porTipo[$p['tipo']] += $m;
        $lista[] = [
            'id_pago'  => (int) $p['id_pago'],
            'id_orden' => (int) $p['id_orden'],
            'tipo'     => $p['tipo'],
            'monto'    => $m,
            'metodo'   => $p['metodo'],
            'fecha'    => iso_utc($p['fecha']),
            'cliente'  => "{$p['nombre']} {$p['apellido_paterno']}",
            'placas'   => $p['placas'],
            'usuario'  => $p['username'],
        ];
    }
    $ventas = db_one('SELECT COUNT(*) AS n, COALESCE(SUM(descuento),0) AS desc_total FROM venta WHERE fecha_venta BETWEEN ? AND ?',
        [to_utc_sql($desde), to_utc_sql($hasta)]);

    json_out([
        'fecha'       => $fecha,
        'total'       => round(array_sum($porMetodo), 2),
        'por_metodo'  => array_map(static fn ($v) => round($v, 2), $porMetodo),
        'por_tipo'    => array_map(static fn ($v) => round($v, 2), $porTipo),
        'num_ventas'  => (int) $ventas['n'],
        'descuentos'  => round((float) $ventas['desc_total'], 2),
        'movimientos' => $lista,
        'taller'      => config_taller(),
    ]);
} catch (Throwable $e) {
    log_error('API caja', $e);
    json_error('Error al generar el corte de caja', 500);
}
