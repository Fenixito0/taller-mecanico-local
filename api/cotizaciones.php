<?php
// GET    api/cotizaciones.php                        → lista
// GET    api/cotizaciones.php?id=N                   → detalle (incluye datos del taller para imprimir)
// POST   api/cotizaciones.php                        → crear {conceptos:[{tipo,concepto,lado,cantidad,precio_unitario}]}
// POST   api/cotizaciones.php?id=N&accion=convertir  → convertir en orden particular
// DELETE api/cotizaciones.php?id=N                   → eliminar

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/repositorio.php';
$user = require_api_auth();

$metodo = request_method();
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

const SQL_COT = "SELECT k.*, c.nombre, c.apellido_paterno, c.apellido_materno, c.telefono, c.correo,
        v.marca, v.modelo, v.anio, v.color, v.placas, u.username
    FROM cotizacion k
    JOIN cliente c ON c.rfc = k.rfc_cliente
    JOIN vehiculo v ON v.id_vehiculo = k.id_vehiculo
    LEFT JOIN usuario u ON u.id_usuario = k.id_usuario";

function cotizacion_json(array $k, array $conceptos): array
{
    return [
        'id_cotizacion' => (int) $k['id_cotizacion'],
        'fecha'         => iso_utc($k['fecha']),
        'estado'        => $k['estado'],
        'id_orden'      => $k['id_orden'] !== null ? (int) $k['id_orden'] : null,
        'observaciones' => $k['observaciones'],
        'kilometraje'   => $k['kilometraje'] !== null ? (int) $k['kilometraje'] : null,
        'usuario'       => $k['username'],
        'rfc'           => $k['rfc_cliente'],
        'cliente'       => nombre_completo($k),
        'telefono'      => $k['telefono'],
        'correo'        => $k['correo'],
        'id_vehiculo'   => (int) $k['id_vehiculo'],
        'vehiculo'      => trim(($k['marca'] ?? '') . " {$k['modelo']} {$k['anio']}"),
        'placas'        => $k['placas'],
        'color'         => $k['color'],
        'conceptos'     => $conceptos,
        'total'         => total_conceptos($conceptos),
    ];
}

try {
    if ($metodo === 'GET' && $id > 0) {
        $k = db_one(SQL_COT . ' WHERE k.id_cotizacion = ?', [$id]);
        if ($k === null) {
            json_error('Cotización no encontrada', 404);
        }
        json_out(cotizacion_json($k, conceptos_por_cotizacion([$id])[$id] ?? []) + ['taller' => config_taller()]);
    }

    if ($metodo === 'GET') {
        $rows = db_all(SQL_COT . ' ORDER BY k.fecha DESC LIMIT 500');
        $det = conceptos_por_cotizacion(array_column($rows, 'id_cotizacion'));
        json_out(array_map(static fn (array $k): array => cotizacion_json($k, $det[(int) $k['id_cotizacion']] ?? []), $rows));
    }

    if ($metodo === 'POST' && $id > 0 && ($_GET['accion'] ?? '') === 'convertir') {
        $idOrden = db_transaction(static fn (PDO $pdo): int => convertir_cotizacion($pdo, $id, $user['id']));
        registrar_auditoria("Convirtió cotización #{$id} en orden #{$idOrden}", 'cotizaciones');
        json_out(['id_orden' => $idOrden], 201);
    }

    if ($metodo === 'POST') {
        $body = read_json_body();
        $idVehiculo = (int) ($body['id_vehiculo'] ?? 0);
        $rfc = str_or_null($body, 'rfc_cliente');
        $obs = str_or_null($body, 'observaciones');
        $km = km_or_null($body);
        $conceptos = array_map('normalizar_concepto', array_values(array_filter(is_array($body['conceptos'] ?? null) ? $body['conceptos'] : [], 'is_array')));
        if ($idVehiculo <= 0 || $rfc === null || !$conceptos) {
            json_error('Vehículo, cliente y al menos un concepto son requeridos', 400);
        }
        if (!db_one('SELECT 1 FROM vehiculocliente WHERE id_vehiculo = ? AND rfc_cliente = ?', [$idVehiculo, $rfc])) {
            json_error('El vehículo no pertenece al cliente seleccionado', 400);
        }
        $nuevo = db_transaction(static fn (PDO $pdo): int => crear_cotizacion($pdo, $idVehiculo, $rfc, $obs, $km, $conceptos, $user['id']));
        registrar_auditoria("Creó cotización #{$nuevo} para cliente RFC: {$rfc}", 'cotizaciones');
        json_out(['id_cotizacion' => $nuevo], 201);
    }

    if ($metodo === 'DELETE' && $id > 0) {
        require_api_admin();
        $n = db_query('DELETE FROM cotizacion WHERE id_cotizacion = ?', [$id])->rowCount();
        if ($n === 0) {
            json_error('Cotización no encontrada', 404);
        }
        registrar_auditoria("Eliminó cotización #{$id}", 'cotizaciones');
        json_out(['ok' => true]);
    }

    json_error('Método no permitido', 405);
} catch (ErrorNegocio $e) {
    json_error($e->getMessage(), $e->getCode() ?: 400);
} catch (Throwable $e) {
    log_error('API cotizaciones', $e);
    json_error('Error al procesar la cotización', 500);
}
