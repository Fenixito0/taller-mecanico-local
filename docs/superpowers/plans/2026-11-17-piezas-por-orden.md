# Piezas por orden — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el inventario de refacciones por piezas ligadas a cada orden (con origen y estado), agregar órdenes de tipo seguro/particular y cobrar por conceptos (piezas cobrables, mano de obra, extras, deducible).

**Architecture:** Migración SQL idempotente `migracion_v3.sql` agrega columnas/tablas. La lógica vive en archivos nuevos de `includes/` (`cobro.php` puro, `piezas.php` acceso a datos) que usan los `api/*.php` delgados existentes. El front (JS vanilla) se adapta pantalla por pantalla. Pruebas con un runner PHP mínimo propio contra una base `taller_mecanico_test`.

**Tech Stack:** PHP 8.1 (XAMPP), MariaDB/MySQL, PDO, JavaScript vanilla. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-17-piezas-por-orden-design.md`

## Global Constraints

- Sin frameworks ni Composer; solo PHP, HTML, CSS, JS (como el resto del proyecto).
- `declare(strict_types=1);` en archivos PHP nuevos; consultas siempre preparadas.
- Fechas en UTC en BD (`now_utc()`), mostradas en `America/Mazatlan`.
- La migración no borra tablas ni datos; re-ejecutable (`IF NOT EXISTS`, `INSERT ... WHERE NOT EXISTS`).
- `refaccion` y `detalleorden` se conservan; ningún código nuevo lee `refaccion.stock`.
- Tasa de IVA 16 % (`TASA_IVA = 0.16`).
- Deducible: monto fijo con IVA incluido; nunca se le suma IVA ni se le aplica descuento.
- No se puede cobrar si la orden tiene piezas en estado `pendiente` o `recibida`.
- Piezas `devuelta` nunca suman al total.
- Etiqueta visible de extras en recibo y cotización: `EXTRA`.
- Aseguradoras iniciales: `ANA Seguros`, `Primero Seguros`, `Qualitas`.
- Permisos actuales: empleado no elimina registros; reportes, usuarios, bitácora y configuración solo admin.
- Toda cadena de usuario mostrada en HTML pasa por `esc()` (assets/js/common.js).

## Review Focus

1. **Orden de seguro con deducible 0 y sin extras** → total $0.00; el cobro debe permitirse (registra venta en 0, sin pago de liquidación). Test en Task 2 (`test_cobro_seguro_total_cero`) y Task 5.
2. **Anticipos mayores al total** (p. ej. anticipo de $1,000 y luego se baja el deducible a $500) → el cobro se rechaza con mensaje claro, igual que hoy. Test en Task 2 (`test_cobro_anticipo_excede`).
3. **Devolver dos veces la misma pieza o devolver una pieza instalada** → la segunda devolución se rechaza (`ErrorNegocio` 409); solo `recibida` o `pendiente` pueden devolverse. Test en Task 3.
4. **Cambiar el tipo de orden con piezas de aseguradora ya marcadas** → seguro→particular convierte esas piezas a `origen='taller'` con precio NULL; el cobro de particular no debe cobrar piezas con precio NULL. Test en Task 3 (`test_cambiar_tipo_seguro_a_particular`).
5. **Modificar una orden ya cobrada o cancelada** (agregar pieza/cargo, cambiar estado de pieza, editar deducible) → rechazado con 409. Test en Task 3 (`test_orden_cerrada_no_editable`).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `database/migracion_v3.sql` (nuevo) | Columnas en `ordenservicio`/`venta`, tablas `orden_pieza`, `orden_cargo`, `cotizacion_concepto`, copia de datos viejos, aseguradoras en `configuracion` |
| `tests/bootstrap.php`, `tests/run.php` (nuevos) | Runner mínimo: recrea `taller_mecanico_test` con schema + v2 + v3, ejecuta funciones `test_*` de `tests/*_test.php` |
| `includes/cobro.php` (nuevo) | `calcular_cobro()` puro (sustituye a `calcular_venta` de `api/ventas.php`) |
| `includes/piezas.php` (nuevo) | Acceso a datos de piezas, cargos, datos de seguro y tablero |
| `includes/repositorio.php` | `crear_orden` nueva firma, `obtener_orden`/`listar_ordenes` devuelven `piezas`/`cargos`/datos seguro; reportes por `orden_pieza` |
| `api/ordenes.php` | POST con nuevo cuerpo, PATCH `accion=datos`, cancelar sin stock |
| `api/piezas.php` (nuevo) | Tablero, sugerencias, alta/baja de pieza, cambio de estado, devolución |
| `api/cargos.php` (nuevo) | Alta/baja de cargos (mano de obra/extra) |
| `api/ventas.php` | Usa `calcular_cobro`, bloquea por piezas, guarda desglose |
| `api/cotizaciones.php` | Conceptos libres, conversión crea piezas/cargos |
| `api/configuracion.php` | Leer/guardar lista de aseguradoras |
| `api/excel.php`, `api/caja.php` | Desglose nuevo |
| `piezas.php` + `assets/js/piezas.js` (nuevos) | Tablero de piezas (reemplaza refacciones en el menú) |
| `assets/js/orden_nueva.js`, `ordenes.js`, `cobrar.js`, `recibo.js`, `cotizaciones.js`, `cotizacion_imprimir.js`, `reportes.js`, `configuracion.js` | UI |
| `includes/layout_top.php` | Menú: "Refacciones" → "Piezas" |
| `database/seed_demo.php`, `README.md` | Datos demo y documentación al modelo nuevo |

Formas de datos compartidas (JSON y arrays PHP):

```
Pieza  = { id_pieza:int, id_orden:int, nombre:string, lado:'Izquierdo'|'Derecho'|'Central'|'N/A',
           origen:'aseguradora'|'taller', estado:'pendiente'|'recibida'|'instalada'|'devuelta',
           cantidad:int, precio_unitario:?float, es_extra:bool, id_reemplaza:?int,
           motivo_devolucion:?string, fecha_estado:string(ISO UTC) }
Cargo  = { id_cargo:int, id_orden:int, tipo:'mano_obra'|'extra', concepto:string, monto:float }
Seguro = { tipo:'seguro'|'particular', aseguradora:?string, num_siniestro:?string, deducible:float }
```

(`lado` usa `lado_a_cliente()` / `lado_a_bd()` existentes en `includes/helpers.php`.)

---

### Task 1: Migración v3 y runner de pruebas

**Files:**
- Create: `database/migracion_v3.sql`, `tests/bootstrap.php`, `tests/run.php`, `tests/migracion_test.php`

**Interfaces:**
- Produces: tablas/columnas del spec; `tests/run.php` ejecuta `C:\xampp\php\php.exe tests\run.php [filtro]`; helper `t_assert(bool $cond, string $msg): void`, `t_equals($esperado, $real, string $msg = ''): void`, `t_throws(callable $fn, int $codigo): void`; `test_reset_db(): void` (vacía tablas de datos y crea usuarios `admin` (rol admin, id 1) y `empleado` (rol empleado), ambos con contraseña `clave-prueba-123`).

- [ ] **Step 1: Escribir `tests/bootstrap.php` y `tests/run.php`.** El bootstrap carga `includes/config.php`, sobreescribe `db_name='taller_mecanico_test'`, define `config()`, requiere `includes/db.php`, `includes/helpers.php`, `includes/repositorio.php`, `includes/cobro.php` y `includes/piezas.php` si existen. Recrea la base ejecutando con `C:\xampp\mysql\bin\mysql.exe -uroot` los archivos `schema.sql`, `migracion_v2.sql`, `migracion_v3.sql` (sustituyendo `taller_mecanico` por `taller_mecanico_test` en el texto antes de enviarlo por stdin). `run.php` incluye cada `tests/*_test.php`, ejecuta las funciones `test_*` (filtrables por argumento), captura excepciones, imprime `OK`/`FALLA nombre: mensaje` y sale con código 1 si alguna falla.

- [ ] **Step 2: Escribir `tests/migracion_test.php`:**

```php
function test_migracion_crea_tablas(): void {
    foreach (['orden_pieza', 'orden_cargo', 'cotizacion_concepto'] as $t) {
        t_assert(db_one("SHOW TABLES LIKE ?", [$t]) !== null, "falta $t");
    }
    foreach (['tipo', 'aseguradora', 'num_siniestro', 'deducible'] as $c) {
        t_assert(db_one("SHOW COLUMNS FROM ordenservicio LIKE ?", [$c]) !== null, "falta ordenservicio.$c");
    }
    foreach (['piezas', 'extras', 'deducible'] as $c) {
        t_assert(db_one("SHOW COLUMNS FROM venta LIKE ?", [$c]) !== null, "falta venta.$c");
    }
    t_equals('["ANA Seguros","Primero Seguros","Qualitas"]',
        db_one("SELECT valor FROM configuracion WHERE clave='aseguradoras'")['valor']);
}

function test_migracion_copia_detalle_y_es_idempotente(): void {
    test_reset_db();
    // orden completada y orden pendiente con detalleorden + cotización abierta con detallecotizacion
    // (insertar directo con SQL: cliente, vehiculo, vehiculocliente, refaccion 'Faro' lado izquierdo precio 1890)
    // ... luego ejecutar migracion_v3.sql DOS veces con test_ejecutar_sql('migracion_v3.sql')
    t_equals(2, (int) db_one('SELECT COUNT(*) n FROM orden_pieza')['n']);
    t_equals('instalada', db_one('SELECT estado FROM orden_pieza WHERE id_orden = ?', [$completada])['estado']);
    t_equals('pendiente', db_one('SELECT estado FROM orden_pieza WHERE id_orden = ?', [$pendiente])['estado']);
    $p = db_one('SELECT * FROM orden_pieza WHERE id_orden = ?', [$completada]);
    t_equals(['Faro', 'izquierdo', 'taller', '1890.00', 0], [$p['nombre'], $p['lado'], $p['origen'], $p['precio_unitario'], (int) $p['es_extra']]);
    t_equals(1, (int) db_one("SELECT COUNT(*) n FROM cotizacion_concepto WHERE tipo='pieza'")['n']);
}
```

- [ ] **Step 3: Ejecutar** `C:\xampp\php\php.exe tests\run.php migracion` → Esperado: FALLA (no existe `migracion_v3.sql`).

- [ ] **Step 4: Escribir `database/migracion_v3.sql`** con las columnas/tablas exactas del spec (sección Datos). Detalles fijados:
  - `orden_pieza.fecha_estado` NOT NULL; FKs `ON UPDATE CASCADE`; `id_reemplaza` FK a `orden_pieza(id_pieza)` `ON DELETE SET NULL`; índice `(estado)` e `(id_orden)`.
  - `orden_cargo` FK a orden `ON DELETE CASCADE`. `cotizacion_concepto` FK a cotización `ON DELETE CASCADE`.
  - Copia `detalleorden` → `orden_pieza` solo para órdenes sin filas en `orden_pieza` (`WHERE NOT EXISTS`): `origen='taller'`, `estado` = `'instalada'` si la orden es `completado`, si no `'pendiente'`; `fecha_estado = o.fecha_creacion`; nombre/lado de `refaccion`.
  - Copia `detallecotizacion` → `cotizacion_concepto` tipo `pieza` para cotizaciones sin conceptos.
  - Copia `venta.mano_obra` > 0 → `orden_cargo` tipo `mano_obra` concepto `'Mano de obra'` para órdenes sin cargos; `venta.piezas = venta.subtotal` donde `piezas = 0 AND subtotal > 0`.
  - `INSERT IGNORE INTO configuracion (clave, valor) VALUES ('aseguradoras', '["ANA Seguros","Primero Seguros","Qualitas"]')`.

- [ ] **Step 5: Ejecutar** `C:\xampp\php\php.exe tests\run.php migracion` → Esperado: todos OK.

- [ ] **Step 6: Aplicar a la base real** `C:\xampp\mysql\bin\mysql.exe -uroot < database\migracion_v3.sql` → sin errores; repetir una vez → sin errores ni filas duplicadas (`SELECT COUNT(*) FROM orden_pieza` igual).

- [ ] **Step 7: Commit** `feat: migración v3 de piezas por orden y runner de pruebas`

---

### Task 2: Cálculo de cobro

**Files:**
- Create: `includes/cobro.php`, `tests/cobro_test.php`

**Interfaces:**
- Produces: `const TASA_IVA = 0.16;` (mover desde `api/ventas.php`) y
  `calcular_cobro(string $tipo, array $piezas, array $cargos, float $deducible, string $descTipo, float $descValor, bool $aplicaIva, float $anticipo): array` que devuelve
  `['piezas'=>float,'mano_obra'=>float,'extras'=>float,'deducible'=>float,'descuento'=>float,'base'=>float,'iva'=>float,'total'=>float,'restante'=>float]`.
  `$piezas` y `$cargos` con las formas Pieza/Cargo. Lanza `ErrorNegocio` (requiere la clase de `includes/repositorio.php`).
- Reglas: piezas cobrables = estado ≠ `devuelta` y `precio_unitario !== null` → suma `cantidad*precio`. Mano de obra = cargos `mano_obra` solo si `$tipo==='particular'`. Extras = cargos `extra`. Deducible solo si `$tipo==='seguro'`. `base = piezas + mano_obra + extras − descuento`; descuento por porcentaje sobre `piezas+mano_obra+extras`; `iva = round(base*0.16,2)` si aplica; `total = base + iva + deducible`; `restante = max(0, total − anticipo)`. Mismos errores que `calcular_venta` hoy (descuento 0–100 %, descuento > importe) más `'Los anticipos superan el total'` (400) si `anticipo > total + 0.005`.

- [ ] **Step 1: Escribir pruebas** en `tests/cobro_test.php`:

```php
function pz(?float $precio = null, string $estado = 'instalada', int $cant = 1, bool $extra = false): array {
    return ['precio_unitario' => $precio, 'estado' => $estado, 'cantidad' => $cant, 'es_extra' => $extra];
}
function test_cobro_seguro(): void {
    $k = calcular_cobro('seguro', [pz(null), pz(3200.0, 'instalada', 1, true)],
        [['tipo' => 'mano_obra', 'monto' => 2500.0], ['tipo' => 'extra', 'monto' => 6000.0]],
        5000.0, 'monto', 0, true, 0);
    t_equals([3200.0, 0.0, 6000.0, 5000.0, 9200.0, 1472.0, 15672.0], [$k['piezas'], $k['mano_obra'], $k['extras'], $k['deducible'], $k['base'], $k['iva'], $k['total']]);
}
function test_cobro_particular_con_descuento(): void {
    $k = calcular_cobro('particular', [pz(1000.0, 'instalada', 2), pz(500.0, 'devuelta')],
        [['tipo' => 'mano_obra', 'monto' => 1000.0]], 999.0, 'porcentaje', 10, true, 500);
    t_equals([2000.0, 1000.0, 0.0, 300.0, 2700.0, 432.0, 3132.0, 2632.0], [$k['piezas'], $k['mano_obra'], $k['deducible'], $k['descuento'], $k['base'], $k['iva'], $k['total'], $k['restante']]);
}
function test_cobro_deducible_sin_iva_ni_descuento(): void {
    $k = calcular_cobro('seguro', [], [['tipo' => 'extra', 'monto' => 1000.0]], 5000.0, 'monto', 1000, true, 0);
    t_equals([0.0, 0.0, 5000.0], [$k['base'], $k['iva'], $k['total']]);
}
function test_cobro_seguro_total_cero(): void {
    $k = calcular_cobro('seguro', [pz(null)], [], 0.0, 'monto', 0, true, 0);
    t_equals([0.0, 0.0], [$k['total'], $k['restante']]);
}
function test_cobro_descuento_mayor_al_importe(): void {
    t_throws(fn () => calcular_cobro('seguro', [], [['tipo' => 'extra', 'monto' => 100.0]], 5000.0, 'monto', 101, true, 0), 400);
}
function test_cobro_anticipo_excede(): void {
    t_throws(fn () => calcular_cobro('seguro', [], [], 500.0, 'monto', 0, true, 1000), 400);
}
```

- [ ] **Step 2: Ejecutar** `C:\xampp\php\php.exe tests\run.php cobro` → FALLA (función no definida).
- [ ] **Step 3: Implementar** `calcular_cobro` en `includes/cobro.php`.
- [ ] **Step 4: Ejecutar** `C:\xampp\php\php.exe tests\run.php cobro` → OK.
- [ ] **Step 5: Commit** `feat: cálculo de cobro por conceptos con deducible`

---

### Task 3: Acceso a datos de piezas, cargos y datos de seguro

**Files:**
- Create: `includes/piezas.php`, `tests/piezas_test.php`
- Modify: `includes/repositorio.php` (`crear_orden`, `obtener_orden`, `listar_ordenes`, `detalles_por_orden` → reemplazo, quitar `normalizar_items`/`subtotal_refacciones` cuando ya no se usen)

**Interfaces:**
- Consumes: `calcular_cobro` (Task 2) no se usa aquí.
- Produces (todas reciben `PDO $pdo` primero cuando escriben; deben llamarse dentro de `db_transaction`; lanzan `ErrorNegocio`):
  - `normalizar_pieza(array $in, string $tipoOrden): array` — valida y devuelve fila lista para insertar: `nombre` (trim, 1–100, requerido), `lado` (vía `lado_a_bd`), `origen` (default `aseguradora` si seguro, `taller` si particular; si particular y llega `aseguradora` → error 400), `cantidad` 1–`MAX_CANTIDAD`, `precio_unitario` (null o ≥0, redondeado 2), `es_extra` bool (si `es_extra` y precio null → error 400 `'Las piezas extra deben llevar precio'`); en particular, precio null → error 400 `'Indica el precio de la pieza'`.
  - `normalizar_cargo(array $in): array` — `tipo` ∈ {mano_obra, extra}, `concepto` 1–150, `monto` > 0.
  - `normalizar_seguro(array $in, array $aseguradoras): array` — devuelve Seguro; en seguro exige `aseguradora` ∈ lista, `deducible` ≥ 0; en particular pone aseguradora/siniestro null y deducible 0.
  - `crear_orden(PDO $pdo, int $idVehiculo, string $rfc, ?string $obs, ?int $km, array $seguro, array $piezas, array $cargos, ?int $idUsuario): int` — ya no exige piezas ni toca stock.
  - `orden_abierta_o_falla(PDO $pdo, int $idOrden): array` — `SELECT ... FOR UPDATE`; 404 si no existe; 409 `'La orden ya no se puede modificar'` si estado ≠ pendiente.
  - `agregar_pieza(PDO $pdo, int $idOrden, array $pieza): int`, `eliminar_pieza(PDO $pdo, int $idPieza): void` (solo si estado `pendiente` y no tiene reemplazo).
  - `cambiar_estado_pieza(PDO $pdo, int $idPieza, string $estado): void` — transiciones permitidas: pendiente→recibida, recibida→instalada, pendiente→instalada, recibida→pendiente, instalada→recibida; otra → 409.
  - `devolver_pieza(PDO $pdo, int $idPieza, string $motivo): int` — solo desde `pendiente`/`recibida`; motivo 1–200 requerido; marca `devuelta` y crea reemplazo `pendiente` copiando nombre, lado, origen, cantidad, precio_unitario, es_extra, con `id_reemplaza`; devuelve id del reemplazo.
  - `agregar_cargo(PDO $pdo, int $idOrden, array $cargo): int`, `eliminar_cargo(PDO $pdo, int $idCargo): void`.
  - `actualizar_seguro(PDO $pdo, int $idOrden, array $seguro): void` — al pasar seguro→particular: `UPDATE orden_pieza SET origen='taller', precio_unitario=NULL WHERE id_orden=? AND origen='aseguradora'`.
  - `piezas_por_orden(array $ids): array<int, Pieza[]>`, `cargos_por_orden(array $ids): array<int, Cargo[]>`.
  - `piezas_bloqueantes(int $idOrden): Pieza[]` — estado ∈ {pendiente, recibida}.
  - `tablero_piezas(?string $estado, ?string $aseguradora): array` — piezas de órdenes `pendiente` con estado ≠ instalada (o el estado pedido), con `id_orden`, `placas`, `vehiculo`, `cliente`, `aseguradora`, `dias` (días enteros desde `fecha_estado`), orden por `fecha_estado` ASC.
  - `nombres_pieza(string $q, int $limite = 10): string[]` — nombres distintos de `orden_pieza` que contienen `$q`, más usados primero.
  - `aseguradoras(): string[]` — JSON de `configuracion.aseguradoras`; `config_taller()` agrega la clave `aseguradoras` con este valor.
  - `obtener_orden()`/`listar_ordenes()` agregan claves `tipo`, `aseguradora`, `num_siniestro`, `deducible`, `piezas` (Pieza[]), `cargos` (Cargo[]) y dejan de devolver `refacciones`.

- [ ] **Step 1: Escribir pruebas** en `tests/piezas_test.php` (cada una inicia con `test_reset_db()` y un helper `orden_demo(string $tipo): int` que crea cliente/vehículo y llama `crear_orden`):

```php
function test_crear_orden_seguro_sin_piezas(): void {
    $id = orden_demo('seguro');
    $o = obtener_orden($id);
    t_equals(['seguro', 'Qualitas', '0456789', 5000.0, []], [$o['tipo'], $o['aseguradora'], $o['num_siniestro'], $o['deducible'], $o['cargos']]);
}
function test_pieza_particular_sin_precio_falla(): void {
    t_throws(fn () => normalizar_pieza(['nombre' => 'Faro'], 'particular'), 400);
}
function test_pieza_seguro_default_aseguradora(): void {
    t_equals(['aseguradora', null], array_values(array_intersect_key(normalizar_pieza(['nombre' => 'Faro'], 'seguro'), ['origen' => 1, 'precio_unitario' => 1])));
}
function test_devolver_crea_reemplazo(): void {
    $id = orden_demo('seguro');
    $pid = db_transaction(fn (PDO $p) => agregar_pieza($p, $id, normalizar_pieza(['nombre' => 'Defensa', 'precio_unitario' => 800, 'es_extra' => true], 'seguro')));
    $nuevo = db_transaction(fn (PDO $p) => devolver_pieza($p, $pid, 'Llegó rota'));
    $ps = piezas_por_orden([$id])[$id];
    t_equals(['devuelta', 'Llegó rota'], [$ps[0]['estado'], $ps[0]['motivo_devolucion']]);
    t_equals(['pendiente', $pid, 800.0, true], [$ps[1]['estado'], $ps[1]['id_reemplaza'], $ps[1]['precio_unitario'], $ps[1]['es_extra']]);
    t_throws(fn () => db_transaction(fn (PDO $p) => devolver_pieza($p, $pid, 'otra vez')), 409);
}
function test_transicion_invalida(): void {
    // pieza pendiente → 'devuelta' vía cambiar_estado_pieza debe fallar 409 (solo por devolver_pieza)
}
function test_bloqueantes(): void {
    // una pendiente, una instalada, una devuelta → piezas_bloqueantes devuelve solo la pendiente
}
function test_cambiar_tipo_seguro_a_particular(): void {
    // pieza origen aseguradora → tras actualizar_seguro(particular): origen 'taller', precio null, deducible 0
}
function test_orden_cerrada_no_editable(): void {
    // UPDATE ordenservicio SET estado='completado'; agregar_pieza, agregar_cargo, cambiar_estado_pieza, actualizar_seguro → 409 cada una
}
function test_tablero_y_nombres(): void {
    // 2 órdenes pendientes con piezas 'Faro' y 'Faro' y 'Moldura' instalada → tablero(null,null) no incluye la instalada;
    // tablero('devuelta', null) solo devueltas; nombres_pieza('fa') === ['Faro']
}
```

(Las pruebas con comentario se escriben con las aserciones que el comentario fija.)

- [ ] **Step 2: Ejecutar** `C:\xampp\php\php.exe tests\run.php piezas` → FALLA.
- [ ] **Step 3: Implementar** `includes/piezas.php` y los cambios en `includes/repositorio.php`.
- [ ] **Step 4: Ejecutar** `C:\xampp\php\php.exe tests\run.php` (todas) → OK.
- [ ] **Step 5: Commit** `feat: piezas, cargos y datos de seguro por orden`

---

### Task 4: API de órdenes, piezas y cargos

**Files:**
- Modify: `api/ordenes.php`
- Create: `api/piezas.php`, `api/cargos.php`, `tests/api_test.php`

**Interfaces:**
- Consumes: Task 3.
- Produces (todas requieren sesión con `require_api_auth()`; errores `json_error`; cada escritura registra auditoría con módulo `ordenes`):
  - `POST api/ordenes.php` cuerpo `{id_vehiculo, rfc_cliente, observaciones, kilometraje, tipo, aseguradora, num_siniestro, deducible, piezas: [Pieza sin id], cargos: [Cargo sin id]}` → `{id_orden}` 201.
  - `PATCH api/ordenes.php?id=N&accion=datos` cuerpo Seguro → `{ok:true}`.
  - `PATCH api/ordenes.php?id=N&accion=cancelar` ya no toca `refaccion.stock` (borrar el UPDATE de la línea ~86).
  - `GET api/piezas.php?estado=&aseguradora=` → tablero; `GET api/piezas.php?sugerir=texto` → `string[]`.
  - `POST api/piezas.php?orden=N` cuerpo pieza → `{id_pieza}`; `PATCH api/piezas.php?id=N&accion=estado` `{estado}`; `PATCH api/piezas.php?id=N&accion=devolver` `{motivo}` → `{id_reemplazo}`; `DELETE api/piezas.php?id=N` (solo admin, `require_admin` existente).
  - `POST api/cargos.php?orden=N` cuerpo cargo → `{id_cargo}`; `DELETE api/cargos.php?id=N`.
- Prueba HTTP: `tests/api_test.php` arranca `C:\xampp\php\php.exe -S 127.0.0.1:8099` con `TALLER_DB=taller_mecanico_test` (agregar en `includes/config.php`: si `getenv('TALLER_DB')` existe, usarlo como `db_name`), hace login con `admin`/clave de prueba creada por `test_reset_db()` y usa `file_get_contents` con contexto HTTP y cookie de sesión.

- [ ] **Step 1: Escribir pruebas HTTP** `test_api_flujo_piezas`: crear orden seguro con 1 pieza → `GET api/ordenes.php?id` trae `piezas[0].estado === 'pendiente'`; `PATCH ...devolver` sin motivo → 400; con motivo → 200 y la orden tiene 2 piezas; `GET api/piezas.php?estado=devuelta` → 1 elemento; `GET api/piezas.php?sugerir=fa` incluye `Faro`; empleado `DELETE api/piezas.php` → 403.
- [ ] **Step 2: Ejecutar** `C:\xampp\php\php.exe tests\run.php api` → FALLA.
- [ ] **Step 3: Implementar** los endpoints (validación en `normalizar_*`, transacción con `db_transaction`, `orden_abierta_o_falla` antes de escribir).
- [ ] **Step 4: Ejecutar** `C:\xampp\php\php.exe tests\run.php` → OK.
- [ ] **Step 5: Commit** `feat: API de piezas, cargos y datos de seguro`

---

### Task 5: Cobro, venta y recibo

**Files:**
- Modify: `api/ventas.php`, `assets/js/cobrar.js`, `assets/js/recibo.js`, `cobrar.php`/`recibo.php` si requieren marcado
- Test: `tests/api_test.php`

**Interfaces:**
- Consumes: `calcular_cobro` (Task 2), `piezas_bloqueantes`, `obtener_orden` (Task 3).
- Produces:
  - `POST api/ventas.php` cuerpo `{id_orden, aplica_iva, metodo_pago, descuento_tipo, descuento_valor}` (sin `mano_obra`). Si `piezas_bloqueantes` no vacío → 409 `'Faltan piezas por instalar: <nombres separados por coma>'`. Inserta en `venta`: `subtotal = piezas + mano_obra + extras` (compatibilidad), `piezas`, `mano_obra`, `extras`, `deducible`, `descuento`, `iva`, `precio_total`, `anticipo`. Pago de liquidación solo si `restante > 0`.
  - `GET api/ventas.php?...` existente devuelve además `tipo`, `aseguradora`, `num_siniestro`, `piezas` (cobrables y no cobrables), `cargos`, y en `venta` los campos nuevos.
  - Cobrar UI: lista de piezas faltantes (bloquea botón), desglose: Piezas cobradas, Mano de obra (solo particular), cada Extra con chip `EXTRA`, Descuento, IVA, Deducible (texto "IVA incluido"), Total, Anticipos, Restante. Se quita el campo de mano de obra; el cálculo en JS replica `calcular_cobro`.
  - Recibo: secciones Piezas (cobradas; las no cobradas de aseguradora se listan sin precio con "Cubierta por <aseguradora>"), Mano de obra, Extras (prefijo `EXTRA ·`), Deducible; encabezado con aseguradora y siniestro en seguro. Ventas viejas (`piezas=0`, `extras=0`, `deducible=0`) se siguen mostrando con `subtotal` y `mano_obra`.

- [ ] **Step 1: Escribir pruebas HTTP** `test_api_cobro`: orden seguro deducible 5000 con pieza pendiente → POST venta 409 con mensaje que contiene el nombre; marcar instalada → POST venta 201 con `precio_total == 5000` y aplica_iva true; orden seguro deducible 0 sin conceptos → 201 total 0 y sin fila en `pago`.
- [ ] **Step 2: Ejecutar** → FALLA. **Step 3: Implementar.** **Step 4: Ejecutar** `C:\xampp\php\php.exe tests\run.php` → OK.
- [ ] **Step 5: Verificación manual** con el servidor (`C:\xampp\php\php.exe -S localhost:8000`): cobrar una orden particular y una de seguro; el recibo muestra extras con `EXTRA` y el total coincide con la pantalla de cobro.
- [ ] **Step 6: Commit** `feat: cobro por conceptos con deducible y extras etiquetados`

---

### Task 6: Pantalla Nueva orden

**Files:**
- Modify: `assets/js/orden_nueva.js`, `orden_nueva.php`, `assets/css/styles.css`

**Interfaces:**
- Consumes: `POST api/ordenes.php` (Task 4), `GET api/piezas.php?sugerir=`, `GET api/configuracion.php` (aseguradoras, Task 9 — mientras tanto usar `config_taller()['aseguradoras']` que Task 3 debe exponer en `config_taller()`).
- Comportamiento:
  - Selector segmentado `Seguro | Particular` al inicio (default Seguro). En Seguro: select aseguradora (de la lista), número de siniestro, deducible ($).
  - Piezas: fila de captura con nombre (con `<datalist>` alimentado por `sugerir`, debounce 250 ms), lado, origen (oculto en particular), cantidad, precio (visible si particular, o si origen taller, o si marcada "Extra"), casilla "Extra (lo pide el cliente)". Lista editable de piezas agregadas.
  - Cargos: "Mano de obra" (solo particular) y "Extras" (concepto + monto) agregables.
  - Resumen lateral con el mismo cálculo que cobrar (sin descuento).
  - Se elimina todo uso de `api/refacciones.php`, `stock` y `Forms.refaccion`. El borrador en localStorage guarda la nueva forma (descartar borradores viejos que tengan `refs`).
  - "Guardar como cotización" se mantiene, enviando conceptos (ver Task 8).

- [ ] **Step 1: Implementar.**
- [ ] **Step 2: Verificar** en el navegador: crear orden de seguro con 2 piezas de aseguradora + 1 extra con precio + 1 extra de servicio; crear orden particular con mano de obra; `GET api/ordenes.php?id=` refleja exactamente lo capturado; intentar particular con pieza sin precio muestra el error del servidor.
- [ ] **Step 3: Commit** `feat: nueva orden con tipo seguro/particular y piezas libres`

---

### Task 7: Detalle de orden y tablero de Piezas

**Files:**
- Modify: `assets/js/ordenes.js`, `includes/layout_top.php`
- Create: `piezas.php`, `assets/js/piezas.js`
- Delete del menú: `refacciones.php` y `assets/js/refacciones.js` (borrar archivos; `api/refacciones.php` también se borra porque ya nada lo usa — verificar con búsqueda `refacciones.php` en el repo antes)

**Interfaces:**
- Consumes: endpoints de Task 4.
- Detalle de orden (modal/panel existente en `ordenes.js`): tabla de piezas con chip de estado (pendiente gris, recibida azul, instalada verde, devuelta rojo con motivo, reemplazo con "Reemplazo de #id"), botones según transición permitida: *Recibida*, *Instalada*, *Devolver* (pide motivo en un modal de la app, no `prompt()`); agregar pieza y cargo; editar datos de seguro. Solo si la orden está pendiente. El listado muestra una marca "Faltan N piezas" cuando hay bloqueantes.
- Tablero `piezas.php`: filtros por estado (Pendientes, Recibidas sin instalar, Devueltas) y aseguradora; columnas Pieza, Lado, Origen, Orden (link a `ordenes.php?id=`), Vehículo/placas, Cliente, Días en el estado; acciones rápidas Recibida/Instalada/Devolver. Menú: clave `piezas`, etiqueta `Piezas`, visible para todos los roles.

- [ ] **Step 1: Implementar.**
- [ ] **Step 2: Verificar** en navegador: devolver una pieza desde el tablero crea el reemplazo y ambas aparecen en el detalle; marcar todas instaladas quita la marca "Faltan piezas" y habilita cobrar.
- [ ] **Step 3: Commit** `feat: seguimiento de piezas en orden y tablero de piezas`

---

### Task 8: Cotizaciones

**Files:**
- Modify: `api/cotizaciones.php`, `assets/js/cotizaciones.js`, `assets/js/cotizacion_imprimir.js`, `assets/js/orden_nueva.js` (envío de cotización)
- Test: `tests/piezas_test.php` o `tests/api_test.php`

**Interfaces:**
- `POST api/cotizaciones.php` cuerpo `{id_vehiculo, rfc_cliente, observaciones, kilometraje, conceptos: [{tipo:'pieza'|'mano_obra'|'extra', concepto, lado, cantidad, precio_unitario}]}`; al menos un concepto; precio ≥ 0 requerido.
- `GET` devuelve `conceptos` y `total` = suma `cantidad*precio` (+16 % IVA mostrado aparte en la impresión, igual que hoy). Cotizaciones viejas ya migradas a `cotizacion_concepto` (Task 1).
- `POST ...&accion=convertir` crea orden **particular** con `crear_orden`: conceptos `pieza` → piezas `origen='taller'`, estado pendiente, con precio; `mano_obra` → cargo mano_obra; `extra` → cargo extra.
- Impresión: secciones Piezas, Mano de obra, Extras con `EXTRA ·`.

- [ ] **Step 1: Escribir prueba** `test_convertir_cotizacion`: cotización con 1 pieza ($1,000 ×2), 1 mano de obra ($800), 1 extra ($500) → orden particular con 1 pieza pendiente precio 1000 cantidad 2, cargos `[mano_obra 800, extra 500]`, cotización `convertida`.
- [ ] **Step 2: Ejecutar** → FALLA. **Step 3: Implementar.** **Step 4: Ejecutar** `C:\xampp\php\php.exe tests\run.php` → OK.
- [ ] **Step 5: Verificar** impresión de una cotización en el navegador.
- [ ] **Step 6: Commit** `feat: cotizaciones con conceptos libres`

---

### Task 9: Reportes, Excel, caja y configuración de aseguradoras

**Files:**
- Modify: `includes/repositorio.php` (`reporte_ordenes`, `reporte_ventas`), `api/excel.php`, `api/caja.php`, `assets/js/reportes.js`, `assets/js/caja.js`, `api/configuracion.php`, `assets/js/configuracion.js`, `configuracion.php`, `api/respaldo.php` (incluir tablas nuevas en el respaldo)

**Interfaces:**
- `reporte_ventas` totales: `total_piezas`, `total_mano_obra`, `total_extras`, `total_deducibles`, `total_iva`, `total` (ventas viejas: `piezas = subtotal` vía migración). `top_refacciones` → `top_piezas` contando por `nombre` en `orden_pieza` con estado ≠ devuelta de órdenes con venta en el rango.
- `reporte_ordenes`: cada orden incluye `tipo`, `aseguradora`, `num_piezas`, `piezas_pendientes`.
- Excel: hojas actualizadas con esas columnas.
- Configuración: sección "Aseguradoras" (lista editable: agregar, quitar, sin duplicados, 1–60 caracteres) guardada como JSON en `configuracion.aseguradoras`; solo admin.

- [ ] **Step 1: Escribir prueba** `test_reporte_ventas_desglose` con una venta seguro (deducible 5000, extra 1000) y una particular (pieza 2000, mano de obra 1000): totales exactos `[2000, 1000, 1000, 5000]` y `top_piezas[0]['nombre']`.
- [ ] **Step 2: Ejecutar** → FALLA. **Step 3: Implementar.** **Step 4: Ejecutar** `C:\xampp\php\php.exe tests\run.php` → OK.
- [ ] **Step 5: Verificar** descarga de Excel y pantalla de caja en navegador.
- [ ] **Step 6: Commit** `feat: reportes y configuración con aseguradoras y desglose de cobro`

---

### Task 10: Datos demo y documentación

**Files:**
- Modify: `database/seed_demo.php`, `README.md`

- [ ] **Step 1:** `seed_demo.php` usa `crear_orden` nuevo: 6 órdenes de seguro (distribuidas entre las 3 aseguradoras, con piezas en todos los estados incluida una devuelta con reemplazo) y 4 particulares; ventas con `calcular_cobro` solo para órdenes sin piezas bloqueantes; ya no crea `refaccion`.
- [ ] **Step 2:** README: instalación incluye `migracion_v3.sql`; sección de módulos describe Piezas, tipos de orden y reglas de cobro (tabla del spec); cómo correr `tests\run.php`.
- [ ] **Step 3: Verificar**: sobre una base vacía (`taller_mecanico_test` recreada) `seed_demo.php` corre sin errores; `C:\xampp\php\php.exe tests\run.php` → todo OK; `php -l` sobre todos los `.php` modificados sin errores.
- [ ] **Step 4: Commit** `docs: datos demo y README para piezas por orden`
