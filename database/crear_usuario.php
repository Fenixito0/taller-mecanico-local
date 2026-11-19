<?php
// Crea un usuario o reinicia su contraseña. Solo se ejecuta desde la consola:
//
//   C:\xampp\php\php.exe database\crear_usuario.php <usuario> <contraseña> [admin|empleado] ["Nombre completo"]
//
// Ejemplo:
//   C:\xampp\php\php.exe database\crear_usuario.php admin MiClaveSegura123 admin "Administrador"

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$GLOBALS['APP_CONFIG'] = require __DIR__ . '/../includes/config.php';
function config(string $key)
{
    return $GLOBALS['APP_CONFIG'][$key] ?? null;
}
require __DIR__ . '/../includes/db.php';

[$script, $username, $password, $rol, $nombre] = array_pad($argv, 5, null);

if ($username === null || $password === null) {
    fwrite(STDERR, "Uso: php database/crear_usuario.php <usuario> <contraseña> [admin|empleado] [\"Nombre\"]\n");
    exit(1);
}
if (strlen($password) < 8) {
    fwrite(STDERR, "La contraseña debe tener al menos 8 caracteres.\n");
    exit(1);
}
$rol = in_array($rol, ['admin', 'empleado'], true) ? $rol : 'empleado';
$nombre = $nombre ?: ($rol === 'admin' ? 'Administrador' : $username);
$hash = password_hash($password, PASSWORD_BCRYPT);

$existe = db_one('SELECT id_usuario FROM usuario WHERE username = ?', [$username]);
if ($existe) {
    db_query('UPDATE usuario SET password_hash = ?, rol = ?, nombre = ?, activo = 1 WHERE id_usuario = ?', [$hash, $rol, $nombre, $existe['id_usuario']]);
    echo "Usuario '{$username}' actualizado (contraseña reiniciada, rol: {$rol}).\n";
} else {
    $now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s.v');
    db_query('INSERT INTO usuario (username, password_hash, nombre, rol, activo, created_at) VALUES (?, ?, ?, ?, 1, ?)', [$username, $hash, $nombre, $rol, $now]);
    echo "Usuario '{$username}' creado (rol: {$rol}).\n";
}
