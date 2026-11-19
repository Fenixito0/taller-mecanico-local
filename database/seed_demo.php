<?php
// Llena la base con datos de prueba: 10 clientes con su vehículo y 10 órdenes
// (6 de seguro repartidas entre las aseguradoras y 4 particulares) con piezas en todos los estados.
// Solo se ejecuta desde la consola y solo si no hay clientes registrados:
//
//   C:\xampp\php\php.exe database\seed_demo.php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$GLOBALS['APP_CONFIG'] = require __DIR__ . '/../includes/config.php';
date_default_timezone_set($GLOBALS['APP_CONFIG']['timezone']);
function config(string $key)
{
    return $GLOBALS['APP_CONFIG'][$key] ?? null;
}
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/helpers.php';
require __DIR__ . '/../includes/repositorio.php';

if ((int) db_one('SELECT COUNT(*) n FROM cliente')['n'] > 0) {
    fwrite(STDERR, "Ya hay clientes registrados; no se insertó nada para no mezclar datos.\n");
    exit(1);
}

$usuarios = array_map('intval', array_column(db_all('SELECT id_usuario FROM usuario WHERE activo = 1'), 'id_usuario'));
if (!$usuarios) {
    fwrite(STDERR, "Primero crea un usuario con database/crear_usuario.php\n");
    exit(1);
}
$aseguradoras = aseguradoras();
if (!$aseguradoras) {
    fwrite(STDERR, "No hay aseguradoras configuradas; aplica database/migracion_v3.sql\n");
    exit(1);
}

function pick(array $a)
{
    return $a[array_rand($a)];
}

function fecha_utc(int $diasAtras): string
{
    return gmdate('Y-m-d H:i:s', time() - $diasAtras * 86400 - random_int(0, 8 * 3600));
}

function sin_acentos(string $s): string
{
    return strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', 'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U']);
}

function rfc_aleatorio(string $paterno, string $materno, string $nombre): string
{
    $p = strtoupper(sin_acentos($paterno));
    $base = $p[0] . ($p[1] ?? 'X') . strtoupper(sin_acentos($materno))[0] . strtoupper(sin_acentos($nombre))[0];
    $fecha = sprintf('%02d%02d%02d', random_int(60, 99), random_int(1, 12), random_int(1, 28));
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    $homo = '';
    for ($i = 0; $i < 3; $i++) {
        $homo .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $base . $fecha . $homo;
}

function placas_aleatorias(): string
{
    $l = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    return $l[random_int(0, 22)] . $l[random_int(0, 22)] . $l[random_int(0, 22)] . '-' . random_int(100, 999) . '-' . $l[random_int(0, 22)];
}

const NOMBRES = ['Juan', 'María', 'José', 'Guadalupe', 'Luis', 'Ana', 'Carlos', 'Sofía', 'Miguel', 'Fernanda', 'Jorge', 'Daniela', 'Ricardo', 'Paola'];
const APELLIDOS = ['García', 'Hernández', 'López', 'Martínez', 'González', 'Rodríguez', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz'];
const AUTOS = [['Nissan', 'Versa'], ['Chevrolet', 'Aveo'], ['Volkswagen', 'Jetta'], ['Toyota', 'Corolla'], ['Honda', 'Civic'],
    ['Ford', 'Ranger'], ['Mazda', '3'], ['Kia', 'Rio'], ['Volkswagen', 'Vento'], ['Chevrolet', 'Spark']];
const COLORES = ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Arena'];
const METODOS = ['efectivo', 'tarjeta', 'transferencia'];

/**
 * Guion de las 10 órdenes. Estados finales de cada pieza: pendiente | recibida | instalada | devolver (devuelta + reemplazo pendiente).
 * 'final': completado (se cobra), pendiente o cancelado.
 */
const ORDENES = [
    ['tipo' => 'seguro', 'final' => 'completado', 'obs' => 'Choque frontal', 'deducible' => 6500,
     'piezas' => [['Defensa delantera', 'central', 'instalada'], ['Faro', 'izquierdo', 'instalada'], ['Parrilla', 'central', 'instalada']],
     'extras' => [['Pintura completa del vehículo', 4500]]],
    ['tipo' => 'seguro', 'final' => 'completado', 'obs' => 'Golpe en puerta trasera', 'deducible' => 4200,
     'piezas' => [['Puerta trasera', 'derecho', 'instalada'], ['Moldura de puerta', 'derecho', 'instalada']], 'extras' => []],
    ['tipo' => 'seguro', 'final' => 'pendiente', 'obs' => 'Alcance por detrás', 'deducible' => 5000,
     'piezas' => [['Defensa trasera', 'central', 'pendiente'], ['Calavera', 'izquierdo', 'recibida'], ['Cajuela', 'central', 'pendiente']],
     'extras' => [['Pulido de faros', 600]]],
    ['tipo' => 'seguro', 'final' => 'pendiente', 'obs' => 'Golpe lateral izquierdo', 'deducible' => 5500,
     'piezas' => [['Espejo lateral', 'izquierdo', 'devolver'], ['Salpicadera', 'izquierdo', 'instalada']], 'extras' => []],
    ['tipo' => 'seguro', 'final' => 'pendiente', 'obs' => 'Cofre y faro dañados', 'deducible' => 3800, 'anticipo' => 1000,
     'piezas' => [['Cofre', 'central', 'instalada'], ['Faro', 'derecho', 'instalada']], 'extras' => [['Cambio de tapetes', 900]]],
    ['tipo' => 'seguro', 'final' => 'cancelado', 'obs' => 'Cliente decidió no reparar', 'deducible' => 4000,
     'piezas' => [['Parabrisas', 'central', 'pendiente']], 'extras' => []],
    ['tipo' => 'particular', 'final' => 'completado', 'obs' => 'Reparación de defensa y pintura', 'mano_obra' => 2500,
     'piezas' => [['Defensa delantera', 'central', 'instalada', 3200], ['Rejilla de niebla', 'izquierdo', 'instalada', 450]],
     'extras' => [['Encerado', 700]], 'descuento' => 10],
    ['tipo' => 'particular', 'final' => 'completado', 'obs' => 'Cambio de espejo', 'mano_obra' => 600,
     'piezas' => [['Espejo lateral', 'derecho', 'instalada', 1450]], 'extras' => []],
    ['tipo' => 'particular', 'final' => 'pendiente', 'obs' => 'Hojalatería en salpicadera', 'mano_obra' => 3000,
     'piezas' => [['Salpicadera', 'derecho', 'recibida', 2100]], 'extras' => []],
    ['tipo' => 'particular', 'final' => 'pendiente', 'obs' => 'Pintura de cofre (sin piezas)', 'mano_obra' => 2800,
     'piezas' => [], 'extras' => [], 'anticipo' => 1500],
];

/** Lleva cada pieza a su estado final con las mismas reglas que usa el sistema. */
function aplicar_estados(PDO $pdo, int $idOrden, array $guion): void
{
    $ids = array_column(db_all('SELECT id_pieza FROM orden_pieza WHERE id_orden = ? ORDER BY id_pieza', [$idOrden]), 'id_pieza');
    foreach ($guion as $i => $p) {
        $estado = $p[2];
        $id = (int) $ids[$i];
        if ($estado === 'devolver') {
            devolver_pieza($pdo, $id, 'Llegó con un golpe; se pidió otra');
        } elseif ($estado !== 'pendiente') {
            cambiar_estado_pieza($pdo, $id, $estado);
        }
    }
}

$resumen = db_transaction(static function (PDO $pdo) use ($usuarios, $aseguradoras): array {
    $insCli = $pdo->prepare('INSERT INTO cliente (rfc, nombre, apellido_paterno, apellido_materno, telefono, correo, fecha_registro) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $insVeh = $pdo->prepare('INSERT INTO vehiculo (marca, modelo, anio, color, placas) VALUES (?, ?, ?, ?, ?)');
    $insVc = $pdo->prepare('INSERT INTO vehiculocliente (id_vehiculo, rfc_cliente, fecha) VALUES (?, ?, ?)');
    $insPago = $pdo->prepare('INSERT INTO pago (id_orden, tipo, monto, metodo, fecha, id_usuario) VALUES (?, ?, ?, ?, ?, ?)');
    $insVenta = $pdo->prepare("INSERT INTO venta (id_orden, rfc_cliente, subtotal, piezas, mano_obra, extras, deducible, descuento, iva, precio_total, anticipo, metodo_pago, estado_pago, fecha_venta)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pagado', ?)");
    $conteo = ['seguro' => 0, 'particular' => 0, 'completado' => 0, 'pendiente' => 0, 'cancelado' => 0, 'piezas' => 0, 'ventas' => 0, 'pagos' => 0];
    $rfcs = [];
    $placas = [];

    foreach (ORDENES as $n => $g) {
        // Cliente y vehículo
        do {
            [$nombre, $pat, $mat] = [pick(NOMBRES), pick(APELLIDOS), pick(APELLIDOS)];
            $rfc = rfc_aleatorio($pat, $mat, $nombre);
        } while (isset($rfcs[$rfc]));
        $rfcs[$rfc] = true;
        $correo = strtolower(sin_acentos("{$nombre}.{$pat}")) . random_int(1, 99) . '@ejemplo.com';
        $insCli->execute([$rfc, $nombre, $pat, $mat, '669' . random_int(1000000, 9999999), $correo, fecha_utc(random_int(40, 90))]);
        do {
            $pl = placas_aleatorias();
        } while (isset($placas[$pl]));
        $placas[$pl] = true;
        [$marca, $modelo] = AUTOS[$n % count(AUTOS)];
        $insVeh->execute([$marca, $modelo, random_int(2012, 2024), pick(COLORES), $pl]);
        $idV = (int) $pdo->lastInsertId();
        $insVc->execute([$idV, $rfc, fecha_utc(random_int(35, 40))]);

        // Orden con sus piezas y cargos
        $esSeguro = $g['tipo'] === 'seguro';
        $seguro = normalizar_seguro($esSeguro
            ? ['tipo' => 'seguro', 'aseguradora' => $aseguradoras[$conteo['seguro'] % count($aseguradoras)],
               'num_siniestro' => (string) random_int(1000000, 9999999), 'deducible' => $g['deducible']]
            : ['tipo' => 'particular'], $aseguradoras);
        $piezas = array_map(static fn (array $p): array => normalizar_pieza(
            ['nombre' => $p[0], 'lado' => $p[1], 'origen' => $esSeguro ? 'aseguradora' : 'taller', 'cantidad' => 1, 'precio_unitario' => $p[3] ?? null],
            $g['tipo']), $g['piezas']);
        $cargos = array_map(static fn (array $e): array => normalizar_cargo(['tipo' => 'extra', 'concepto' => $e[0], 'monto' => $e[1]]), $g['extras']);
        if (!empty($g['mano_obra'])) {
            array_unshift($cargos, normalizar_cargo(['tipo' => 'mano_obra', 'concepto' => 'Mano de obra', 'monto' => $g['mano_obra']]));
        }
        $usuario = pick($usuarios);
        $idOrden = crear_orden($pdo, $idV, $rfc, $g['obs'], random_int(15000, 220000), $seguro, $piezas, $cargos, $usuario);
        aplicar_estados($pdo, $idOrden, $g['piezas']);

        $dias = random_int(2, 25);
        $fecha = fecha_utc($dias);
        $etapa = $g['final'] === 'completado' ? 'listo' : ($g['final'] === 'pendiente' ? pick(['recibido', 'reparacion', 'listo']) : 'recibido');
        $pdo->prepare('UPDATE ordenservicio SET fecha_creacion = ?, estado = ?, etapa = ? WHERE id_orden = ?')->execute([$fecha, $g['final'], $etapa, $idOrden]);
        $conteo[$g['tipo']]++;
        $conteo[$g['final']]++;
        $conteo['piezas'] += count($g['piezas']);

        $anticipo = (float) ($g['anticipo'] ?? 0);
        if ($anticipo > 0) {
            $insPago->execute([$idOrden, 'anticipo', $anticipo, pick(METODOS), $fecha, $usuario]);
            $conteo['pagos']++;
        }

        if ($g['final'] === 'completado') {
            if (piezas_bloqueantes($idOrden)) {
                throw new RuntimeException("La orden demo #{$idOrden} tiene piezas sin instalar");
            }
            $k = calcular_cobro($g['tipo'], piezas_por_orden([$idOrden])[$idOrden] ?? [], cargos_por_orden([$idOrden])[$idOrden] ?? [],
                $seguro['deducible'], 'porcentaje', (float) ($g['descuento'] ?? 0), true, $anticipo);
            $metodo = pick(METODOS);
            $fechaVenta = fecha_utc(max(0, $dias - random_int(1, $dias)));
            $insVenta->execute([$idOrden, $rfc, $k['piezas'], $k['piezas'], $k['mano_obra'], $k['extras'], $k['deducible'], $k['descuento'],
                $k['iva'], $k['total'], $anticipo, $metodo, $fechaVenta]);
            if ($k['restante'] > 0) {
                $insPago->execute([$idOrden, 'liquidacion', $k['restante'], $metodo, $fechaVenta, $usuario]);
                $conteo['pagos']++;
            }
            $conteo['ventas']++;
        }
    }
    return $conteo;
});

printf(
    "Listo: 10 clientes y vehículos; 10 órdenes (%d de seguro, %d particulares: %d completadas, %d pendientes, %d cancelada) con %d piezas; %d ventas y %d pagos.\n",
    $resumen['seguro'], $resumen['particular'], $resumen['completado'], $resumen['pendiente'], $resumen['cancelado'],
    $resumen['piezas'], $resumen['ventas'], $resumen['pagos']
);
