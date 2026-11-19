<?php
// GET    api/pagos.php?orden=N   → pagos de una orden
// POST   api/pagos.php           → registrar anticipo {id_orden, monto, metodo}
// DELETE api/pagos.php?id=N      → eliminar un anticipo (solo administradores)

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/repositorio.php';
$user = require_api_auth();

$metodo = request_method();

try {
    if ($metodo === 'GET') {
        $idOrden = (int) ($_GET['orden'] ?? 0);
        json_out($idOrden > 0 ? pagos_de_orden($idOrden) : []);
    }

    if ($metodo === 'POST') {
        $body = read_json_body();
        $idOrden = (int) ($body['id_orden'] ?? 0);
        $monto = round((float) ($body['monto'] ?? 0), 2);
        $metodoPago = $body['metodo'] ?? '';
        if ($idOrden <= 0 || $monto <= 0 || $monto > 9999999 || !in_array($metodoPago, METODOS_PAGO, true)) {
            json_error('Indica un monto mayor a cero y el método de pago', 400);
        }
        $orden = db_one('SELECT estado FROM ordenservicio WHERE id_orden = ?', [$idOrden]);
        if ($orden === null) {
            json_error('Orden no encontrada', 404);
        }
        if ($orden['estado'] !== 'pendiente') {
            json_error('Solo se reciben anticipos de órdenes pendientes', 409);
        }
        db_query("INSERT INTO pago (id_orden, tipo, monto, metodo, fecha, id_usuario) VALUES (?, 'anticipo', ?, ?, ?, ?)",
            [$idOrden, $monto, $metodoPago, now_utc(), $user['id']]);
        registrar_auditoria(sprintf('Anticipo de $%.2f (%s) a orden #%d', $monto, $metodoPago, $idOrden), 'pagos');
        json_out(['ok' => true, 'anticipo_total' => anticipos_por_orden([$idOrden])[$idOrden] ?? 0.0], 201);
    }

    if ($metodo === 'DELETE') {
        require_api_admin();
        $id = (int) ($_GET['id'] ?? 0);
        $p = db_one("SELECT p.id_orden, p.monto, o.estado FROM pago p JOIN ordenservicio o ON o.id_orden = p.id_orden
                     WHERE p.id_pago = ? AND p.tipo = 'anticipo'", [$id]);
        if ($p === null) {
            json_error('Anticipo no encontrado', 404);
        }
        if ($p['estado'] !== 'pendiente') {
            json_error('Solo se pueden quitar anticipos de órdenes pendientes', 409);
        }
        db_query('DELETE FROM pago WHERE id_pago = ?', [$id]);
        registrar_auditoria(sprintf('Eliminó anticipo de $%.2f de orden #%d', $p['monto'], $p['id_orden']), 'pagos');
        json_out(['ok' => true]);
    }

    json_error('Método no permitido', 405);
} catch (Throwable $e) {
    log_error('API pagos', $e);
    json_error('Error al procesar el pago', 500);
}
