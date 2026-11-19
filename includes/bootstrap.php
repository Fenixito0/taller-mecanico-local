<?php
// Punto de entrada común: configuración, cabeceras de seguridad, sesión y BD.

declare(strict_types=1);

$GLOBALS['APP_CONFIG'] = require __DIR__ . '/config.php';

date_default_timezone_set($GLOBALS['APP_CONFIG']['timezone']);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/auth.php';

enviar_cabeceras_seguridad();
iniciar_sesion();

function config(string $key)
{
    return $GLOBALS['APP_CONFIG'][$key] ?? null;
}

function enviar_cabeceras_seguridad(): void
{
    if (headers_sent()) {
        return;
    }
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header('X-XSS-Protection: 1; mode=block');
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        header('Strict-Transport-Security: max-age=63072000; includeSubDomains; preload');
    }
}
