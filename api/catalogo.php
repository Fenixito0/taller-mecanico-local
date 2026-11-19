<?php
// GET  api/catalogo.php   → {marcas: [{id_marca, nombre, modelos: [{id_modelo, nombre}]}], piezas: [nombre]}
// POST api/catalogo.php   → agregar al catálogo:
//        {tipo: 'marca',  nombre}
//        {tipo: 'modelo', id_marca, nombre}
//        {tipo: 'pieza',  nombre}

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/repositorio.php';
require_api_auth();

try {
    $metodo = request_method();

    if ($metodo === 'GET') {
        json_out(['marcas' => catalogo_marcas(), 'piezas' => catalogo_piezas()]);
    }

    if ($metodo === 'POST') {
        $body = read_json_body();
        $tipo = $body['tipo'] ?? '';
        if ($tipo === 'marca') {
            $m = db_transaction(static fn (PDO $pdo): array => crear_marca($pdo, $body['nombre'] ?? null));
            registrar_auditoria("Agregó la marca {$m['nombre']} al catálogo", 'vehiculos');
            json_out($m, 201);
        }
        if ($tipo === 'modelo') {
            $m = db_transaction(static fn (PDO $pdo): array => crear_modelo($pdo, (int) ($body['id_marca'] ?? 0), $body['nombre'] ?? null));
            registrar_auditoria("Agregó el modelo {$m['nombre']} al catálogo", 'vehiculos');
            json_out($m, 201);
        }
        if ($tipo === 'pieza') {
            $n = db_transaction(static fn (PDO $pdo): string => crear_pieza_catalogo($pdo, $body['nombre'] ?? null));
            registrar_auditoria("Agregó la pieza {$n} al catálogo", 'ordenes');
            json_out(['nombre' => $n], 201);
        }
        json_error('Tipo de catálogo inválido', 400);
    }

    json_error('Método no permitido', 405);
} catch (ErrorNegocio $e) {
    json_error($e->getMessage(), $e->getCode() ?: 400);
} catch (Throwable $e) {
    log_error('API catálogo', $e);
    json_error('Error al procesar el catálogo', 500);
}
