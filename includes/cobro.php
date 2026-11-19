<?php
// Cálculo del cobro de una orden por conceptos. Funciones puras (sin BD).
// Requiere la clase ErrorNegocio de includes/repositorio.php.

declare(strict_types=1);

const TASA_IVA = 0.16;

/** Importe de las piezas que se le cobran al cliente (excluye devueltas y sin precio). */
function importe_piezas_cobrables(array $piezas): float
{
    $suma = 0.0;
    foreach ($piezas as $p) {
        if (($p['estado'] ?? '') === 'devuelta' || $p['precio_unitario'] === null) {
            continue;
        }
        $suma += (float) $p['precio_unitario'] * (int) $p['cantidad'];
    }
    return round($suma, 2);
}

/** Suma de cargos de un tipo ('mano_obra' | 'extra'). */
function importe_cargos(array $cargos, string $tipo): float
{
    $suma = 0.0;
    foreach ($cargos as $c) {
        if ($c['tipo'] === $tipo) {
            $suma += (float) $c['monto'];
        }
    }
    return round($suma, 2);
}

/**
 * Desglose del cobro.
 * - Seguro: piezas cobrables + extras (+IVA) + deducible fijo (ya incluye IVA, sin descuento).
 * - Particular: piezas cobrables + mano de obra + extras (+IVA).
 * El descuento se aplica antes del IVA y nunca sobre el deducible.
 */
function calcular_cobro(string $tipo, array $piezas, array $cargos, float $deducible, string $descTipo, float $descValor, bool $aplicaIva, float $anticipo): array
{
    $esSeguro = $tipo === 'seguro';
    $importePiezas = importe_piezas_cobrables($piezas);
    $manoObra = $esSeguro ? 0.0 : importe_cargos($cargos, 'mano_obra');
    $extras = importe_cargos($cargos, 'extra');
    $deducible = $esSeguro ? round(max(0.0, $deducible), 2) : 0.0;

    $bruto = round($importePiezas + $manoObra + $extras, 2);
    if ($descTipo === 'porcentaje') {
        if ($descValor < 0 || $descValor > 100) {
            throw new ErrorNegocio('El descuento debe estar entre 0% y 100%', 400);
        }
        $descuento = round($bruto * $descValor / 100, 2);
    } else {
        $descuento = round(max(0.0, $descValor), 2);
    }
    if ($descuento > $bruto) {
        throw new ErrorNegocio('El descuento no puede ser mayor que el importe (el deducible no lleva descuento)', 400);
    }

    $base = round($bruto - $descuento, 2);
    $iva = $aplicaIva ? round($base * TASA_IVA, 2) : 0.0;
    $total = round($base + $iva + $deducible, 2);
    if ($anticipo > $total + 0.005) {
        throw new ErrorNegocio('Los anticipos superan el total a cobrar', 400);
    }

    return [
        'piezas'    => $importePiezas,
        'mano_obra' => $manoObra,
        'extras'    => $extras,
        'deducible' => $deducible,
        'descuento' => $descuento,
        'base'      => $base,
        'iva'       => $iva,
        'total'     => $total,
        'restante'  => round(max(0.0, $total - $anticipo), 2),
    ];
}
