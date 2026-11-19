<?php
// GET    api/clientes.php              → lista
// POST   api/clientes.php              → crear
// PUT    api/clientes.php?rfc=XXX      → actualizar
// DELETE api/clientes.php?rfc=XXX      → eliminar

require __DIR__ . '/../includes/bootstrap.php';
require_api_auth();

$metodo = request_method();
$rfc = isset($_GET['rfc']) ? strtoupper(trim((string) $_GET['rfc'])) : null;

function cliente_json(array $c): array
{
    return [
        'rfc'              => $c['rfc'],
        'nombre'           => $c['nombre'],
        'apellido_paterno' => $c['apellido_paterno'],
        'apellido_materno' => $c['apellido_materno'],
        'telefono'         => $c['telefono'],
        'correo'           => $c['correo'],
        'fecha_registro'   => iso_utc($c['fecha_registro']),
    ];
}

/** Valida los datos del cliente; devuelve mensaje de error o null. */
function validar_cliente(array $d, bool $nuevo): ?string
{
    $letras = '/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]{1,50}$/u';
    if ($nuevo && !preg_match('/^[A-Z0-9Ñ&]{12,13}$/u', (string) $d['rfc'])) {
        return 'RFC inválido (12 a 13 caracteres alfanuméricos)';
    }
    if ($d['nombre'] === null || !preg_match($letras, $d['nombre'])) {
        return 'Nombre inválido';
    }
    if ($d['apellido_paterno'] === null || !preg_match($letras, $d['apellido_paterno'])) {
        return 'Apellido paterno inválido';
    }
    if ($d['apellido_materno'] !== null && !preg_match($letras, $d['apellido_materno'])) {
        return 'Apellido materno inválido';
    }
    if ($d['telefono'] !== null && !preg_match('/^\d{10}$/', $d['telefono'])) {
        return 'El teléfono debe tener 10 dígitos';
    }
    if ($d['correo'] !== null && (strlen($d['correo']) > 100 || !filter_var($d['correo'], FILTER_VALIDATE_EMAIL))) {
        return 'Correo inválido';
    }
    return null;
}

function datos_cliente(array $body): array
{
    return [
        'rfc'              => strtoupper((string) str_or_null($body, 'rfc')),
        'nombre'           => str_or_null($body, 'nombre'),
        'apellido_paterno' => str_or_null($body, 'apellido_paterno'),
        'apellido_materno' => str_or_null($body, 'apellido_materno'),
        'telefono'         => str_or_null($body, 'telefono'),
        'correo'           => str_or_null($body, 'correo'),
    ];
}

try {
    if ($metodo === 'GET') {
        $rows = db_all('SELECT * FROM cliente ORDER BY fecha_registro DESC');
        json_out(array_map('cliente_json', $rows));
    }

    if ($metodo === 'POST') {
        $d = datos_cliente(read_json_body());
        if ($d['rfc'] === '' || $d['nombre'] === null || $d['apellido_paterno'] === null) {
            json_error('RFC, nombre y apellido paterno son requeridos', 400);
        }
        $err = validar_cliente($d, true);
        if ($err) {
            json_error($err, 400);
        }
        if (db_one('SELECT rfc FROM cliente WHERE rfc = ?', [$d['rfc']])) {
            json_error('Ya existe un cliente con ese RFC', 409);
        }
        db_query(
            'INSERT INTO cliente (rfc, nombre, apellido_paterno, apellido_materno, telefono, correo, fecha_registro) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$d['rfc'], $d['nombre'], $d['apellido_paterno'], $d['apellido_materno'], $d['telefono'], $d['correo'], now_utc()]
        );
        registrar_auditoria("Creó cliente: {$d['nombre']} {$d['apellido_paterno']} ({$d['rfc']})", 'clientes');
        json_out(cliente_json(db_one('SELECT * FROM cliente WHERE rfc = ?', [$d['rfc']])), 201);
    }

    if ($metodo === 'PUT' && $rfc) {
        $d = datos_cliente(read_json_body());
        $d['rfc'] = $rfc;
        $err = validar_cliente($d, false);
        if ($err) {
            json_error($err, 400);
        }
        if (!db_one('SELECT rfc FROM cliente WHERE rfc = ?', [$rfc])) {
            json_error('Cliente no encontrado', 404);
        }
        db_query(
            'UPDATE cliente SET nombre = ?, apellido_paterno = ?, apellido_materno = ?, telefono = ?, correo = ? WHERE rfc = ?',
            [$d['nombre'], $d['apellido_paterno'], $d['apellido_materno'], $d['telefono'], $d['correo'], $rfc]
        );
        registrar_auditoria("Editó cliente: {$d['nombre']} {$d['apellido_paterno']} ({$rfc})", 'clientes');
        json_out(cliente_json(db_one('SELECT * FROM cliente WHERE rfc = ?', [$rfc])));
    }

    if ($metodo === 'DELETE' && $rfc) {
        require_api_admin(); // solo administradores pueden eliminar
        try {
            $n = db_query('DELETE FROM cliente WHERE rfc = ?', [$rfc])->rowCount();
        } catch (PDOException $e) {
            json_error('No se puede eliminar: el cliente tiene vehículos, órdenes o ventas asociadas', 409);
        }
        if ($n === 0) {
            json_error('Cliente no encontrado', 404);
        }
        registrar_auditoria("Eliminó cliente con RFC: {$rfc}", 'clientes');
        json_out(['ok' => true]);
    }

    json_error('Método no permitido', 405);
} catch (Throwable $e) {
    log_error('API clientes', $e);
    json_error('Error al procesar la solicitud de clientes', 500);
}
