<?php

declare(strict_types=1);

function pz(?float $precio = null, string $estado = 'instalada', int $cant = 1, bool $extra = false): array
{
    return ['precio_unitario' => $precio, 'estado' => $estado, 'cantidad' => $cant, 'es_extra' => $extra];
}

function test_cobro_seguro(): void
{
    $k = calcular_cobro('seguro', [pz(null), pz(3200.0, 'instalada', 1, true)],
        [['tipo' => 'mano_obra', 'monto' => 2500.0], ['tipo' => 'extra', 'monto' => 6000.0]],
        5000.0, 'monto', 0, true, 0);
    t_equals([3200.0, 0.0, 6000.0, 5000.0, 9200.0, 1472.0, 15672.0],
        [$k['piezas'], $k['mano_obra'], $k['extras'], $k['deducible'], $k['base'], $k['iva'], $k['total']]);
}

function test_cobro_particular_con_descuento(): void
{
    $k = calcular_cobro('particular', [pz(1000.0, 'instalada', 2), pz(500.0, 'devuelta')],
        [['tipo' => 'mano_obra', 'monto' => 1000.0]], 999.0, 'porcentaje', 10, true, 500);
    t_equals([2000.0, 1000.0, 0.0, 300.0, 2700.0, 432.0, 3132.0, 2632.0],
        [$k['piezas'], $k['mano_obra'], $k['deducible'], $k['descuento'], $k['base'], $k['iva'], $k['total'], $k['restante']]);
}

function test_cobro_deducible_sin_iva_ni_descuento(): void
{
    $k = calcular_cobro('seguro', [], [['tipo' => 'extra', 'monto' => 1000.0]], 5000.0, 'monto', 1000, true, 0);
    t_equals([0.0, 0.0, 5000.0], [$k['base'], $k['iva'], $k['total']]);
}

function test_cobro_sin_iva(): void
{
    $k = calcular_cobro('particular', [pz(100.0)], [], 0.0, 'monto', 0, false, 0);
    t_equals([0.0, 100.0], [$k['iva'], $k['total']]);
}

function test_cobro_seguro_total_cero(): void
{
    $k = calcular_cobro('seguro', [pz(null)], [], 0.0, 'monto', 0, true, 0);
    t_equals([0.0, 0.0], [$k['total'], $k['restante']]);
}

function test_cobro_descuento_mayor_al_importe(): void
{
    t_throws(fn () => calcular_cobro('seguro', [], [['tipo' => 'extra', 'monto' => 100.0]], 5000.0, 'monto', 101, true, 0), 400);
}

function test_cobro_porcentaje_invalido(): void
{
    t_throws(fn () => calcular_cobro('particular', [pz(100.0)], [], 0.0, 'porcentaje', 101, true, 0), 400);
}

function test_cobro_anticipo_excede(): void
{
    t_throws(fn () => calcular_cobro('seguro', [], [], 500.0, 'monto', 0, true, 1000), 400);
}
