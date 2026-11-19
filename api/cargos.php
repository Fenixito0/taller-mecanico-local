<?php
// POST   api/cargos.php?orden=N   → agregar cargo {tipo: mano_obra|extra, concepto, monto}
// DELETE api/cargos.php?id=N      → quitar cargo (solo admin)

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/repositorio.php';
$user = require_api_auth();

$metodo = request_method();
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
$idOrden = isset($_GET['orden']) ? (int) $_GET['orden'] : 0;

try {
    if ($metodo === 'POST' && $idOrden > 0) {
        $cargo = normalizar_cargo(read_json_body());
        $nuevo = db_transaction(static fn (PDO $pdo): int => agregar_cargo($pdo, $idOrden, $cargo));
        registrar_auditoria(sprintf('Agregó %s "%s" ($%.2f) a la orden #%d', $cargo['tipo'] === 'extra' ? 'extra' : 'mano de obra', $cargo['concepto'], $cargo['monto'], $idOrden), 'ordenes');
        json_out(['id_cargo' => $nuevo], 201);
    }

    if ($metodo === 'DELETE' && $id > 0) {
        require_api_admin();
        $c = db_one('SELECT concepto, id_orden FROM orden_cargo WHERE id_cargo = ?', [$id]);
        db_transaction(static fn (PDO $pdo) => eliminar_cargo($pdo, $id));
        registrar_auditoria("Quitó cargo \"" . ($c['concepto'] ?? '') . "\" de la orden #" . ($c['id_orden'] ?? '?'), 'ordenes');
        json_out(['ok' => true]);
    }

    json_error('Método no permitido', 405);
} catch (ErrorNegocio $e) {
    json_error($e->getMessage(), $e->getCode() ?: 400);
} catch (Throwable $e) {
    log_error('API cargos', $e);
    json_error('Error al procesar el cargo', 500);
}
