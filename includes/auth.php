<?php
// Sesión, autenticación, CSRF, rate limiting y auditoría.

function iniciar_sesion(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $lifetime = (int) config('session_lifetime');
    ini_set('session.gc_maxlifetime', (string) $lifetime);
    ini_set('session.use_strict_mode', '1');
    session_name('taller_sid');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();

    // Expiración absoluta de la sesión (8 h desde el login)
    if (isset($_SESSION['user'], $_SESSION['login_at']) && time() - $_SESSION['login_at'] > $lifetime) {
        cerrar_sesion();
        session_start();
    }
}

function usuario_actual(): ?array
{
    return $_SESSION['user'] ?? null;
}

/** Para páginas HTML: redirige al login si no hay sesión. */
function require_login(): array
{
    $user = usuario_actual();
    if ($user === null) {
        // Recordar la página para volver a ella tras iniciar sesión (solo páginas locales)
        $destino = basename($_SERVER['SCRIPT_NAME'] ?? '');
        $query = $_SERVER['QUERY_STRING'] ?? '';
        if ($query !== '') {
            $destino .= '?' . $query;
        }
        $next = preg_match('/^[a-z_]+\.php(\?[\w=&%.-]*)?$/', $destino) ? '?next=' . rawurlencode($destino) : '';
        header('Location: login.php' . $next);
        exit;
    }
    return $user;
}

/** Para la API: responde 401 si no hay sesión y valida CSRF en peticiones que modifican datos. */
function require_api_auth(): array
{
    $user = usuario_actual();
    if ($user === null) {
        json_error('No autorizado. Inicia sesión para continuar.', 401);
    }
    if (request_method() !== 'GET') {
        require_csrf();
    }
    return $user;
}

function es_admin(?array $user = null): bool
{
    $user = $user ?? usuario_actual();
    return ($user['rol'] ?? '') === 'admin';
}

/** Página solo para administradores. */
function require_admin_page(): array
{
    $user = require_login();
    if (!es_admin($user)) {
        http_response_code(403);
        header('Location: orden_nueva.php');
        exit;
    }
    return $user;
}

/** API solo para administradores. */
function require_api_admin(): array
{
    $user = require_api_auth();
    if (!es_admin($user)) {
        json_error('No tienes permiso para realizar esta acción. Pide ayuda a un administrador.', 403);
    }
    return $user;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function require_csrf(): void
{
    $enviado = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf'] ?? '');
    if (!is_string($enviado) || !hash_equals(csrf_token(), $enviado)) {
        json_error('Token de seguridad inválido. Recarga la página.', 403);
    }
}

function cerrar_sesion(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

/**
 * Verifica credenciales. Devuelve el usuario o null.
 * Acepta hashes bcrypt generados por bcryptjs ($2a$/$2b$) además de los de PHP ($2y$).
 */
function verificar_credenciales(string $username, string $password): ?array
{
    $u = db_one('SELECT id_usuario, username, password_hash, nombre, rol, activo FROM usuario WHERE username = ?', [$username]);
    if ($u === null || !(int) $u['activo']) {
        // Igualar tiempos para no revelar si el usuario existe
        password_verify($password, '$2y$10$2/iSl4.XuwR.VlaooDJe/.zPxJpnUV9Nfc4WGaRfba9gY7eaxWT2e');
        return null;
    }
    $hash = (string) $u['password_hash'];
    if (preg_match('/^\$2[ab]\$/', $hash)) {
        $hash = '$2y$' . substr($hash, 4);
    }
    if (!password_verify($password, $hash)) {
        return null;
    }
    return [
        'id'       => (int) $u['id_usuario'],
        'username' => $u['username'],
        'name'     => $u['nombre'] ?: $u['username'],
        'rol'      => $u['rol'],
    ];
}

function iniciar_sesion_usuario(array $user): void
{
    session_regenerate_id(true);
    $_SESSION['user'] = $user;
    $_SESSION['login_at'] = time();
    unset($_SESSION['csrf']);
}

// ── Rate limiting del login (persistido en BD) ───────────────────────

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'anonymous';
}

/**
 * Registra un intento de login para la IP. Devuelve null si está permitido,
 * o el número de minutos que faltan para poder reintentar.
 */
function registrar_intento_login(string $ip): ?int
{
    $max = (int) config('login_max_intentos');
    $ventana = (int) config('login_ventana_min');
    $limite = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify("-{$ventana} minutes")->format('Y-m-d H:i:s.v');

    db_query('DELETE FROM login_intento WHERE fecha < ?', [$limite]);
    $row = db_one('SELECT COUNT(*) AS n, MIN(fecha) AS primero FROM login_intento WHERE ip = ?', [$ip]);

    if ((int) $row['n'] >= $max) {
        $primero = new DateTimeImmutable($row['primero'], new DateTimeZone('UTC'));
        $reset = $primero->modify("+{$ventana} minutes");
        $segundos = $reset->getTimestamp() - time();
        return max(1, (int) ceil($segundos / 60));
    }
    db_query('INSERT INTO login_intento (ip, fecha) VALUES (?, ?)', [$ip, now_utc()]);
    return null;
}

// ── Auditoría ─────────────────────────────────────────────────────────

/** Registra una acción en la bitácora. Si falla, no interrumpe la operación principal. */
function registrar_auditoria(string $accion, string $modulo): void
{
    try {
        $user = usuario_actual();
        db_query(
            'INSERT INTO auditoria (id_usuario, username, accion, modulo, fecha) VALUES (?, ?, ?, ?, ?)',
            [$user['id'] ?? null, $user['username'] ?? 'desconocido', mb_substr($accion, 0, 100), $modulo, now_utc()]
        );
    } catch (Throwable $e) {
        log_error('Error al registrar auditoría', $e);
    }
}
