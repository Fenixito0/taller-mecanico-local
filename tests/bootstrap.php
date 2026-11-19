<?php
// Entorno de pruebas: usa la base taller_mecanico_test, recreada desde los scripts SQL.

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

const TEST_DB = 'taller_mecanico_test';
const TEST_CLAVE = 'clave-prueba-123';
const MYSQL_BIN = 'C:\\xampp\\mysql\\bin\\mysql.exe';

$GLOBALS['APP_CONFIG'] = array_merge(require __DIR__ . '/../includes/config.php', ['db_name' => TEST_DB]);
date_default_timezone_set($GLOBALS['APP_CONFIG']['timezone']);

function config(string $key)
{
    return $GLOBALS['APP_CONFIG'][$key] ?? null;
}

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/repositorio.php';
foreach (['cobro.php', 'piezas.php', 'catalogo.php'] as $f) {
    if (is_file(__DIR__ . '/../includes/' . $f)) {
        require_once __DIR__ . '/../includes/' . $f;
    }
}

final class FallaPrueba extends RuntimeException
{
}

/** Ejecuta un archivo de database/ sobre la base de pruebas. */
function test_ejecutar_sql(string $archivo): void
{
    $sql = file_get_contents(__DIR__ . '/../database/' . $archivo);
    test_mysql(str_replace('taller_mecanico', TEST_DB, $sql));
}

function test_mysql(string $sql): void
{
    $cmd = sprintf('"%s" -u%s %s --default-character-set=utf8mb4', MYSQL_BIN, config('db_user'), config('db_pass') !== '' ? '-p' . config('db_pass') : '');
    $proc = proc_open($cmd, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($proc)) {
        throw new RuntimeException('No se pudo ejecutar mysql');
    }
    fwrite($pipes[0], $sql);
    fclose($pipes[0]);
    $err = stream_get_contents($pipes[2]);
    stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    if (proc_close($proc) !== 0) {
        throw new RuntimeException("Error de SQL: {$err}");
    }
}

/** Crea la base de pruebas desde cero (antes de abrir la conexión PDO). */
function test_crear_db(): void
{
    test_mysql('DROP DATABASE IF EXISTS ' . TEST_DB . ';');
    foreach (['schema.sql', 'migracion_v2.sql', 'migracion_v3.sql', 'migracion_v4.sql'] as $f) {
        if (is_file(__DIR__ . '/../database/' . $f)) {
            test_ejecutar_sql($f);
        }
    }
}

/** Vacía las tablas de datos y crea los usuarios admin (id 1) y empleado. */
function test_reset_db(): void
{
    $pdo = db();
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    $tablas = $pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name NOT IN ('configuracion', 'marca', 'modelo', 'pieza_catalogo')")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tablas as $t) {
        $pdo->exec("TRUNCATE TABLE `{$t}`");
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    $hash = password_hash(TEST_CLAVE, PASSWORD_BCRYPT);
    $ins = $pdo->prepare('INSERT INTO usuario (id_usuario, username, password_hash, nombre, rol, activo, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)');
    $ins->execute([1, 'admin', $hash, 'Admin', 'admin', now_utc()]);
    $ins->execute([2, 'empleado', $hash, 'Empleado', 'empleado', now_utc()]);
}

function t_assert(bool $cond, string $msg = 'aserción falsa'): void
{
    if (!$cond) {
        throw new FallaPrueba($msg);
    }
}

function t_equals($esperado, $real, string $msg = ''): void
{
    if ($esperado !== $real) {
        throw new FallaPrueba(trim($msg . ' esperado ' . var_export($esperado, true) . ', obtenido ' . var_export($real, true)));
    }
}

function t_throws(callable $fn, int $codigo): void
{
    try {
        $fn();
    } catch (ErrorNegocio $e) {
        t_equals($codigo, $e->getCode(), 'código de error (' . $e->getMessage() . ')');
        return;
    }
    throw new FallaPrueba("se esperaba ErrorNegocio {$codigo}");
}
