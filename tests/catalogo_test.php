<?php

declare(strict_types=1);

// ── Placas ───────────────────────────────────────────────────────────

function test_placas_se_normalizan(): void
{
    t_equals('ABC123D', normalizar_placas('abc-123-d'));
    t_equals('ABC1234', normalizar_placas(' ABC 1234 '));
    t_equals('UPX123', normalizar_placas('upx-12-3'));
}

function test_placas_invalidas_fallan(): void
{
    foreach (['', 'AB12', 'ABCDEFG', '1234567', 'ABC12345', 'ABC*123', 'ÑAB1234'] as $p) {
        t_throws(fn () => normalizar_placas($p), 400);
    }
}

// ── Siniestro ────────────────────────────────────────────────────────

function test_siniestro_obligatorio_y_alfanumerico(): void
{
    $base = ['tipo' => 'seguro', 'aseguradora' => 'Qualitas', 'deducible' => 0];
    t_equals('AB1234567890', normalizar_seguro($base + ['num_siniestro' => ' ab1234567890 '], aseguradoras())['num_siniestro']);
    t_equals('1234567890ABCDEF', normalizar_seguro($base + ['num_siniestro' => '1234567890ABCDEF'], aseguradoras())['num_siniestro']);
    foreach (['', 'AB123456789', '1234567890ABCDEFG', 'AB-123-456-789', 'AB 1234567890'] as $s) {
        t_throws(fn () => normalizar_seguro($base + ['num_siniestro' => $s], aseguradoras()), 400);
    }
    t_throws(fn () => normalizar_seguro($base, aseguradoras()), 400);
}

// ── Marcas y modelos ─────────────────────────────────────────────────

function test_catalogo_trae_marcas_con_modelos(): void
{
    $marcas = catalogo_marcas();
    $toyota = array_values(array_filter($marcas, static fn (array $m): bool => $m['nombre'] === 'Toyota'))[0] ?? null;
    t_assert($toyota !== null, 'falta Toyota');
    t_assert(in_array('Corolla', array_column($toyota['modelos'], 'nombre'), true), 'falta Corolla');
}

function test_crear_marca_y_modelo(): void
{
    $m = db_transaction(fn (PDO $p) => crear_marca($p, '  Marca   Prueba '));
    t_equals('Marca Prueba', $m['nombre']);
    t_throws(fn () => db_transaction(fn (PDO $p) => crear_marca($p, 'marca prueba')), 409);
    t_throws(fn () => db_transaction(fn (PDO $p) => crear_marca($p, '   ')), 400);

    $mo = db_transaction(fn (PDO $p) => crear_modelo($p, $m['id_marca'], 'Modelo X'));
    t_equals(['Modelo X', $m['id_marca']], [$mo['nombre'], $mo['id_marca']]);
    t_throws(fn () => db_transaction(fn (PDO $p) => crear_modelo($p, $m['id_marca'], 'MODELO x')), 409);
    t_throws(fn () => db_transaction(fn (PDO $p) => crear_modelo($p, 999999, 'Otro')), 404);
}

function test_validar_marca_modelo_usa_nombres_del_catalogo(): void
{
    t_equals(['Toyota', 'Corolla'], validar_marca_modelo('toyota', 'COROLLA'));
    t_throws(fn () => validar_marca_modelo('Toyota', 'Sentra'), 400);
    t_throws(fn () => validar_marca_modelo('NoExiste', 'Corolla'), 400);
    t_throws(fn () => validar_marca_modelo(null, 'Corolla'), 400);
}

// ── Piezas ───────────────────────────────────────────────────────────

function test_catalogo_piezas(): void
{
    t_assert(in_array('Faro', catalogo_piezas(), true), 'falta Faro');
    t_equals('Pieza Rara', db_transaction(fn (PDO $p) => crear_pieza_catalogo($p, ' Pieza  Rara ')));
    t_throws(fn () => db_transaction(fn (PDO $p) => crear_pieza_catalogo($p, 'faro')), 409);
}
