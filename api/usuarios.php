<?php
// GET  api/usuarios.php                       → lista (admin)
// POST api/usuarios.php                       → crear (admin) {username, nombre, rol, password}
// PUT  api/usuarios.php?id=N                  → editar (admin) {nombre, rol, activo, password?}
// PUT  api/usuarios.php?accion=mi_password    → cambiar la contraseña propia {actual, nueva}

require __DIR__ . '/../includes/bootstrap.php';
$user = require_api_auth();

$metodo = request_method();
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
const MIN_PASSWORD = 8;

function usuario_json(array $u): array
{
    return [
        'id_usuario' => (int) $u['id_usuario'],
        'username'   => $u['username'],
        'nombre'     => $u['nombre'],
        'rol'        => $u['rol'],
        'activo'     => (bool) $u['activo'],
        'created_at' => iso_utc($u['created_at']),
    ];
}

function validar_password(string $p): ?string
{
    if (mb_strlen($p) < MIN_PASSWORD) {
        return 'La contraseña debe tener al menos ' . MIN_PASSWORD . ' caracteres';
    }
    if (mb_strlen($p) > 72) {
        return 'La contraseña es demasiado larga (máx. 72)';
    }
    return null;
}

function hay_otro_admin_activo(int $excepto): bool
{
    return (bool) db_one("SELECT 1 FROM usuario WHERE rol = 'admin' AND activo = 1 AND id_usuario <> ?", [$excepto]);
}

try {
    if ($metodo === 'PUT' && ($_GET['accion'] ?? '') === 'mi_password') {
        $body = read_json_body();
        $actual = (string) ($body['actual'] ?? '');
        $nueva = (string) ($body['nueva'] ?? '');
        if (verificar_credenciales($user['username'], $actual) === null) {
            json_error('La contraseña actual no es correcta', 400);
        }
        if ($err = validar_password($nueva)) {
            json_error($err, 400);
        }
        db_query('UPDATE usuario SET password_hash = ? WHERE id_usuario = ?', [password_hash($nueva, PASSWORD_BCRYPT), $user['id']]);
        registrar_auditoria('Cambió su contraseña', 'usuarios');
        json_out(['ok' => true]);
    }

    require_api_admin();

    if ($metodo === 'GET') {
        json_out(array_map('usuario_json', db_all('SELECT * FROM usuario ORDER BY activo DESC, username')));
    }

    if ($metodo === 'POST') {
        $body = read_json_body();
        $username = strtolower(trim((string) ($body['username'] ?? '')));
        $nombre = str_or_null($body, 'nombre');
        $rol = ($body['rol'] ?? '') === 'admin' ? 'admin' : 'empleado';
        $password = (string) ($body['password'] ?? '');
        if (!preg_match('/^[a-z0-9._-]{3,50}$/', $username)) {
            json_error('Usuario inválido: 3 a 50 caracteres (letras, números, punto, guion)', 400);
        }
        if ($err = validar_password($password)) {
            json_error($err, 400);
        }
        if (db_one('SELECT 1 FROM usuario WHERE username = ?', [$username])) {
            json_error('Ese nombre de usuario ya existe', 409);
        }
        db_query('INSERT INTO usuario (username, password_hash, nombre, rol, activo, created_at) VALUES (?, ?, ?, ?, 1, ?)',
            [$username, password_hash($password, PASSWORD_BCRYPT), $nombre !== null ? mb_substr($nombre, 0, 100) : null, $rol, now_utc()]);
        $nuevo = (int) db()->lastInsertId();
        registrar_auditoria("Creó usuario {$username} ({$rol})", 'usuarios');
        json_out(usuario_json(db_one('SELECT * FROM usuario WHERE id_usuario = ?', [$nuevo])), 201);
    }

    if ($metodo === 'PUT' && $id > 0) {
        $actual = db_one('SELECT * FROM usuario WHERE id_usuario = ?', [$id]);
        if ($actual === null) {
            json_error('Usuario no encontrado', 404);
        }
        $body = read_json_body();
        $nombre = str_or_null($body, 'nombre');
        $rol = ($body['rol'] ?? $actual['rol']) === 'admin' ? 'admin' : 'empleado';
        $activo = array_key_exists('activo', $body) ? (bool) $body['activo'] : (bool) $actual['activo'];
        $password = (string) ($body['password'] ?? '');

        $pierdeAdmin = $actual['rol'] === 'admin' && (int) $actual['activo'] === 1 && ($rol !== 'admin' || !$activo);
        if ($pierdeAdmin && !hay_otro_admin_activo($id)) {
            json_error('Debe quedar al menos un administrador activo', 409);
        }
        if ($id === $user['id'] && !$activo) {
            json_error('No puedes desactivar tu propia cuenta', 409);
        }
        if ($password !== '' && ($err = validar_password($password))) {
            json_error($err, 400);
        }

        db_query('UPDATE usuario SET nombre = ?, rol = ?, activo = ? WHERE id_usuario = ?',
            [$nombre !== null ? mb_substr($nombre, 0, 100) : null, $rol, $activo ? 1 : 0, $id]);
        if ($password !== '') {
            db_query('UPDATE usuario SET password_hash = ? WHERE id_usuario = ?', [password_hash($password, PASSWORD_BCRYPT), $id]);
        }
        registrar_auditoria("Editó usuario {$actual['username']}" . ($password !== '' ? ' (nueva contraseña)' : ''), 'usuarios');
        json_out(usuario_json(db_one('SELECT * FROM usuario WHERE id_usuario = ?', [$id])));
    }

    json_error('Método no permitido', 405);
} catch (Throwable $e) {
    log_error('API usuarios', $e);
    json_error('Error al procesar el usuario', 500);
}
