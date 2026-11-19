<?php
// GET api/configuracion.php → datos del taller
// PUT api/configuracion.php → guardar (admin)
// PUT api/configuracion.php?seccion=aseguradoras → {aseguradoras: [..]} (admin)

require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/repositorio.php';
require_api_auth();

const LIMITES = ['nombre_taller' => 80, 'eslogan' => 80, 'direccion' => 200, 'telefono' => 30, 'rfc' => 13, 'mensaje_recibo' => 120];

try {
    if (request_method() === 'GET') {
        json_out(config_taller());
    }

    if (request_method() === 'PUT' && ($_GET['seccion'] ?? '') === 'aseguradoras') {
        require_api_admin();
        $lista = read_json_body()['aseguradoras'] ?? null;
        if (!is_array($lista)) {
            json_error('Lista de aseguradoras inválida', 400);
        }
        $lista = normalizar_aseguradoras(array_values($lista));
        db_transaction(static fn (PDO $pdo) => guardar_aseguradoras($pdo, $lista));
        registrar_auditoria('Actualizó la lista de aseguradoras: ' . mb_substr(implode(', ', $lista), 0, 150), 'configuracion');
        json_out(['aseguradoras' => $lista]);
    }

    if (request_method() === 'PUT') {
        require_api_admin();
        $body = read_json_body();
        $datos = [];
        foreach (LIMITES as $clave => $max) {
            $v = trim((string) ($body[$clave] ?? ''));
            if (mb_strlen($v) > $max) {
                json_error("El campo \"{$clave}\" es demasiado largo (máx. {$max})", 400);
            }
            $datos[$clave] = $v;
        }
        if ($datos['nombre_taller'] === '') {
            json_error('El nombre del taller es requerido', 400);
        }
        $datos['rfc'] = strtoupper($datos['rfc']);
        if ($datos['rfc'] !== '' && !preg_match('/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/u', $datos['rfc'])) {
            json_error('RFC inválido (12 o 13 caracteres)', 400);
        }
        db_transaction(static function (PDO $pdo) use ($datos): void {
            $st = $pdo->prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)');
            foreach ($datos as $k => $v) {
                $st->execute([$k, $v]);
            }
        });
        registrar_auditoria('Actualizó los datos del taller', 'configuracion');
        json_out($datos);
    }

    json_error('Método no permitido', 405);
} catch (ErrorNegocio $e) {
    json_error($e->getMessage(), $e->getCode() ?: 400);
} catch (Throwable $e) {
    log_error('API configuración', $e);
    json_error('Error al guardar la configuración', 500);
}
