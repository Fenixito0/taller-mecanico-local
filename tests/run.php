<?php
// Ejecuta las pruebas: C:\xampp\php\php.exe tests\run.php [filtro]
// El filtro se compara con el nombre del archivo (sin _test.php) o de la función.

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$filtro = $argv[1] ?? '';
test_crear_db();

$archivos = glob(__DIR__ . '/*_test.php');
$antes = get_defined_functions()['user'];
$porArchivo = [];
foreach ($archivos as $a) {
    require_once $a;
    $nuevas = array_diff(get_defined_functions()['user'], $antes);
    $antes = get_defined_functions()['user'];
    $porArchivo[basename($a, '_test.php')] = array_values(array_filter($nuevas, static fn (string $f): bool => str_starts_with($f, 'test_')));
}

$ok = 0;
$fallas = 0;
foreach ($porArchivo as $archivo => $funciones) {
    foreach ($funciones as $f) {
        if ($filtro !== '' && $archivo !== $filtro && !str_contains($f, $filtro)) {
            continue;
        }
        try {
            $f();
            $ok++;
            echo "OK    {$f}\n";
        } catch (Throwable $e) {
            $fallas++;
            echo "FALLA {$f}: " . get_class($e) . ': ' . $e->getMessage() . "\n";
        }
    }
}
echo "\n{$ok} OK, {$fallas} fallas\n";
exit($fallas > 0 ? 1 : 0);
