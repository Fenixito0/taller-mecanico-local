<?php

declare(strict_types=1);

/** Crea cliente + vehículo y una orden del tipo indicado. Devuelve id_orden. */
function orden_demo(string $tipo, array $piezas = [], array $cargos = []): int
{
    $pdo = db();
    $n = (int) db_one('SELECT COUNT(*) n FROM vehiculo')['n'] + 1;
    $rfc = sprintf('PRUE80010%04d', $n);
    $pdo->prepare('INSERT INTO cliente (rfc, nombre, apellido_paterno, fecha_registro) VALUES (?, ?, ?, ?)')->execute([$rfc, "Cliente{$n}", 'Prueba', now_utc()]);
    $pdo->prepare('INSERT INTO vehiculo (marca, modelo, anio, placas) VALUES (?, ?, ?, ?)')->execute(['Nissan', 'Versa', 2018, "PRU-{$n}"]);
    $idV = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO vehiculocliente (id_vehiculo, rfc_cliente, fecha) VALUES (?, ?, ?)')->execute([$idV, $rfc, now_utc()]);
    $seguro = $tipo === 'seguro'
        ? normalizar_seguro(['tipo' => 'seguro', 'aseguradora' => 'Qualitas', 'num_siniestro' => 'SIN0456789AB', 'deducible' => 5000], aseguradoras())
        : normalizar_seguro(['tipo' => 'particular'], aseguradoras());
    $ps = array_map(static fn (array $p): array => normalizar_pieza($p, $tipo), $piezas);
    $cs = array_map('normalizar_cargo', $cargos);
    return db_transaction(static fn (PDO $p): int => crear_orden($p, $idV, $rfc, null, null, $seguro, $ps, $cs, 1));
}

function pieza_nueva(int $idOrden, array $datos, string $tipo = 'seguro'): int
{
    return db_transaction(static fn (PDO $p): int => agregar_pieza($p, $idOrden, normalizar_pieza($datos, $tipo)));
}

function test_crear_orden_seguro_sin_piezas(): void
{
    test_reset_db();
    $id = orden_demo('seguro');
    $o = obtener_orden($id);
    t_equals(['seguro', 'Qualitas', 'SIN0456789AB', 5000.0, [], []], [$o['tipo'], $o['aseguradora'], $o['num_siniestro'], $o['deducible'], $o['piezas'], $o['cargos']]);
}

function test_crear_orden_particular_con_piezas_y_cargos(): void
{
    test_reset_db();
    $id = orden_demo('particular', [['nombre' => ' Faro ', 'lado' => 'izquierdo', 'precio_unitario' => 1890, 'cantidad' => 2]],
        [['tipo' => 'mano_obra', 'concepto' => 'Mano de obra', 'monto' => 1500], ['tipo' => 'extra', 'concepto' => 'Pintura completa', 'monto' => 6000]]);
    $o = obtener_orden($id);
    t_equals(['particular', null, null, 0.0], [$o['tipo'], $o['aseguradora'], $o['num_siniestro'], $o['deducible']]);
    $p = $o['piezas'][0];
    t_equals(['Faro', 'izquierdo', 'taller', 'pendiente', 2, 1890.0, false], [$p['nombre'], $p['lado'], $p['origen'], $p['estado'], $p['cantidad'], $p['precio_unitario'], $p['es_extra']]);
    t_equals([['mano_obra', 'Mano de obra', 1500.0], ['extra', 'Pintura completa', 6000.0]],
        array_map(static fn ($c) => [$c['tipo'], $c['concepto'], $c['monto']], $o['cargos']));
}

function test_pieza_particular_sin_precio_falla(): void
{
    t_throws(fn () => normalizar_pieza(['nombre' => 'Faro'], 'particular'), 400);
}

function test_pieza_particular_de_aseguradora_falla(): void
{
    t_throws(fn () => normalizar_pieza(['nombre' => 'Faro', 'origen' => 'aseguradora', 'precio_unitario' => 10], 'particular'), 400);
}

function test_pieza_extra_sin_precio_falla(): void
{
    t_throws(fn () => normalizar_pieza(['nombre' => 'Rines', 'es_extra' => true], 'particular'), 400);
}

function test_seguro_no_admite_extras_ni_precios(): void
{
    t_throws(fn () => normalizar_pieza(['nombre' => 'Rines', 'es_extra' => true, 'precio_unitario' => 100], 'seguro'), 400);
    t_throws(fn () => normalizar_pieza(['nombre' => 'Faro', 'origen' => 'taller', 'precio_unitario' => 100], 'seguro'), 400);
    $p = normalizar_pieza(['nombre' => 'Faro', 'origen' => 'taller'], 'seguro');
    t_equals(['taller', null, false], [$p['origen'], $p['precio_unitario'], $p['es_extra']]);
}

function test_seguro_no_admite_cargos(): void
{
    test_reset_db();
    t_throws(fn () => orden_demo('seguro', [], [['tipo' => 'extra', 'concepto' => 'Pintura', 'monto' => 100]]), 400);
    $id = orden_demo('seguro');
    t_throws(fn () => db_transaction(fn (PDO $p) => agregar_cargo($p, $id, normalizar_cargo(['tipo' => 'extra', 'concepto' => 'Pulido', 'monto' => 10]))), 400);
    $pid = pieza_nueva($id, ['nombre' => 'Faro']);
    t_throws(fn () => db_transaction(fn (PDO $p) => actualizar_precio_pieza($p, $pid, 100.0)), 400);
}

function test_particular_a_seguro_requiere_quitar_cobros(): void
{
    test_reset_db();
    $seguro = normalizar_seguro(['tipo' => 'seguro', 'aseguradora' => 'Qualitas', 'num_siniestro' => 'ABC123456789', 'deducible' => 1000], aseguradoras());
    $conCargo = orden_demo('particular', [], [['tipo' => 'mano_obra', 'concepto' => 'Mano de obra', 'monto' => 500]]);
    t_throws(fn () => db_transaction(fn (PDO $p) => actualizar_seguro($p, $conCargo, $seguro)), 409);
    $conExtra = orden_demo('particular', [['nombre' => 'Rines', 'precio_unitario' => 100, 'es_extra' => true]]);
    t_throws(fn () => db_transaction(fn (PDO $p) => actualizar_seguro($p, $conExtra, $seguro)), 409);
    $limpia = orden_demo('particular', [['nombre' => 'Faro', 'precio_unitario' => 100]]);
    db_transaction(fn (PDO $p) => actualizar_seguro($p, $limpia, $seguro));
    $o = obtener_orden($limpia);
    t_equals(['seguro', 'ABC123456789', null], [$o['tipo'], $o['num_siniestro'], $o['piezas'][0]['precio_unitario']]);
}

function test_pieza_sin_nombre_falla(): void
{
    t_throws(fn () => normalizar_pieza(['nombre' => '  '], 'seguro'), 400);
}

function test_pieza_seguro_default_aseguradora(): void
{
    $p = normalizar_pieza(['nombre' => 'Faro'], 'seguro');
    t_equals(['aseguradora', null, 1, 'N/A'], [$p['origen'], $p['precio_unitario'], $p['cantidad'], $p['lado']]);
}

function test_cargo_invalido_falla(): void
{
    t_throws(fn () => normalizar_cargo(['tipo' => 'extra', 'concepto' => 'Pulido', 'monto' => 0]), 400);
    t_throws(fn () => normalizar_cargo(['tipo' => 'otro', 'concepto' => 'Pulido', 'monto' => 10]), 400);
    t_throws(fn () => normalizar_cargo(['tipo' => 'extra', 'concepto' => '', 'monto' => 10]), 400);
}

function test_seguro_aseguradora_desconocida_falla(): void
{
    t_throws(fn () => normalizar_seguro(['tipo' => 'seguro', 'aseguradora' => 'Otra', 'deducible' => 0], aseguradoras()), 400);
    t_throws(fn () => normalizar_seguro(['tipo' => 'seguro', 'aseguradora' => 'Qualitas', 'deducible' => -1], aseguradoras()), 400);
}

function test_devolver_crea_reemplazo(): void
{
    test_reset_db();
    $id = orden_demo('particular');
    $pid = pieza_nueva($id, ['nombre' => 'Defensa', 'precio_unitario' => 800, 'es_extra' => true], 'particular');
    $nuevo = db_transaction(fn (PDO $p) => devolver_pieza($p, $pid, 'Llegó rota'));
    $ps = piezas_por_orden([$id])[$id];
    t_equals(['devuelta', 'Llegó rota'], [$ps[0]['estado'], $ps[0]['motivo_devolucion']]);
    t_equals([$nuevo, 'pendiente', $pid, 'Defensa', 800.0, true], [$ps[1]['id_pieza'], $ps[1]['estado'], $ps[1]['id_reemplaza'], $ps[1]['nombre'], $ps[1]['precio_unitario'], $ps[1]['es_extra']]);
    t_throws(fn () => db_transaction(fn (PDO $p) => devolver_pieza($p, $pid, 'otra vez')), 409);
}

function test_devolver_sin_motivo_falla(): void
{
    test_reset_db();
    $id = orden_demo('seguro');
    $pid = pieza_nueva($id, ['nombre' => 'Faro']);
    t_throws(fn () => db_transaction(fn (PDO $p) => devolver_pieza($p, $pid, '  ')), 400);
}

function test_devolver_instalada_falla(): void
{
    test_reset_db();
    $id = orden_demo('seguro');
    $pid = pieza_nueva($id, ['nombre' => 'Faro']);
    db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $pid, 'instalada'));
    t_throws(fn () => db_transaction(fn (PDO $p) => devolver_pieza($p, $pid, 'mala')), 409);
}

function test_transiciones(): void
{
    test_reset_db();
    $id = orden_demo('seguro');
    $pid = pieza_nueva($id, ['nombre' => 'Faro']);
    t_throws(fn () => db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $pid, 'devuelta')), 409);
    db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $pid, 'recibida'));
    db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $pid, 'instalada'));
    t_throws(fn () => db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $pid, 'pendiente')), 409);
    db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $pid, 'recibida'));
    t_equals('recibida', piezas_por_orden([$id])[$id][0]['estado']);
    t_throws(fn () => db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $pid, 'xyz')), 400);
}

function test_bloqueantes(): void
{
    test_reset_db();
    $id = orden_demo('seguro');
    $a = pieza_nueva($id, ['nombre' => 'Faro']);
    $b = pieza_nueva($id, ['nombre' => 'Moldura']);
    $c = pieza_nueva($id, ['nombre' => 'Defensa']);
    db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $b, 'instalada'));
    $r = db_transaction(fn (PDO $p) => devolver_pieza($p, $c, 'rota'));
    db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $r, 'instalada'));
    t_equals([$a], array_column(piezas_bloqueantes($id), 'id_pieza'));
}

function test_eliminar_pieza_solo_pendiente(): void
{
    test_reset_db();
    $id = orden_demo('seguro');
    $a = pieza_nueva($id, ['nombre' => 'Faro']);
    $b = pieza_nueva($id, ['nombre' => 'Moldura']);
    db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $b, 'recibida'));
    db_transaction(fn (PDO $p) => eliminar_pieza($p, $a));
    t_throws(fn () => db_transaction(fn (PDO $p) => eliminar_pieza($p, $b)), 409);
    t_equals(['Moldura'], array_column(piezas_por_orden([$id])[$id], 'nombre'));
}

function test_cargos_agregar_eliminar(): void
{
    test_reset_db();
    $id = orden_demo('particular');
    $c = db_transaction(fn (PDO $p) => agregar_cargo($p, $id, normalizar_cargo(['tipo' => 'extra', 'concepto' => 'Pulido', 'monto' => 350.5])));
    t_equals([['extra', 'Pulido', 350.5]], array_map(static fn ($x) => [$x['tipo'], $x['concepto'], $x['monto']], cargos_por_orden([$id])[$id]));
    db_transaction(fn (PDO $p) => eliminar_cargo($p, $c));
    t_equals([], cargos_por_orden([$id])[$id] ?? []);
}

function test_cambiar_tipo_seguro_a_particular(): void
{
    test_reset_db();
    $id = orden_demo('seguro');
    pieza_nueva($id, ['nombre' => 'Faro']);
    pieza_nueva($id, ['nombre' => 'Moldura', 'origen' => 'taller']);
    db_transaction(fn (PDO $p) => actualizar_seguro($p, $id, normalizar_seguro(['tipo' => 'particular'], aseguradoras())));
    $o = obtener_orden($id);
    t_equals(['particular', null, null, 0.0], [$o['tipo'], $o['aseguradora'], $o['num_siniestro'], $o['deducible']]);
    t_equals([['taller', null], ['taller', null]], array_map(static fn ($p) => [$p['origen'], $p['precio_unitario']], $o['piezas']));
}

function test_actualizar_deducible(): void
{
    test_reset_db();
    $id = orden_demo('seguro');
    db_transaction(fn (PDO $p) => actualizar_seguro($p, $id, normalizar_seguro(['tipo' => 'seguro', 'aseguradora' => 'ANA Seguros', 'num_siniestro' => 'X12345678901', 'deducible' => 7500.5], aseguradoras())));
    $o = obtener_orden($id);
    t_equals(['ANA Seguros', 'X12345678901', 7500.5], [$o['aseguradora'], $o['num_siniestro'], $o['deducible']]);
}

function test_orden_cerrada_no_editable(): void
{
    test_reset_db();
    $id = orden_demo('seguro');
    $pid = pieza_nueva($id, ['nombre' => 'Faro']);
    db_query("UPDATE ordenservicio SET estado = 'completado' WHERE id_orden = ?", [$id]);
    t_throws(fn () => pieza_nueva($id, ['nombre' => 'Moldura']), 409);
    t_throws(fn () => db_transaction(fn (PDO $p) => agregar_cargo($p, $id, normalizar_cargo(['tipo' => 'extra', 'concepto' => 'X', 'monto' => 1]))), 409);
    t_throws(fn () => db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $pid, 'recibida')), 409);
    t_throws(fn () => db_transaction(fn (PDO $p) => devolver_pieza($p, $pid, 'rota')), 409);
    t_throws(fn () => db_transaction(fn (PDO $p) => actualizar_seguro($p, $id, normalizar_seguro(['tipo' => 'particular'], aseguradoras()))), 409);
    t_throws(fn () => pieza_nueva(9999, ['nombre' => 'X']), 404);
}

function test_tablero_y_nombres(): void
{
    test_reset_db();
    $a = orden_demo('seguro');
    $b = orden_demo('particular');
    pieza_nueva($a, ['nombre' => 'Faro']);
    $x = pieza_nueva($b, ['nombre' => 'Faro', 'precio_unitario' => 100], 'particular');
    $m = pieza_nueva($a, ['nombre' => 'Moldura']);
    $d = pieza_nueva($a, ['nombre' => 'Defensa']);
    db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $m, 'instalada'));
    db_transaction(fn (PDO $p) => devolver_pieza($p, $d, 'rota'));

    $todos = tablero_piezas(null, null);
    t_equals(['Faro', 'Faro', 'Defensa', 'Defensa'], array_column($todos, 'nombre'));
    t_equals(['devuelta'], array_values(array_unique(array_column(tablero_piezas('devuelta', null), 'estado'))));
    t_equals(1, count(tablero_piezas('devuelta', null)));
    t_equals([$a, $a, $a], array_column(tablero_piezas(null, 'Qualitas'), 'id_orden'));
    $fila = tablero_piezas(null, null)[0];
    foreach (['id_pieza', 'id_orden', 'placas', 'vehiculo', 'cliente', 'aseguradora', 'tipo', 'dias'] as $k) {
        t_assert(array_key_exists($k, $fila), "falta {$k} en tablero");
    }
    t_equals(['Faro'], nombres_pieza('fa'));
    t_equals([], nombres_pieza(''));
    db_query("UPDATE ordenservicio SET estado = 'completado' WHERE id_orden = ?", [$b]);
    t_assert(!in_array($x, array_column(tablero_piezas(null, null), 'id_pieza'), true), 'orden cerrada en tablero');
}

function test_aseguradoras_en_config(): void
{
    t_equals(['ANA Seguros', 'Primero Seguros', 'Qualitas'], aseguradoras());
    t_equals(['ANA Seguros', 'Primero Seguros', 'Qualitas'], config_taller()['aseguradoras']);
}

function test_actualizar_precio_pieza(): void
{
    test_reset_db();
    $id = orden_demo('seguro');
    $pid = pieza_nueva($id, ['nombre' => 'Faro']);
    db_transaction(fn (PDO $p) => cambiar_estado_pieza($p, $pid, 'recibida'));
    db_transaction(fn (PDO $p) => actualizar_precio_pieza($p, $pid, null));
    t_equals(null, piezas_por_orden([$id])[$id][0]['precio_unitario']);
    $part = orden_demo('particular');
    $pid = pieza_nueva($part, ['nombre' => 'Faro', 'precio_unitario' => 100], 'particular');
    db_transaction(fn (PDO $p) => actualizar_precio_pieza($p, $pid, 1890.5));
    t_equals(1890.5, piezas_por_orden([$part])[$part][0]['precio_unitario']);
    t_throws(fn () => db_transaction(fn (PDO $p) => actualizar_precio_pieza($p, $pid, -5.0)), 400);
}

function test_precio_obligatorio_en_particular(): void
{
    test_reset_db();
    $id = orden_demo('particular');
    $pid = pieza_nueva($id, ['nombre' => 'Faro', 'precio_unitario' => 100], 'particular');
    t_throws(fn () => db_transaction(fn (PDO $p) => actualizar_precio_pieza($p, $pid, null)), 400);
}

function test_guardar_aseguradoras(): void
{
    test_reset_db();
    t_equals(['ANA Seguros', 'GNP'], normalizar_aseguradoras(['  ANA Seguros ', 'GNP']));
    t_throws(static fn () => normalizar_aseguradoras(['GNP', 'gnp']), 400);
    t_throws(static fn () => normalizar_aseguradoras(['']), 400);
    t_throws(static fn () => normalizar_aseguradoras([str_repeat('x', 61)]), 400);
    t_throws(static fn () => normalizar_aseguradoras([5]), 400);
    db_transaction(static fn (PDO $p) => guardar_aseguradoras($p, ['Qualitas', 'HDI']));
    t_equals(['Qualitas', 'HDI'], aseguradoras());
    db_transaction(static fn (PDO $p) => guardar_aseguradoras($p, ['ANA Seguros', 'Primero Seguros', 'Qualitas']));
}
