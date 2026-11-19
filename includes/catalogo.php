<?php
// Catálogos (marcas, modelos, piezas) y validación de placas.
// Las funciones que reciben PDO escriben y deben llamarse dentro de db_transaction().
// Requiere includes/repositorio.php (ErrorNegocio) e includes/piezas.php (texto_requerido).

declare(strict_types=1);

/** Placas de autos en México: 6 o 7 letras y números (sin contar guiones ni espacios). */
const PLACAS_MIN = 6;
const PLACAS_MAX = 7;

/** Quita guiones/espacios, pasa a mayúsculas y valida el formato. */
function normalizar_placas(?string $placas): string
{
    $p = strtoupper((string) preg_replace('/[\s-]+/', '', (string) $placas));
    if (!preg_match('/^[A-Z0-9]{' . PLACAS_MIN . ',' . PLACAS_MAX . '}$/', $p)) {
        throw new ErrorNegocio('Las placas deben tener de ' . PLACAS_MIN . ' a ' . PLACAS_MAX . ' letras y números (sin contar guiones)', 400);
    }
    if (!preg_match('/[A-Z]/', $p) || !preg_match('/\d/', $p)) {
        throw new ErrorNegocio('Las placas deben combinar letras y números', 400);
    }
    return $p;
}

/** ¿Ya existe un vehículo con esas placas? Compara sin guiones ni espacios (registros viejos los traen). */
function placas_registradas(string $placasNormalizadas): bool
{
    return db_one(
        "SELECT 1 FROM vehiculo WHERE UPPER(REPLACE(REPLACE(placas, '-', ''), ' ', '')) = ?",
        [$placasNormalizadas]
    ) !== null;
}

/** Texto requerido con espacios internos colapsados. */
function nombre_catalogo($valor, int $max, string $campo): string
{
    return texto_requerido(preg_replace('/\s+/u', ' ', trim((string) ($valor ?? ''))), $max, $campo);
}

// ── Lectura ──────────────────────────────────────────────────────────

/** @return array<int, array{id_marca:int, nombre:string, modelos:array<int, array{id_modelo:int, nombre:string}>}> */
function catalogo_marcas(): array
{
    $modelos = [];
    foreach (db_all('SELECT id_modelo, id_marca, nombre FROM modelo ORDER BY nombre') as $m) {
        $modelos[(int) $m['id_marca']][] = ['id_modelo' => (int) $m['id_modelo'], 'nombre' => $m['nombre']];
    }
    return array_map(static fn (array $m): array => [
        'id_marca' => (int) $m['id_marca'],
        'nombre'   => $m['nombre'],
        'modelos'  => $modelos[(int) $m['id_marca']] ?? [],
    ], db_all('SELECT id_marca, nombre FROM marca ORDER BY nombre'));
}

/** @return string[] */
function catalogo_piezas(): array
{
    return array_column(db_all('SELECT nombre FROM pieza_catalogo ORDER BY nombre'), 'nombre');
}

/**
 * Valida que marca y modelo existan en el catálogo (sin importar mayúsculas/acentos)
 * y devuelve los nombres tal como están escritos en el catálogo.
 * @return array{0:string, 1:string}
 */
function validar_marca_modelo(?string $marca, ?string $modelo): array
{
    $m = db_one('SELECT id_marca, nombre FROM marca WHERE nombre = ?', [trim((string) $marca)]);
    if ($m === null) {
        throw new ErrorNegocio('Selecciona una marca de la lista (o agrégala si no existe)', 400);
    }
    $mo = db_one('SELECT nombre FROM modelo WHERE id_marca = ? AND nombre = ?', [$m['id_marca'], trim((string) $modelo)]);
    if ($mo === null) {
        throw new ErrorNegocio("Selecciona un modelo de {$m['nombre']} de la lista (o agrégalo si no existe)", 400);
    }
    return [$m['nombre'], $mo['nombre']];
}

// ── Escritura ────────────────────────────────────────────────────────

/** @return array{id_marca:int, nombre:string} */
function crear_marca(PDO $pdo, $nombre): array
{
    $nombre = nombre_catalogo($nombre, 60, 'El nombre de la marca');
    $st = $pdo->prepare('SELECT nombre FROM marca WHERE nombre = ?');
    $st->execute([$nombre]);
    if ($existente = $st->fetchColumn()) {
        throw new ErrorNegocio("La marca \"{$existente}\" ya existe", 409);
    }
    $pdo->prepare('INSERT INTO marca (nombre) VALUES (?)')->execute([$nombre]);
    return ['id_marca' => (int) $pdo->lastInsertId(), 'nombre' => $nombre];
}

/** @return array{id_modelo:int, id_marca:int, nombre:string} */
function crear_modelo(PDO $pdo, int $idMarca, $nombre): array
{
    $nombre = nombre_catalogo($nombre, 100, 'El nombre del modelo');
    $st = $pdo->prepare('SELECT nombre FROM marca WHERE id_marca = ?');
    $st->execute([$idMarca]);
    $marca = $st->fetchColumn();
    if ($marca === false) {
        throw new ErrorNegocio('Marca no encontrada', 404);
    }
    $st = $pdo->prepare('SELECT nombre FROM modelo WHERE id_marca = ? AND nombre = ?');
    $st->execute([$idMarca, $nombre]);
    if ($existente = $st->fetchColumn()) {
        throw new ErrorNegocio("El modelo \"{$existente}\" de {$marca} ya existe", 409);
    }
    $pdo->prepare('INSERT INTO modelo (id_marca, nombre) VALUES (?, ?)')->execute([$idMarca, $nombre]);
    return ['id_modelo' => (int) $pdo->lastInsertId(), 'id_marca' => $idMarca, 'nombre' => $nombre];
}

function crear_pieza_catalogo(PDO $pdo, $nombre): string
{
    $nombre = nombre_catalogo($nombre, 100, 'El nombre de la pieza');
    $st = $pdo->prepare('SELECT nombre FROM pieza_catalogo WHERE nombre = ?');
    $st->execute([$nombre]);
    if ($existente = $st->fetchColumn()) {
        throw new ErrorNegocio("La pieza \"{$existente}\" ya existe", 409);
    }
    $pdo->prepare('INSERT INTO pieza_catalogo (nombre) VALUES (?)')->execute([$nombre]);
    return $nombre;
}
