<?php

declare(strict_types=1);

/** Registra una venta pagada con el desglose que calcula calcular_cobro. */
function venta_demo(int $idOrden, string $tipo, float $deducible): void
{
    $piezas = piezas_por_orden([$idOrden])[$idOrden] ?? [];
    $cargos = cargos_por_orden([$idOrden])[$idOrden] ?? [];
    $k = calcular_cobro($tipo, $piezas, $cargos, $deducible, 'monto', 0.0, true, 0.0);
    $rfc = db_one('SELECT rfc_cliente FROM ordenservicio WHERE id_orden = ?', [$idOrden])['rfc_cliente'];
    db()->prepare("INSERT INTO venta (id_orden, rfc_cliente, subtotal, piezas, mano_obra, extras, deducible, iva, precio_total, metodo_pago, estado_pago, fecha_venta)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'efectivo', 'pagado', ?)")
        ->execute([$idOrden, $rfc, $k['piezas'], $k['piezas'], $k['mano_obra'], $k['extras'], $k['deducible'], $k['iva'], $k['total'], now_utc()]);
}

function test_reporte_ventas_desglose(): void
{
    test_reset_db();
    $seguro = orden_demo('seguro', [['nombre' => 'Faro', 'origen' => 'aseguradora']]);
    // orden de seguro antigua (antes de v4 se permitían extras): los reportes la siguen sumando
    db_query("INSERT INTO orden_cargo (id_orden, tipo, concepto, monto) VALUES (?, 'extra', 'Pintura', 1000)", [$seguro]);
    venta_demo($seguro, 'seguro', 5000.0);
    $part = orden_demo('particular',
        [['nombre' => 'Faro', 'precio_unitario' => 2000], ['nombre' => 'Espejo', 'precio_unitario' => 300]],
        [['tipo' => 'mano_obra', 'concepto' => 'Mano de obra', 'monto' => 1000]]);
    $espejo = db_one("SELECT id_pieza FROM orden_pieza WHERE id_orden = ? AND nombre = 'Espejo'", [$part])['id_pieza'];
    db_transaction(static fn (PDO $p) => actualizar_precio_pieza($p, (int) $espejo, 0.0));
    db_transaction(static fn (PDO $p) => devolver_pieza($p, (int) $espejo, 'Rota'));
    db()->exec("DELETE FROM orden_pieza WHERE nombre = 'Espejo' AND estado = 'pendiente'");
    venta_demo($part, 'particular', 0.0);

    $hoy = new DateTimeImmutable('-1 day');
    $r = reporte_ventas($hoy, $hoy->modify('+2 day'));
    $res = $r['resumen'];
    t_equals([2000.0, 1000.0, 1000.0, 5000.0],
        [$res['total_piezas'], $res['total_mano_obra'], $res['total_extras'], $res['total_deducibles']]);
    t_equals(round((2000 + 1000 + 1000) * 0.16, 2), round($res['total_iva'], 2));
    t_equals('Faro', $r['top_piezas'][0]['nombre']);
    t_equals(2, $r['top_piezas'][0]['cantidad']);
    t_equals(['Faro'], array_column($r['top_piezas'], 'nombre')); // la devuelta no cuenta
}

function test_reporte_ordenes_piezas(): void
{
    test_reset_db();
    $id = orden_demo('seguro', [['nombre' => 'Faro'], ['nombre' => 'Calavera']]);
    $pid = db_one("SELECT id_pieza FROM orden_pieza WHERE nombre = 'Faro'")['id_pieza'];
    db_transaction(static fn (PDO $p) => cambiar_estado_pieza($p, (int) $pid, 'instalada'));
    $hoy = new DateTimeImmutable('-1 day');
    $o = reporte_ordenes($hoy, $hoy->modify('+2 day'))['ordenes'][0];
    t_equals($id, $o['id_orden']);
    t_equals(['seguro', 'Qualitas', 2, 1], [$o['tipo'], $o['aseguradora'], $o['num_piezas'], $o['piezas_pendientes']]);
}
