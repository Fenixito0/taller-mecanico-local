<?php
// GET api/reportes.php?tipo=ordenes|ventas&desde=YYYY-MM-DD&hasta=YYYY-MM-DD

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/repositorio.php';
require_api_admin(); // reportes de ingresos: solo administradores

if (request_method() !== 'GET') {
    json_error('Método no permitido', 405);
}

try {
    [$desde, $hasta] = rango_fechas($_GET['desde'] ?? null, $_GET['hasta'] ?? null);
    $tipo = $_GET['tipo'] ?? 'ordenes';
    $data = $tipo === 'ventas' ? reporte_ventas($desde, $hasta) : reporte_ordenes($desde, $hasta);

    // Campos internos que el navegador no necesita
    $lista = $tipo === 'ventas' ? 'ventas' : 'ordenes';
    $data[$lista] = array_map(static function (array $r): array {
        unset($r['fecha_raw']);
        return $r;
    }, $data[$lista]);

    json_out($data);
} catch (Throwable $e) {
    log_error('API reportes', $e);
    json_error('Error al generar reporte', 500);
}
