<?php

declare(strict_types=1);

/** Cliente + vehículo de prueba; devuelve [rfc, id_vehiculo]. */
function cot_cliente_vehiculo(): array
{
    $pdo = db();
    $rfc = 'COTI800101AAA';
    $pdo->prepare('INSERT INTO cliente (rfc, nombre, apellido_paterno, fecha_registro) VALUES (?, ?, ?, ?)')->execute([$rfc, 'Cot', 'Prueba', now_utc()]);
    $pdo->prepare('INSERT INTO vehiculo (marca, modelo, anio, placas) VALUES (?, ?, ?, ?)')->execute(['Mazda', '3', 2020, 'COT-1']);
    $idV = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO vehiculocliente (id_vehiculo, rfc_cliente, fecha) VALUES (?, ?, ?)')->execute([$idV, $rfc, now_utc()]);
    return [$rfc, $idV];
}

function cot_demo(array $conceptos): int
{
    [$rfc, $idV] = cot_cliente_vehiculo();
    $cs = array_map('normalizar_concepto', $conceptos);
    return db_transaction(static fn (PDO $p): int => crear_cotizacion($p, $idV, $rfc, 'Golpe lateral', 85000, $cs, 1));
}

function test_convertir_cotizacion(): void
{
    test_reset_db();
    $id = cot_demo([
        ['tipo' => 'pieza', 'concepto' => 'Defensa', 'lado' => 'central', 'cantidad' => 2, 'precio_unitario' => 1000],
        ['tipo' => 'mano_obra', 'concepto' => 'Mano de obra', 'cantidad' => 1, 'precio_unitario' => 800],
        ['tipo' => 'extra', 'concepto' => 'Pulido', 'cantidad' => 1, 'precio_unitario' => 500],
    ]);
    t_equals(3300.0, total_conceptos(conceptos_por_cotizacion([$id])[$id]));

    $idOrden = db_transaction(static fn (PDO $p): int => convertir_cotizacion($p, $id, 1));
    $o = db_one('SELECT tipo, kilometraje FROM ordenservicio WHERE id_orden = ?', [$idOrden]);
    t_equals('particular', $o['tipo']);
    t_equals(85000, (int) $o['kilometraje']);
    $pz = piezas_por_orden([$idOrden])[$idOrden];
    t_equals(1, count($pz));
    t_equals('Defensa', $pz[0]['nombre']);
    t_equals('pendiente', $pz[0]['estado']);
    t_equals('taller', $pz[0]['origen']);
    t_equals(2, $pz[0]['cantidad']);
    t_equals(1000.0, $pz[0]['precio_unitario']);
    $cg = cargos_por_orden([$idOrden])[$idOrden];
    t_equals([['mano_obra', 800.0], ['extra', 500.0]], array_map(static fn (array $c): array => [$c['tipo'], $c['monto']], $cg));
    t_equals('convertida', db_one('SELECT estado FROM cotizacion WHERE id_cotizacion = ?', [$id])['estado']);
    t_throws(static fn () => db_transaction(static fn (PDO $p): int => convertir_cotizacion($p, $id, 1)), 409);
}

function test_convertir_pieza_extra_de_cotizacion(): void
{
    test_reset_db();
    $id = cot_demo([['tipo' => 'pieza', 'concepto' => 'EXTRA · Spoiler', 'cantidad' => 1, 'precio_unitario' => 2500]]);
    $idOrden = db_transaction(static fn (PDO $p): int => convertir_cotizacion($p, $id, 1));
    $pz = piezas_por_orden([$idOrden])[$idOrden][0];
    t_equals('Spoiler', $pz['nombre']);
    t_equals(true, $pz['es_extra']);
}

function test_concepto_invalido(): void
{
    t_throws(static fn () => normalizar_concepto(['tipo' => 'pieza', 'concepto' => 'Faro', 'cantidad' => 1, 'precio_unitario' => null]), 400);
    t_throws(static fn () => normalizar_concepto(['tipo' => 'otro', 'concepto' => 'Faro', 'cantidad' => 1, 'precio_unitario' => 5]), 400);
    t_throws(static fn () => normalizar_concepto(['tipo' => 'pieza', 'concepto' => '', 'cantidad' => 1, 'precio_unitario' => 5]), 400);
    t_throws(static fn () => normalizar_concepto(['tipo' => 'pieza', 'concepto' => 'Faro', 'cantidad' => 0, 'precio_unitario' => 5]), 400);
    t_equals(0.0, normalizar_concepto(['tipo' => 'extra', 'concepto' => 'Revisión', 'precio_unitario' => 0])['precio_unitario']);
}
