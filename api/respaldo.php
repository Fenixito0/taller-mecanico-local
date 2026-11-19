<?php
// GET api/respaldo.php → descarga un respaldo .sql completo de la base de datos (admin)
// Para restaurarlo: C:\xampp\mysql\bin\mysql.exe -uroot taller_mecanico < respaldo.sql

require __DIR__ . '/../includes/bootstrap.php';
require_api_admin();

/** Valor SQL literal seguro. */
function sql_valor(PDO $pdo, $v): string
{
    if ($v === null) {
        return 'NULL';
    }
    if (is_int($v) || is_float($v)) {
        return (string) $v;
    }
    return $pdo->quote((string) $v);
}

try {
    @set_time_limit(300);
    $pdo = db();
    $tablas = $pdo->query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')->fetchAll(PDO::FETCH_NUM);
    $nombre = 'respaldo_taller_' . (new DateTimeImmutable('now'))->format('Y-m-d_His') . '.sql';

    header('Content-Type: application/sql; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $nombre . '"');
    header('Cache-Control: no-store');

    echo "-- Respaldo del sistema de taller mecánico\n-- Generado: " . (new DateTimeImmutable('now'))->format('Y-m-d H:i:s') . "\n\n";
    echo "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n";

    foreach ($tablas as [$tabla]) {
        if ($tabla === 'login_intento') {
            continue; // datos temporales
        }
        $t = '`' . str_replace('`', '``', $tabla) . '`';
        $create = $pdo->query("SHOW CREATE TABLE {$t}")->fetch(PDO::FETCH_NUM)[1];
        echo "DROP TABLE IF EXISTS {$t};\n{$create};\n\n";

        $st = $pdo->query("SELECT * FROM {$t}");
        $lote = [];
        while ($fila = $st->fetch(PDO::FETCH_NUM)) {
            $lote[] = '(' . implode(',', array_map(static fn ($v) => sql_valor($pdo, $v), $fila)) . ')';
            if (count($lote) >= 200) {
                echo "INSERT INTO {$t} VALUES\n" . implode(",\n", $lote) . ";\n";
                $lote = [];
            }
        }
        if ($lote) {
            echo "INSERT INTO {$t} VALUES\n" . implode(",\n", $lote) . ";\n";
        }
        echo "\n";
    }
    echo "SET FOREIGN_KEY_CHECKS = 1;\n";
    registrar_auditoria('Descargó un respaldo de la base de datos', 'respaldo');
} catch (Throwable $e) {
    log_error('API respaldo', $e);
    if (!headers_sent()) {
        json_error('No se pudo generar el respaldo', 500);
    }
}
