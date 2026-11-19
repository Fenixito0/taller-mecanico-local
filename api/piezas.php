<?php
// GET    api/piezas.php?estado=&aseguradora=      → tablero de piezas de órdenes pendientes
// GET    api/piezas.php?sugerir=texto             → nombres de piezas usados antes
// POST   api/piezas.php?orden=N                   → agregar pieza a una orden
// PATCH  api/piezas.php?id=N&accion=estado        → {estado: recibida|instalada|pendiente}
// PATCH  api/piezas.php?id=N&accion=precio        → {precio_unitario: número o null}
// PATCH  api/piezas.php?id=N&accion=devolver      → {motivo} marca devuelta y crea el reemplazo
// DELETE api/piezas.php?id=N                      → quitar pieza pendiente (solo admin)

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/repositorio.php';
$user = require_api_auth();

$metodo = request_method();
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
$idOrden = isset($_GET['orden']) ? (int) $_GET['orden'] : 0;
$accion = $_GET['accion'] ?? '';


/** Nombre y orden de una pieza para la bitácora. */
function pieza_para_bitacora(int $idPieza): string
{
    $p = db_one('SELECT nombre, id_orden FROM orden_pieza WHERE id_pieza = ?', [$idPieza]);
    return $p ? "\"{$p['nombre']}\" de la orden #{$p['id_orden']}" : "#{$idPieza}";
}

try {
    if ($metodo === 'GET' && isset($_GET['sugerir'])) {
        json_out(nombres_pieza((string) $_GET['sugerir']));
    }

    if ($metodo === 'GET') {
        $estado = isset($_GET['estado']) && $_GET['estado'] !== '' ? (string) $_GET['estado'] : null;
        $aseg = isset($_GET['aseguradora']) && $_GET['aseguradora'] !== '' ? (string) $_GET['aseguradora'] : null;
        json_out(tablero_piezas($estado, $aseg));
    }

    if ($metodo === 'POST' && $idOrden > 0) {
        $orden = db_one('SELECT tipo FROM ordenservicio WHERE id_orden = ?', [$idOrden]);
        if ($orden === null) {
            json_error('Orden no encontrada', 404);
        }
        $pieza = normalizar_pieza(read_json_body(), $orden['tipo']);
        $nuevo = db_transaction(static fn (PDO $pdo): int => agregar_pieza($pdo, $idOrden, $pieza));
        registrar_auditoria("Agregó pieza \"{$pieza['nombre']}\" a la orden #{$idOrden}", 'ordenes');
        json_out(['id_pieza' => $nuevo], 201);
    }

    if ($metodo === 'PATCH' && $id > 0 && $accion === 'estado') {
        $estado = (string) (read_json_body()['estado'] ?? '');
        db_transaction(static fn (PDO $pdo) => cambiar_estado_pieza($pdo, $id, $estado));
        registrar_auditoria('Marcó pieza ' . pieza_para_bitacora($id) . " como {$estado}", 'ordenes');
        json_out(['ok' => true]);
    }

    if ($metodo === 'PATCH' && $id > 0 && $accion === 'precio') {
        $valor = read_json_body()['precio_unitario'] ?? null;
        if ($valor !== null && !is_numeric($valor)) {
            json_error('Precio inválido', 400);
        }
        $precio = $valor === null ? null : (float) $valor;
        db_transaction(static fn (PDO $pdo) => actualizar_precio_pieza($pdo, $id, $precio));
        registrar_auditoria('Cambió precio de pieza ' . pieza_para_bitacora($id) . ' a ' . ($precio === null ? 'sin cargo' : sprintf('$%.2f', $precio)), 'ordenes');
        json_out(['ok' => true]);
    }

    if ($metodo === 'PATCH' && $id > 0 && $accion === 'devolver') {
        $motivo = (string) (read_json_body()['motivo'] ?? '');
        $reemplazo = db_transaction(static fn (PDO $pdo): int => devolver_pieza($pdo, $id, $motivo));
        registrar_auditoria('Devolvió pieza ' . pieza_para_bitacora($id) . ': ' . mb_substr(trim($motivo), 0, 60), 'ordenes');
        json_out(['ok' => true, 'id_reemplazo' => $reemplazo]);
    }

    if ($metodo === 'DELETE' && $id > 0) {
        require_api_admin();
        $desc = pieza_para_bitacora($id);
        db_transaction(static fn (PDO $pdo) => eliminar_pieza($pdo, $id));
        registrar_auditoria("Quitó pieza {$desc}", 'ordenes');
        json_out(['ok' => true]);
    }

    json_error('Método no permitido', 405);
} catch (ErrorNegocio $e) {
    json_error($e->getMessage(), $e->getCode() ?: 400);
} catch (Throwable $e) {
    log_error('API piezas', $e);
    json_error('Error al procesar la pieza', 500);
}
