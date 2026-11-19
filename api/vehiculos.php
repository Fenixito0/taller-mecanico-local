<?php
// GET    api/vehiculos.php[?rfc=XXX]   → lista (opcionalmente filtrada por cliente)
// POST   api/vehiculos.php             → crear
// PUT    api/vehiculos.php?id=N        → actualizar
// DELETE api/vehiculos.php?id=N        → eliminar

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/repositorio.php';
require_api_auth();

$metodo = request_method();
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

/** Valida los datos del vehículo; marca y modelo deben venir del catálogo. Lanza ErrorNegocio. */
function datos_vehiculo(array $body): array
{
    [$marca, $modelo] = validar_marca_modelo(str_or_null($body, 'marca'), str_or_null($body, 'modelo'));
    $d = [
        'marca'       => $marca,
        'modelo'      => $modelo,
        'anio'        => isset($body['anio']) ? (int) $body['anio'] : 0,
        'color'       => str_or_null($body, 'color'),
        'rfc_cliente' => str_or_null($body, 'rfc_cliente'),
    ];
    $maxAnio = (int) date('Y') + 1;
    if ($d['anio'] < 1950 || $d['anio'] > $maxAnio) {
        throw new ErrorNegocio("El año debe estar entre 1950 y {$maxAnio}", 400);
    }
    if ($d['color'] !== null && mb_strlen($d['color']) > 50) {
        throw new ErrorNegocio('El color es demasiado largo', 400);
    }
    return $d;
}

try {
    if ($metodo === 'GET') {
        $sql = "SELECT v.*, vc.rfc_cliente,
                       c.nombre, c.apellido_paterno, c.apellido_materno
                FROM vehiculo v
                LEFT JOIN vehiculocliente vc ON vc.id = (
                    SELECT MIN(x.id) FROM vehiculocliente x WHERE x.id_vehiculo = v.id_vehiculo
                )
                LEFT JOIN cliente c ON c.rfc = vc.rfc_cliente";
        $params = [];
        if (!empty($_GET['rfc'])) {
            $sql .= ' WHERE EXISTS (SELECT 1 FROM vehiculocliente y WHERE y.id_vehiculo = v.id_vehiculo AND y.rfc_cliente = ?)';
            $params[] = (string) $_GET['rfc'];
        }
        $sql .= ' ORDER BY v.id_vehiculo DESC';

        $result = array_map(static function (array $v): array {
            $cliente = $v['nombre'] !== null
                ? trim("{$v['nombre']} {$v['apellido_paterno']} " . ($v['apellido_materno'] ?? ''))
                : null;
            return [
                'id_vehiculo' => (int) $v['id_vehiculo'],
                'marca'       => $v['marca'],
                'modelo'      => $v['modelo'],
                'anio'        => (int) $v['anio'],
                'color'       => $v['color'],
                'placas'      => $v['placas'],
                'rfc_cliente' => $v['rfc_cliente'],
                'cliente'     => $cliente,
            ];
        }, db_all($sql, $params));
        json_out($result);
    }

    if ($metodo === 'POST') {
        $body = read_json_body();
        $d = datos_vehiculo($body) + ['placas' => normalizar_placas(str_or_null($body, 'placas'))];
        if ($d['rfc_cliente'] === null) {
            json_error('Selecciona el cliente propietario', 400);
        }
        if (placas_registradas($d['placas'])) {
            json_error("Ya existe un vehículo con las placas {$d['placas']}", 409);
        }
        if (!db_one('SELECT rfc FROM cliente WHERE rfc = ?', [$d['rfc_cliente']])) {
            json_error('El cliente seleccionado no existe', 400);
        }
        $nuevoId = db_transaction(static function (PDO $pdo) use ($d): int {
            $pdo->prepare('INSERT INTO vehiculo (marca, modelo, anio, color, placas) VALUES (?, ?, ?, ?, ?)')
                ->execute([$d['marca'], $d['modelo'], $d['anio'], $d['color'], $d['placas']]);
            $vid = (int) $pdo->lastInsertId();
            $pdo->prepare('INSERT INTO vehiculocliente (id_vehiculo, rfc_cliente, fecha) VALUES (?, ?, ?)')
                ->execute([$vid, $d['rfc_cliente'], now_utc()]);
            return $vid;
        });
        registrar_auditoria("Registró vehículo: {$d['marca']} {$d['modelo']} ({$d['placas']})", 'vehiculos');
        json_out(db_one('SELECT * FROM vehiculo WHERE id_vehiculo = ?', [$nuevoId]), 201);
    }

    if ($metodo === 'PUT' && $id > 0) {
        $d = datos_vehiculo(read_json_body());
        if (!db_one('SELECT id_vehiculo FROM vehiculo WHERE id_vehiculo = ?', [$id])) {
            json_error('Vehículo no encontrado', 404);
        }
        if ($d['rfc_cliente'] !== null && !db_one('SELECT rfc FROM cliente WHERE rfc = ?', [$d['rfc_cliente']])) {
            json_error('El cliente seleccionado no existe', 400);
        }
        db_transaction(static function (PDO $pdo) use ($d, $id): void {
            $pdo->prepare('UPDATE vehiculo SET marca = ?, modelo = ?, anio = ?, color = ? WHERE id_vehiculo = ?')
                ->execute([$d['marca'], $d['modelo'], $d['anio'], $d['color'], $id]);
            if ($d['rfc_cliente'] !== null) {
                $pdo->prepare('DELETE FROM vehiculocliente WHERE id_vehiculo = ?')->execute([$id]);
                $pdo->prepare('INSERT INTO vehiculocliente (id_vehiculo, rfc_cliente, fecha) VALUES (?, ?, ?)')
                    ->execute([$id, $d['rfc_cliente'], now_utc()]);
            }
        });
        registrar_auditoria("Editó vehículo: {$d['marca']} {$d['modelo']} (ID: {$id})", 'vehiculos');
        json_out(db_one('SELECT * FROM vehiculo WHERE id_vehiculo = ?', [$id]));
    }

    if ($metodo === 'DELETE' && $id > 0) {
        require_api_admin(); // solo administradores pueden eliminar
        try {
            $n = db_transaction(static function (PDO $pdo) use ($id): int {
                $pdo->prepare('DELETE FROM vehiculocliente WHERE id_vehiculo = ?')->execute([$id]);
                $st = $pdo->prepare('DELETE FROM vehiculo WHERE id_vehiculo = ?');
                $st->execute([$id]);
                return $st->rowCount();
            });
        } catch (PDOException $e) {
            json_error('No se puede eliminar: el vehículo tiene órdenes asociadas', 409);
        }
        if ($n === 0) {
            json_error('Vehículo no encontrado', 404);
        }
        registrar_auditoria("Eliminó vehículo con ID: {$id}", 'vehiculos');
        json_out(['ok' => true]);
    }

    json_error('Método no permitido', 405);
} catch (ErrorNegocio $e) {
    json_error($e->getMessage(), $e->getCode() ?: 400);
} catch (Throwable $e) {
    log_error('API vehículos', $e);
    json_error('Error al procesar la solicitud de vehículos', 500);
}
