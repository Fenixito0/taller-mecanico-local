<?php

declare(strict_types=1);

function test_migracion_crea_tablas(): void
{
    foreach (['orden_pieza', 'orden_cargo', 'cotizacion_concepto'] as $t) {
        t_assert(db_one('SHOW TABLES LIKE ' . db()->quote($t)) !== null, "falta {$t}");
    }
    foreach (['tipo', 'aseguradora', 'num_siniestro', 'deducible'] as $c) {
        t_assert(db_one('SHOW COLUMNS FROM ordenservicio LIKE ' . db()->quote($c)) !== null, "falta ordenservicio.{$c}");
    }
    foreach (['piezas', 'extras', 'deducible'] as $c) {
        t_assert(db_one('SHOW COLUMNS FROM venta LIKE ' . db()->quote($c)) !== null, "falta venta.{$c}");
    }
    t_equals('["ANA Seguros","Primero Seguros","Qualitas"]', db_one("SELECT valor FROM configuracion WHERE clave = 'aseguradoras'")['valor'] ?? null);
}

function test_migracion_copia_detalle_y_es_idempotente(): void
{
    test_reset_db();
    $pdo = db();
    $f = now_utc();
    $pdo->exec("INSERT INTO cliente (rfc, nombre, apellido_paterno, fecha_registro) VALUES ('GAGJ800101AB1', 'Juan', 'García', '{$f}')");
    $pdo->exec("INSERT INTO vehiculo (marca, modelo, anio, placas) VALUES ('Nissan', 'Versa', 2018, 'ABC-123-D')");
    $pdo->exec("INSERT INTO vehiculocliente (id_vehiculo, rfc_cliente, fecha) VALUES (1, 'GAGJ800101AB1', '{$f}')");
    $pdo->exec("INSERT INTO refaccion (nombre, lado, precio_unitario, stock) VALUES ('Faro', 'izquierdo', 1890, 3)");
    $pdo->exec("INSERT INTO ordenservicio (id_vehiculo, rfc_cliente, id_usuario, fecha_creacion, estado) VALUES (1, 'GAGJ800101AB1', 1, '{$f}', 'completado')");
    $completada = (int) $pdo->lastInsertId();
    $pdo->exec("INSERT INTO ordenservicio (id_vehiculo, rfc_cliente, id_usuario, fecha_creacion, estado) VALUES (1, 'GAGJ800101AB1', 1, '{$f}', 'pendiente')");
    $pendiente = (int) $pdo->lastInsertId();
    $pdo->exec("INSERT INTO detalleorden (id_orden, id_refaccion, cantidad, precio_unitario) VALUES ({$completada}, 1, 1, 1890), ({$pendiente}, 1, 1, 1890)");
    $pdo->exec("INSERT INTO venta (id_orden, rfc_cliente, subtotal, mano_obra, iva, precio_total, fecha_venta) VALUES ({$completada}, 'GAGJ800101AB1', 1890, 500, 382.4, 2772.4, '{$f}')");
    $pdo->exec("INSERT INTO cotizacion (rfc_cliente, id_vehiculo, fecha) VALUES ('GAGJ800101AB1', 1, '{$f}')");
    $pdo->exec('INSERT INTO detallecotizacion (id_cotizacion, id_refaccion, cantidad, precio_unitario) VALUES (1, 1, 2, 1890)');

    test_ejecutar_sql('migracion_v3.sql');
    test_ejecutar_sql('migracion_v3.sql');

    t_equals(2, (int) db_one('SELECT COUNT(*) n FROM orden_pieza')['n']);
    t_equals('instalada', db_one('SELECT estado FROM orden_pieza WHERE id_orden = ?', [$completada])['estado']);
    t_equals('pendiente', db_one('SELECT estado FROM orden_pieza WHERE id_orden = ?', [$pendiente])['estado']);
    $p = db_one('SELECT * FROM orden_pieza WHERE id_orden = ?', [$completada]);
    t_equals(['Faro', 'izquierdo', 'taller', '1890.00', 0], [$p['nombre'], $p['lado'], $p['origen'], $p['precio_unitario'], (int) $p['es_extra']]);
    $c = db_one("SELECT * FROM cotizacion_concepto WHERE tipo = 'pieza'");
    t_equals(['Faro', 'izquierdo', 2, '1890.00'], [$c['concepto'], $c['lado'], (int) $c['cantidad'], $c['precio_unitario']]);
    t_equals(1, (int) db_one('SELECT COUNT(*) n FROM cotizacion_concepto')['n']);
    $cargo = db_one('SELECT * FROM orden_cargo WHERE id_orden = ?', [$completada]);
    t_equals(['mano_obra', 'Mano de obra', '500.00'], [$cargo['tipo'], $cargo['concepto'], $cargo['monto']]);
    t_equals(1, (int) db_one('SELECT COUNT(*) n FROM orden_cargo')['n']);
    t_equals('1890.00', db_one('SELECT piezas FROM venta WHERE id_orden = ?', [$completada])['piezas']);
}
