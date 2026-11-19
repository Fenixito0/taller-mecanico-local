<?php
// Piezas, cargos (mano de obra / extras) y datos de seguro de cada orden.
// Las funciones que reciben PDO escriben y deben llamarse dentro de db_transaction().
// Requiere includes/repositorio.php (ErrorNegocio, MAX_CANTIDAD).

declare(strict_types=1);

const TIPOS_ORDEN = ['seguro', 'particular'];
const ORIGENES_PIEZA = ['aseguradora', 'taller'];
const ESTADOS_PIEZA = ['pendiente', 'recibida', 'instalada', 'devuelta'];
const TIPOS_CARGO = ['mano_obra', 'extra'];
const SINIESTRO_MIN = 12;
const SINIESTRO_MAX = 16;
const MSG_SEGURO_SIN_EXTRAS = 'Las órdenes de seguro no llevan extras ni cobros aparte: si el cliente pide algo más, haz una orden particular';

/** Cambios de estado permitidos con cambiar_estado_pieza (la devolución va por devolver_pieza). */
const TRANSICIONES_PIEZA = [
    'pendiente' => ['recibida', 'instalada'],
    'recibida'  => ['instalada', 'pendiente'],
    'instalada' => ['recibida'],
    'devuelta'  => [],
];

// ── Validación ───────────────────────────────────────────────────────

function texto_requerido($valor, int $max, string $campo): string
{
    $t = trim((string) ($valor ?? ''));
    if ($t === '') {
        throw new ErrorNegocio("{$campo} es requerido", 400);
    }
    if (mb_strlen($t) > $max) {
        throw new ErrorNegocio("{$campo} admite máximo {$max} caracteres", 400);
    }
    return $t;
}

function monto_o_null($valor, string $campo): ?float
{
    if ($valor === null || $valor === '') {
        return null;
    }
    if (!is_numeric($valor) || (float) $valor < 0 || (float) $valor > 9999999) {
        throw new ErrorNegocio("{$campo} inválido", 400);
    }
    return round((float) $valor, 2);
}

/** Valida una pieza recibida del navegador y la deja lista para insertar. */
function normalizar_pieza(array $in, string $tipoOrden): array
{
    $nombre = texto_requerido($in['nombre'] ?? null, 100, 'El nombre de la pieza');
    $origen = $in['origen'] ?? ($tipoOrden === 'seguro' ? 'aseguradora' : 'taller');
    if (!in_array($origen, ORIGENES_PIEZA, true)) {
        throw new ErrorNegocio('Origen de pieza inválido', 400);
    }
    if ($tipoOrden === 'particular' && $origen === 'aseguradora') {
        throw new ErrorNegocio('En una orden particular las piezas las consigue el taller', 400);
    }
    $cantidad = (int) ($in['cantidad'] ?? 1);
    if ($cantidad < 1 || $cantidad > MAX_CANTIDAD) {
        throw new ErrorNegocio('Cantidad inválida', 400);
    }
    $precio = monto_o_null($in['precio_unitario'] ?? null, 'Precio');
    $esExtra = filter_var($in['es_extra'] ?? false, FILTER_VALIDATE_BOOLEAN);
    if ($tipoOrden === 'seguro' && ($esExtra || $precio !== null)) {
        throw new ErrorNegocio(MSG_SEGURO_SIN_EXTRAS, 400);
    }
    if ($esExtra && $precio === null) {
        throw new ErrorNegocio("La pieza extra \"{$nombre}\" debe llevar precio", 400);
    }
    if ($tipoOrden === 'particular' && $precio === null) {
        throw new ErrorNegocio("Indica el precio de la pieza \"{$nombre}\"", 400);
    }
    return [
        'nombre'          => $nombre,
        'lado'            => lado_a_bd($in['lado'] ?? null),
        'origen'          => $origen,
        'cantidad'        => $cantidad,
        'precio_unitario' => $precio,
        'es_extra'        => $esExtra,
    ];
}

function normalizar_cargo(array $in): array
{
    $tipo = $in['tipo'] ?? '';
    if (!in_array($tipo, TIPOS_CARGO, true)) {
        throw new ErrorNegocio('Tipo de cargo inválido', 400);
    }
    $concepto = texto_requerido($in['concepto'] ?? null, 150, 'El concepto');
    $monto = monto_o_null($in['monto'] ?? null, 'Monto');
    if ($monto === null || $monto <= 0) {
        throw new ErrorNegocio("El monto de \"{$concepto}\" debe ser mayor a cero", 400);
    }
    return ['tipo' => $tipo, 'concepto' => $concepto, 'monto' => $monto];
}

/** @param string[] $aseguradoras lista permitida */
function normalizar_seguro(array $in, array $aseguradoras): array
{
    $tipo = $in['tipo'] ?? 'particular';
    if (!in_array($tipo, TIPOS_ORDEN, true)) {
        throw new ErrorNegocio('Tipo de orden inválido', 400);
    }
    if ($tipo === 'particular') {
        return ['tipo' => 'particular', 'aseguradora' => null, 'num_siniestro' => null, 'deducible' => 0.0];
    }
    $aseg = trim((string) ($in['aseguradora'] ?? ''));
    if (!in_array($aseg, $aseguradoras, true)) {
        throw new ErrorNegocio('Selecciona una aseguradora válida', 400);
    }
    return [
        'tipo'          => 'seguro',
        'aseguradora'   => $aseg,
        'num_siniestro' => normalizar_siniestro($in['num_siniestro'] ?? null),
        'deducible'     => monto_o_null($in['deducible'] ?? 0, 'Deducible') ?? 0.0,
    ];
}

/** Número de siniestro: obligatorio, solo letras y números, de 12 a 16 caracteres. */
function normalizar_siniestro($valor): string
{
    $s = strtoupper(trim((string) ($valor ?? '')));
    if ($s === '') {
        throw new ErrorNegocio('El número de siniestro es obligatorio en órdenes de seguro', 400);
    }
    if (!preg_match('/^[A-Z0-9]{' . SINIESTRO_MIN . ',' . SINIESTRO_MAX . '}$/', $s)) {
        throw new ErrorNegocio('El número de siniestro debe tener de ' . SINIESTRO_MIN . ' a ' . SINIESTRO_MAX . ' letras y números (sin espacios ni guiones)', 400);
    }
    return $s;
}

/** @return string[] */
function aseguradoras(): array
{
    $row = db_one("SELECT valor FROM configuracion WHERE clave = 'aseguradoras'");
    $lista = $row ? json_decode((string) $row['valor'], true) : null;
    return is_array($lista) ? array_values(array_filter($lista, 'is_string')) : [];
}

/** Valida la lista de aseguradoras: textos de 1 a 60 caracteres, sin repetidos (sin importar mayúsculas). */
function normalizar_aseguradoras(array $lista): array
{
    if (count($lista) > 30) {
        throw new ErrorNegocio('Máximo 30 aseguradoras', 400);
    }
    $vistas = [];
    $out = [];
    foreach ($lista as $a) {
        if (!is_string($a)) {
            throw new ErrorNegocio('Nombre de aseguradora inválido', 400);
        }
        $nombre = texto_requerido($a, 60, 'El nombre de la aseguradora');
        $clave = mb_strtolower($nombre);
        if (isset($vistas[$clave])) {
            throw new ErrorNegocio("La aseguradora \"{$nombre}\" está repetida", 400);
        }
        $vistas[$clave] = true;
        $out[] = $nombre;
    }
    return $out;
}

function guardar_aseguradoras(PDO $pdo, array $lista): void
{
    $json = json_encode(array_values($lista), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $pdo->prepare("INSERT INTO configuracion (clave, valor) VALUES ('aseguradoras', ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)")->execute([$json]);
}

// ── Escritura ────────────────────────────────────────────────────────

function crear_orden(PDO $pdo, int $idVehiculo, string $rfc, ?string $obs, ?int $km, array $seguro, array $piezas, array $cargos, ?int $idUsuario): int
{
    if ($seguro['tipo'] === 'seguro' && $cargos !== []) {
        throw new ErrorNegocio(MSG_SEGURO_SIN_EXTRAS, 400);
    }
    $pdo->prepare("INSERT INTO ordenservicio (id_vehiculo, rfc_cliente, id_usuario, fecha_creacion, estado, etapa, kilometraje, observaciones, tipo, aseguradora, num_siniestro, deducible)
                   VALUES (?, ?, ?, ?, 'pendiente', 'recibido', ?, ?, ?, ?, ?, ?)")
        ->execute([$idVehiculo, $rfc, $idUsuario, now_utc(), $km, $obs, $seguro['tipo'], $seguro['aseguradora'], $seguro['num_siniestro'], $seguro['deducible']]);
    $oid = (int) $pdo->lastInsertId();
    foreach ($piezas as $p) {
        insertar_pieza($pdo, $oid, $p, null);
    }
    foreach ($cargos as $c) {
        insertar_cargo($pdo, $oid, $c);
    }
    return $oid;
}

/** Bloquea la orden y verifica que siga pendiente. */
function orden_abierta_o_falla(PDO $pdo, int $idOrden): array
{
    $st = $pdo->prepare('SELECT * FROM ordenservicio WHERE id_orden = ? FOR UPDATE');
    $st->execute([$idOrden]);
    $o = $st->fetch();
    if (!$o) {
        throw new ErrorNegocio('Orden no encontrada', 404);
    }
    if ($o['estado'] !== 'pendiente') {
        throw new ErrorNegocio('La orden ya no se puede modificar', 409);
    }
    return $o;
}

/** Pieza bloqueada junto con su orden (que debe seguir pendiente). */
function pieza_editable_o_falla(PDO $pdo, int $idPieza): array
{
    $st = $pdo->prepare('SELECT * FROM orden_pieza WHERE id_pieza = ?');
    $st->execute([$idPieza]);
    $p = $st->fetch();
    if (!$p) {
        throw new ErrorNegocio('Pieza no encontrada', 404);
    }
    orden_abierta_o_falla($pdo, (int) $p['id_orden']);
    $st = $pdo->prepare('SELECT * FROM orden_pieza WHERE id_pieza = ? FOR UPDATE');
    $st->execute([$idPieza]);
    return $st->fetch();
}

function insertar_pieza(PDO $pdo, int $idOrden, array $p, ?int $idReemplaza): int
{
    $pdo->prepare('INSERT INTO orden_pieza (id_orden, nombre, lado, origen, estado, cantidad, precio_unitario, es_extra, id_reemplaza, fecha_estado)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$idOrden, $p['nombre'], $p['lado'], $p['origen'], 'pendiente', $p['cantidad'], $p['precio_unitario'], $p['es_extra'] ? 1 : 0, $idReemplaza, now_utc()]);
    return (int) $pdo->lastInsertId();
}

function insertar_cargo(PDO $pdo, int $idOrden, array $c): int
{
    $pdo->prepare('INSERT INTO orden_cargo (id_orden, tipo, concepto, monto) VALUES (?, ?, ?, ?)')
        ->execute([$idOrden, $c['tipo'], $c['concepto'], $c['monto']]);
    return (int) $pdo->lastInsertId();
}

function agregar_pieza(PDO $pdo, int $idOrden, array $pieza): int
{
    orden_abierta_o_falla($pdo, $idOrden);
    return insertar_pieza($pdo, $idOrden, $pieza, null);
}

function eliminar_pieza(PDO $pdo, int $idPieza): void
{
    $p = pieza_editable_o_falla($pdo, $idPieza);
    if ($p['estado'] !== 'pendiente') {
        throw new ErrorNegocio('Solo se pueden quitar piezas que aún no llegan', 409);
    }
    $pdo->prepare('DELETE FROM orden_pieza WHERE id_pieza = ?')->execute([$idPieza]);
}

function cambiar_estado_pieza(PDO $pdo, int $idPieza, string $estado): void
{
    if (!in_array($estado, ESTADOS_PIEZA, true)) {
        throw new ErrorNegocio('Estado de pieza inválido', 400);
    }
    $p = pieza_editable_o_falla($pdo, $idPieza);
    if (!in_array($estado, TRANSICIONES_PIEZA[$p['estado']], true)) {
        throw new ErrorNegocio("La pieza no puede pasar de \"{$p['estado']}\" a \"{$estado}\"", 409);
    }
    $pdo->prepare('UPDATE orden_pieza SET estado = ?, fecha_estado = ? WHERE id_pieza = ?')->execute([$estado, now_utc(), $idPieza]);
}

/** Cambia el precio que se le cobra al cliente (null = no se cobra; no permitido en particular ni en extras). */
function actualizar_precio_pieza(PDO $pdo, int $idPieza, ?float $precio): void
{
    $precio = monto_o_null($precio, 'Precio');
    $p = pieza_editable_o_falla($pdo, $idPieza);
    $tipo = db_one('SELECT tipo FROM ordenservicio WHERE id_orden = ?', [$p['id_orden']])['tipo'] ?? 'particular';
    if ($tipo === 'seguro' && $precio !== null) {
        throw new ErrorNegocio(MSG_SEGURO_SIN_EXTRAS, 400);
    }
    if ($precio === null) {
        if ($tipo === 'particular' || (int) $p['es_extra'] === 1) {
            throw new ErrorNegocio("La pieza \"{$p['nombre']}\" debe llevar precio", 400);
        }
    }
    $pdo->prepare('UPDATE orden_pieza SET precio_unitario = ? WHERE id_pieza = ?')->execute([$precio, $idPieza]);
}

/** Marca la pieza como devuelta y crea su reemplazo pendiente. Devuelve el id del reemplazo. */
function devolver_pieza(PDO $pdo, int $idPieza, string $motivo): int
{
    $motivo = texto_requerido($motivo, 200, 'El motivo de la devolución');
    $p = pieza_editable_o_falla($pdo, $idPieza);
    if (!in_array($p['estado'], ['pendiente', 'recibida'], true)) {
        throw new ErrorNegocio('Solo se pueden devolver piezas pendientes o recibidas', 409);
    }
    $pdo->prepare("UPDATE orden_pieza SET estado = 'devuelta', motivo_devolucion = ?, fecha_estado = ? WHERE id_pieza = ?")
        ->execute([$motivo, now_utc(), $idPieza]);
    return insertar_pieza($pdo, (int) $p['id_orden'], [
        'nombre'          => $p['nombre'],
        'lado'            => $p['lado'],
        'origen'          => $p['origen'],
        'cantidad'        => (int) $p['cantidad'],
        'precio_unitario' => $p['precio_unitario'] !== null ? (float) $p['precio_unitario'] : null,
        'es_extra'        => (bool) $p['es_extra'],
    ], $idPieza);
}

function agregar_cargo(PDO $pdo, int $idOrden, array $cargo): int
{
    $o = orden_abierta_o_falla($pdo, $idOrden);
    if ($o['tipo'] === 'seguro') {
        throw new ErrorNegocio(MSG_SEGURO_SIN_EXTRAS, 400);
    }
    return insertar_cargo($pdo, $idOrden, $cargo);
}

function eliminar_cargo(PDO $pdo, int $idCargo): void
{
    $c = db_one('SELECT id_orden FROM orden_cargo WHERE id_cargo = ?', [$idCargo]);
    if ($c === null) {
        throw new ErrorNegocio('Cargo no encontrado', 404);
    }
    orden_abierta_o_falla($pdo, (int) $c['id_orden']);
    $pdo->prepare('DELETE FROM orden_cargo WHERE id_cargo = ?')->execute([$idCargo]);
}

function actualizar_seguro(PDO $pdo, int $idOrden, array $seguro): void
{
    $o = orden_abierta_o_falla($pdo, $idOrden);
    if ($o['tipo'] === 'particular' && $seguro['tipo'] === 'seguro') {
        validar_paso_a_seguro($pdo, $idOrden);
        // Las piezas que se iban a cobrar al cliente ahora las paga la aseguradora
        $pdo->prepare("UPDATE orden_pieza SET precio_unitario = NULL WHERE id_orden = ? AND estado <> 'devuelta'")->execute([$idOrden]);
    }
    $pdo->prepare('UPDATE ordenservicio SET tipo = ?, aseguradora = ?, num_siniestro = ?, deducible = ? WHERE id_orden = ?')
        ->execute([$seguro['tipo'], $seguro['aseguradora'], $seguro['num_siniestro'], $seguro['deducible'], $idOrden]);
    if ($o['tipo'] === 'seguro' && $seguro['tipo'] === 'particular') {
        $pdo->prepare("UPDATE orden_pieza SET origen = 'taller', precio_unitario = IF(es_extra = 1, precio_unitario, NULL) WHERE id_orden = ? AND origen = 'aseguradora'")
            ->execute([$idOrden]);
    }
}

/** Una orden particular solo pasa a seguro si no tiene mano de obra, extras ni piezas extra. */
function validar_paso_a_seguro(PDO $pdo, int $idOrden): void
{
    $st = $pdo->prepare('SELECT COUNT(*) FROM orden_cargo WHERE id_orden = ?');
    $st->execute([$idOrden]);
    $cargos = (int) $st->fetchColumn();
    $st = $pdo->prepare("SELECT COUNT(*) FROM orden_pieza WHERE id_orden = ? AND es_extra = 1 AND estado <> 'devuelta'");
    $st->execute([$idOrden]);
    $extras = (int) $st->fetchColumn();
    if ($cargos > 0 || $extras > 0) {
        throw new ErrorNegocio('Para cambiarla a seguro primero quita la mano de obra, los extras y las piezas extra (deben ir en una orden particular)', 409);
    }
}

// ── Lectura ──────────────────────────────────────────────────────────

function pieza_json(array $r): array
{
    return [
        'id_pieza'          => (int) $r['id_pieza'],
        'id_orden'          => (int) $r['id_orden'],
        'nombre'            => $r['nombre'],
        'lado'              => lado_a_cliente($r['lado']),
        'origen'            => $r['origen'],
        'estado'            => $r['estado'],
        'cantidad'          => (int) $r['cantidad'],
        'precio_unitario'   => $r['precio_unitario'] !== null ? (float) $r['precio_unitario'] : null,
        'es_extra'          => (bool) $r['es_extra'],
        'id_reemplaza'      => $r['id_reemplaza'] !== null ? (int) $r['id_reemplaza'] : null,
        'motivo_devolucion' => $r['motivo_devolucion'],
        'fecha_estado'      => iso_utc($r['fecha_estado']),
    ];
}

/** @return array<int, array> id_orden => piezas */
function piezas_por_orden(array $ids): array
{
    if (!$ids) {
        return [];
    }
    $marcas = implode(',', array_fill(0, count($ids), '?'));
    $map = [];
    foreach (db_all("SELECT * FROM orden_pieza WHERE id_orden IN ($marcas) ORDER BY id_pieza", array_map('intval', $ids)) as $r) {
        $map[(int) $r['id_orden']][] = pieza_json($r);
    }
    return $map;
}

/** @return array<int, array> id_orden => cargos */
function cargos_por_orden(array $ids): array
{
    if (!$ids) {
        return [];
    }
    $marcas = implode(',', array_fill(0, count($ids), '?'));
    $map = [];
    foreach (db_all("SELECT * FROM orden_cargo WHERE id_orden IN ($marcas) ORDER BY id_cargo", array_map('intval', $ids)) as $r) {
        $map[(int) $r['id_orden']][] = [
            'id_cargo' => (int) $r['id_cargo'],
            'id_orden' => (int) $r['id_orden'],
            'tipo'     => $r['tipo'],
            'concepto' => $r['concepto'],
            'monto'    => (float) $r['monto'],
        ];
    }
    return $map;
}

/** Piezas que impiden cobrar (aún no instaladas). */
function piezas_bloqueantes(int $idOrden): array
{
    return array_map('pieza_json', db_all(
        "SELECT * FROM orden_pieza WHERE id_orden = ? AND estado IN ('pendiente','recibida') ORDER BY id_pieza",
        [$idOrden]
    ));
}

/**
 * Piezas por atender de órdenes pendientes. Sin filtro de estado: pendientes, recibidas
 * y devueltas cuyo reemplazo no está instalado.
 */
function tablero_piezas(?string $estado, ?string $aseguradora): array
{
    $where = ["o.estado = 'pendiente'"];
    $params = [];
    if ($estado !== null && in_array($estado, ESTADOS_PIEZA, true)) {
        $where[] = 'p.estado = ?';
        $params[] = $estado;
    } else {
        $where[] = "(p.estado IN ('pendiente','recibida') OR (p.estado = 'devuelta' AND NOT EXISTS (
            SELECT 1 FROM orden_pieza r WHERE r.id_reemplaza = p.id_pieza AND r.estado = 'instalada')))";
    }
    if ($aseguradora !== null && $aseguradora !== '') {
        $where[] = 'o.aseguradora = ?';
        $params[] = $aseguradora;
    }
    $rows = db_all(
        'SELECT p.*, o.tipo, o.aseguradora, v.placas, v.marca, v.modelo, v.anio, c.nombre AS c_nombre, c.apellido_paterno,
                TIMESTAMPDIFF(DAY, p.fecha_estado, UTC_TIMESTAMP()) AS dias
         FROM orden_pieza p
         JOIN ordenservicio o ON o.id_orden = p.id_orden
         JOIN vehiculo v ON v.id_vehiculo = o.id_vehiculo
         JOIN cliente c ON c.rfc = o.rfc_cliente
         WHERE ' . implode(' AND ', $where) . '
         ORDER BY p.fecha_estado, p.id_pieza
         LIMIT 1000',
        $params
    );
    return array_map(static fn (array $r): array => pieza_json($r) + [
        'tipo'        => $r['tipo'],
        'aseguradora' => $r['aseguradora'],
        'placas'      => $r['placas'],
        'vehiculo'    => trim(($r['marca'] ?? '') . " {$r['modelo']} {$r['anio']}"),
        'cliente'     => trim("{$r['c_nombre']} {$r['apellido_paterno']}"),
        'dias'        => (int) $r['dias'],
    ], $rows);
}

/** Nombres de piezas usados antes que contienen el texto (más usados primero). */
function nombres_pieza(string $q, int $limite = 10): array
{
    $q = trim($q);
    if ($q === '') {
        return [];
    }
    $like = '%' . addcslashes($q, '%_\\') . '%';
    return array_column(db_all(
        'SELECT nombre FROM orden_pieza WHERE nombre LIKE ? GROUP BY nombre ORDER BY COUNT(*) DESC, nombre LIMIT ' . max(1, min(30, $limite)),
        [$like]
    ), 'nombre');
}
