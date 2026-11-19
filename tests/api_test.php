<?php
// Pruebas HTTP contra el servidor integrado de PHP apuntando a la base de pruebas.

declare(strict_types=1);

const API_PUERTO = 8099;

/** Arranca (una vez) el servidor integrado con TALLER_DB=taller_mecanico_test. */
function api_servidor(): void
{
    static $proc = null;
    if ($proc !== null) {
        return;
    }
    $raiz = realpath(__DIR__ . '/..');
    $env = array_merge(getenv(), ['TALLER_DB' => TEST_DB]);
    $proc = proc_open(
        [PHP_BINARY, '-S', '127.0.0.1:' . API_PUERTO, '-t', $raiz],
        [0 => ['pipe', 'r'], 1 => ['file', 'NUL', 'w'], 2 => ['file', 'NUL', 'w']],
        $pipes,
        $raiz,
        $env
    );
    register_shutdown_function(static function () use (&$proc): void {
        if (is_resource($proc)) {
            proc_terminate($proc);
        }
    });
    for ($i = 0; $i < 50; $i++) {
        $s = @fsockopen('127.0.0.1', API_PUERTO, $en, $es, 0.2);
        if ($s) {
            fclose($s);
            return;
        }
        usleep(100000);
    }
    throw new RuntimeException('No arrancó el servidor de pruebas');
}

/** Cliente HTTP con cookie de sesión y token CSRF. */
final class ClienteApi
{
    private string $cookie = '';
    private string $csrf = '';

    public static function sesion(string $usuario): self
    {
        api_servidor();
        $c = new self();
        $html = $c->pedir('GET', 'login.php')['raw'];
        preg_match('/name="csrf-token" content="([^"]+)"/', $html, $m);
        $c->csrf = $m[1] ?? '';
        $r = $c->pedir('POST', 'api/auth.php?accion=login', ['username' => $usuario, 'password' => TEST_CLAVE]);
        if ($r['status'] !== 200) {
            throw new RuntimeException("Login falló para {$usuario}: {$r['raw']}");
        }
        $c->csrf = $r['data']['csrf'];
        return $c;
    }

    /** @return array{status:int, data:mixed, raw:string} */
    public function pedir(string $metodo, string $ruta, ?array $cuerpo = null): array
    {
        $headers = ['Content-Type: application/json', 'X-CSRF-Token: ' . $this->csrf];
        if ($this->cookie !== '') {
            $headers[] = 'Cookie: ' . $this->cookie;
        }
        $ctx = stream_context_create(['http' => [
            'method'        => $metodo,
            'header'        => implode("\r\n", $headers),
            'content'       => $cuerpo === null ? '' : json_encode($cuerpo),
            'ignore_errors' => true,
            'timeout'       => 10,
        ]]);
        $raw = (string) file_get_contents('http://127.0.0.1:' . API_PUERTO . '/' . $ruta, false, $ctx);
        $status = 0;
        foreach ($http_response_header ?? [] as $h) {
            if (preg_match('#^HTTP/\S+ (\d+)#', $h, $m)) {
                $status = (int) $m[1];
            }
            if (preg_match('/^Set-Cookie: (taller_sid=[^;]+)/i', $h, $m)) {
                $this->cookie = $m[1];
            }
        }
        return ['status' => $status, 'data' => json_decode($raw, true), 'raw' => $raw];
    }
}

/** Crea cliente+vehículo directo en BD; devuelve [rfc, id_vehiculo]. */
function api_cliente_vehiculo(): array
{
    $pdo = db();
    $n = (int) db_one('SELECT COUNT(*) n FROM vehiculo')['n'] + 1;
    $rfc = sprintf('APIX80010%04d', $n);
    $pdo->prepare('INSERT INTO cliente (rfc, nombre, apellido_paterno, fecha_registro) VALUES (?, ?, ?, ?)')->execute([$rfc, 'Api', 'Prueba', now_utc()]);
    $pdo->prepare('INSERT INTO vehiculo (marca, modelo, anio, placas) VALUES (?, ?, ?, ?)')->execute(['Kia', 'Rio', 2020, "API-{$n}"]);
    $idV = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO vehiculocliente (id_vehiculo, rfc_cliente, fecha) VALUES (?, ?, ?)')->execute([$idV, $rfc, now_utc()]);
    return [$rfc, $idV];
}

function api_orden(ClienteApi $c, array $extra): int
{
    [$rfc, $idV] = api_cliente_vehiculo();
    $r = $c->pedir('POST', 'api/ordenes.php', ['id_vehiculo' => $idV, 'rfc_cliente' => $rfc] + $extra);
    t_equals(201, $r['status'], 'crear orden: ' . $r['raw']);
    return (int) $r['data']['id_orden'];
}

function test_api_flujo_piezas(): void
{
    test_reset_db();
    $c = ClienteApi::sesion('admin');
    [$rfc0, $idV0] = api_cliente_vehiculo();
    $r = $c->pedir('POST', 'api/ordenes.php', ['id_vehiculo' => $idV0, 'rfc_cliente' => $rfc0, 'tipo' => 'seguro', 'aseguradora' => 'Qualitas',
        'num_siniestro' => 'SIN000000001', 'cargos' => [['tipo' => 'extra', 'concepto' => 'Pintura completa', 'monto' => 6000]]]);
    t_equals(400, $r['status'], 'seguro con extras: ' . $r['raw']);
    $id = api_orden($c, ['tipo' => 'seguro', 'aseguradora' => 'Qualitas', 'num_siniestro' => 'SIN000000001', 'deducible' => 5000,
        'piezas' => [['nombre' => 'Faro', 'lado' => 'izquierdo']]]);

    $o = $c->pedir('GET', "api/ordenes.php?id={$id}")['data'];
    t_equals(['seguro', 'Qualitas', 5000.0, 'pendiente', 'aseguradora'], [$o['tipo'], $o['aseguradora'], (float) $o['deducible'], $o['piezas'][0]['estado'], $o['piezas'][0]['origen']]);
    $pid = $o['piezas'][0]['id_pieza'];

    t_equals(400, $c->pedir('PATCH', "api/piezas.php?id={$pid}&accion=devolver", ['motivo' => ''])['status']);
    $r = $c->pedir('PATCH', "api/piezas.php?id={$pid}&accion=devolver", ['motivo' => 'Llegó rota']);
    t_equals(200, $r['status'], $r['raw']);
    t_assert(($r['data']['id_reemplazo'] ?? 0) > 0, 'sin id_reemplazo');
    t_equals(2, count($c->pedir('GET', "api/ordenes.php?id={$id}")['data']['piezas']));
    t_equals(1, count($c->pedir('GET', 'api/piezas.php?estado=devuelta')['data']));
    t_assert(in_array('Faro', $c->pedir('GET', 'api/piezas.php?sugerir=fa')['data'], true), 'sugerencia Faro');

    $r = $c->pedir('POST', "api/piezas.php?orden={$id}", ['nombre' => 'Moldura']);
    t_equals(201, $r['status'], $r['raw']);
    $mid = $r['data']['id_pieza'];
    t_equals(200, $c->pedir('PATCH', "api/piezas.php?id={$mid}&accion=estado", ['estado' => 'recibida'])['status']);
    t_equals(409, $c->pedir('PATCH', "api/piezas.php?id={$mid}&accion=estado", ['estado' => 'devuelta'])['status']);

    $r = $c->pedir('POST', "api/cargos.php?orden={$id}", ['tipo' => 'extra', 'concepto' => 'Pulido', 'monto' => 350]);
    t_equals(400, $r['status'], 'cargo en seguro: ' . $r['raw']);
    $idP = api_orden($c, ['tipo' => 'particular']);
    $r = $c->pedir('POST', "api/cargos.php?orden={$idP}", ['tipo' => 'extra', 'concepto' => 'Pulido', 'monto' => 350]);
    t_equals(201, $r['status'], $r['raw']);
    t_equals(200, $c->pedir('DELETE', "api/cargos.php?id={$r['data']['id_cargo']}")['status']);

    $r = $c->pedir('PATCH', "api/ordenes.php?id={$id}&accion=datos", ['tipo' => 'seguro', 'aseguradora' => 'ANA Seguros', 'num_siniestro' => 'SIN000000002', 'deducible' => 4500]);
    t_equals(200, $r['status'], $r['raw']);
    t_equals(4500.0, (float) $c->pedir('GET', "api/ordenes.php?id={$id}")['data']['deducible']);

    $e = ClienteApi::sesion('empleado');
    t_equals(403, $e->pedir('DELETE', "api/piezas.php?id={$mid}")['status']);
    t_equals(403, $e->pedir('DELETE', "api/cargos.php?id=1")['status']);
}

function test_api_validaciones_orden(): void
{
    test_reset_db();
    $c = ClienteApi::sesion('admin');
    [$rfc, $idV] = api_cliente_vehiculo();
    $r = $c->pedir('POST', 'api/ordenes.php', ['id_vehiculo' => $idV, 'rfc_cliente' => $rfc, 'tipo' => 'particular', 'piezas' => [['nombre' => 'Faro']]]);
    t_equals(400, $r['status'], $r['raw']);
    t_assert(str_contains($r['data']['error'] ?? $r['raw'], 'precio'), 'mensaje de precio');
    $r = $c->pedir('POST', 'api/ordenes.php', ['id_vehiculo' => $idV, 'rfc_cliente' => $rfc, 'tipo' => 'seguro', 'aseguradora' => 'Otra', 'num_siniestro' => 'SIN000000001']);
    t_equals(400, $r['status']);
    $r = $c->pedir('POST', 'api/ordenes.php', ['id_vehiculo' => $idV, 'rfc_cliente' => $rfc, 'tipo' => 'seguro', 'aseguradora' => 'Qualitas']);
    t_equals(400, $r['status'], 'siniestro obligatorio');
    t_assert(str_contains($r['data']['error'] ?? '', 'siniestro'), 'mensaje de siniestro: ' . $r['raw']);
    $r = $c->pedir('POST', 'api/ordenes.php', ['id_vehiculo' => $idV, 'rfc_cliente' => $rfc, 'tipo' => 'seguro', 'aseguradora' => 'Qualitas', 'num_siniestro' => 'S-1']);
    t_equals(400, $r['status'], 'siniestro corto');
    $r = $c->pedir('POST', 'api/ordenes.php', ['id_vehiculo' => $idV, 'rfc_cliente' => $rfc, 'tipo' => 'particular']);
    t_equals(201, $r['status'], 'orden sin piezas permitida');
}

function test_api_cancelar_sin_stock(): void
{
    test_reset_db();
    $c = ClienteApi::sesion('admin');
    $id = api_orden($c, ['tipo' => 'particular', 'piezas' => [['nombre' => 'Faro', 'precio_unitario' => 100]]]);
    $r = $c->pedir('PATCH', "api/ordenes.php?id={$id}&accion=cancelar");
    t_equals(200, $r['status'], $r['raw']);
    t_equals(409, $c->pedir('POST', "api/piezas.php?orden={$id}", ['nombre' => 'X', 'precio_unitario' => 1])['status']);
}

function test_api_cobro_bloqueado_y_deducible(): void
{
    test_reset_db();
    $c = ClienteApi::sesion('admin');
    $id = api_orden($c, ['tipo' => 'seguro', 'aseguradora' => 'Qualitas', 'num_siniestro' => 'SIN000000003', 'deducible' => 5000,
        'piezas' => [['nombre' => 'Defensa delantera']]]);
    $cobro = ['id_orden' => $id, 'aplica_iva' => true, 'metodo_pago' => 'efectivo', 'descuento_tipo' => 'monto', 'descuento_valor' => 0];

    $r = $c->pedir('POST', 'api/ventas.php', $cobro);
    t_equals(409, $r['status'], $r['raw']);
    t_assert(str_contains($r['data']['error'] ?? '', 'Defensa delantera'), 'el mensaje nombra la pieza: ' . $r['raw']);

    $pid = $c->pedir('GET', "api/ordenes.php?id={$id}")['data']['piezas'][0]['id_pieza'];
    $c->pedir('PATCH', "api/piezas.php?id={$pid}&accion=estado", ['estado' => 'instalada']);
    $r = $c->pedir('POST', 'api/ventas.php', $cobro);
    t_equals(201, $r['status'], $r['raw']);
    t_equals(5000.0, (float) $r['data']['precio_total']);

    $v = db_one('SELECT * FROM venta WHERE id_orden = ?', [$id]);
    t_equals(['0.00', '0.00', '0.00', '5000.00', '0.00', '5000.00'], [$v['subtotal'], $v['piezas'], $v['extras'], $v['deducible'], $v['iva'], $v['precio_total']]);

    $g = $c->pedir('GET', "api/ventas.php?orden={$id}")['data'];
    t_equals(['seguro', 'Qualitas', 5000.0, 1], [$g['tipo'], $g['aseguradora'], (float) $g['deducible'], count($g['piezas'])]);
}

function test_api_cobro_particular_desglose(): void
{
    test_reset_db();
    $c = ClienteApi::sesion('admin');
    $id = api_orden($c, ['tipo' => 'particular',
        'cargos' => [['tipo' => 'mano_obra', 'concepto' => 'Mano de obra', 'monto' => 1000], ['tipo' => 'extra', 'concepto' => 'Pulido', 'monto' => 500]]]);
    $pid = $c->pedir('POST', "api/piezas.php?orden={$id}", ['nombre' => 'Faro', 'precio_unitario' => 1000, 'cantidad' => 2])['data']['id_pieza'];
    $c->pedir('PATCH', "api/piezas.php?id={$pid}&accion=estado", ['estado' => 'instalada']);
    $r = $c->pedir('POST', 'api/ventas.php', ['id_orden' => $id, 'aplica_iva' => true, 'metodo_pago' => 'tarjeta', 'descuento_tipo' => 'porcentaje', 'descuento_valor' => 10]);
    t_equals(201, $r['status'], $r['raw']);
    $v = db_one('SELECT * FROM venta WHERE id_orden = ?', [$id]);
    // bruto 3500, desc 350, base 3150, iva 504, total 3654
    t_equals(['2000.00', '2000.00', '1000.00', '500.00', '0.00', '350.00', '504.00', '3654.00'],
        [$v['subtotal'], $v['piezas'], $v['mano_obra'], $v['extras'], $v['deducible'], $v['descuento'], $v['iva'], $v['precio_total']]);
    t_equals('3654.00', db_one("SELECT monto FROM pago WHERE id_orden = ? AND tipo = 'liquidacion'", [$id])['monto']);
    t_equals(409, $c->pedir('POST', 'api/ventas.php', ['id_orden' => $id])['status']);
}

function test_api_cobro_total_cero(): void
{
    test_reset_db();
    $c = ClienteApi::sesion('admin');
    $id = api_orden($c, ['tipo' => 'seguro', 'aseguradora' => 'ANA Seguros', 'num_siniestro' => 'SIN000000004', 'deducible' => 0]);
    $r = $c->pedir('POST', 'api/ventas.php', ['id_orden' => $id, 'aplica_iva' => true, 'metodo_pago' => 'efectivo']);
    t_equals(201, $r['status'], $r['raw']);
    t_equals(0.0, (float) $r['data']['precio_total']);
    t_equals(0, (int) db_one('SELECT COUNT(*) n FROM pago WHERE id_orden = ?', [$id])['n']);
}

function test_api_vehiculo_valida_placas_y_catalogo(): void
{
    test_reset_db();
    $c = ClienteApi::sesion('empleado');
    [$rfc] = api_cliente_vehiculo();
    $base = ['rfc_cliente' => $rfc, 'marca' => 'toyota', 'modelo' => 'corolla', 'anio' => 2020];
    t_equals(400, $c->pedir('POST', 'api/vehiculos.php', $base + ['placas' => 'AB1'])['status'], 'placas cortas');
    t_equals(400, $c->pedir('POST', 'api/vehiculos.php', ['marca' => 'Inventada'] + $base + ['placas' => 'ABC123D'])['status'], 'marca fuera de catálogo');
    t_equals(400, $c->pedir('POST', 'api/vehiculos.php', ['modelo' => 'Sentra'] + $base + ['placas' => 'ABC123D'])['status'], 'modelo de otra marca');
    $r = $c->pedir('POST', 'api/vehiculos.php', $base + ['placas' => 'abc-123-d']);
    t_equals(201, $r['status'], $r['raw']);
    t_equals(['ABC123D', 'Toyota', 'Corolla'], [$r['data']['placas'], $r['data']['marca'], $r['data']['modelo']]);
    t_equals(409, $c->pedir('POST', 'api/vehiculos.php', $base + ['placas' => 'ABC 123 D'])['status'], 'placas repetidas');
    db_query("UPDATE vehiculo SET placas = 'XYZ-987-A' WHERE id_vehiculo = ?", [$r['data']['id_vehiculo']]);
    t_equals(409, $c->pedir('POST', 'api/vehiculos.php', $base + ['placas' => 'XYZ987A'])['status'], 'placas con guiones (registro viejo)');
}

function test_api_catalogo(): void
{
    test_reset_db();
    $c = ClienteApi::sesion('empleado');
    $g = $c->pedir('GET', 'api/catalogo.php');
    t_equals(200, $g['status'], $g['raw']);
    t_assert(in_array('Nissan', array_column($g['data']['marcas'], 'nombre'), true), 'marca Nissan');
    t_assert(in_array('Faro', $g['data']['piezas'], true), 'pieza Faro');
    $r = $c->pedir('POST', 'api/catalogo.php', ['tipo' => 'marca', 'nombre' => 'Marca API']);
    t_equals(201, $r['status'], $r['raw']);
    t_equals(409, $c->pedir('POST', 'api/catalogo.php', ['tipo' => 'marca', 'nombre' => 'MARCA api'])['status']);
    $r = $c->pedir('POST', 'api/catalogo.php', ['tipo' => 'modelo', 'id_marca' => $r['data']['id_marca'], 'nombre' => 'Modelo API']);
    t_equals(201, $r['status'], $r['raw']);
    t_equals(201, $c->pedir('POST', 'api/catalogo.php', ['tipo' => 'pieza', 'nombre' => 'Pieza API'])['status']);
    t_equals(400, $c->pedir('POST', 'api/catalogo.php', ['tipo' => 'otro', 'nombre' => 'X'])['status']);
}
