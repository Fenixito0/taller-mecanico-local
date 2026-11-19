<?php
// POST api/auth.php?accion=login   { username, password }
// POST api/auth.php?accion=logout

require __DIR__ . '/../includes/bootstrap.php';

if (request_method() !== 'POST') {
    json_error('Método no permitido', 405);
}
require_csrf();

$accion = $_GET['accion'] ?? '';

if ($accion === 'logout') {
    registrar_auditoria('Cerró sesión', 'auth');
    cerrar_sesion();
    json_out(['ok' => true]);
}

if ($accion !== 'login') {
    json_error('Acción no válida', 400);
}

$body = read_json_body();
$username = trim((string) ($body['username'] ?? ''));
$password = (string) ($body['password'] ?? '');

if ($username === '' || $password === '') {
    json_error('Usuario o contraseña incorrectos.', 401);
}

try {
    $minutos = registrar_intento_login(client_ip());
    if ($minutos !== null) {
        json_error("Demasiados intentos. Intenta de nuevo en {$minutos} minuto" . ($minutos !== 1 ? 's' : '') . '.', 429);
    }

    $user = verificar_credenciales($username, $password);
    if ($user === null) {
        json_error('Usuario o contraseña incorrectos.', 401);
    }

    iniciar_sesion_usuario($user);
    registrar_auditoria('Inició sesión', 'auth');
    json_out(['ok' => true, 'csrf' => csrf_token()]);
} catch (Throwable $e) {
    log_error('Login', $e);
    json_error('Error al iniciar sesión. Verifica que MySQL esté encendido.', 500);
}
