# Piezas por orden, órdenes de seguro/particular y cobro por conceptos

Fecha: 2026-11-17 · Estado: borrador para aprobación

## Por qué

El taller trabaja principalmente con aseguradoras (ANA Seguros, Primero Seguros, Qualitas) y también hace trabajos particulares. En ambos casos las piezas a cambio llegan **para un vehículo específico**: no hay inventario ni piezas repetidas, y si una pieza sale mal se devuelve y se espera el reemplazo.

Hoy el sistema trata las refacciones como un **catálogo de tienda con existencias** (`refaccion.stock`) que se descuenta al crear la orden y se cobra al cliente en la venta. Eso no refleja la realidad: obliga a dar de alta piezas que no se reutilizan, cobra al cliente piezas que paga la aseguradora y no permite saber qué piezas faltan o se devolvieron.

## Qué se quiere (dicho por el usuario)

- Dos tipos de orden:
  - **Seguro**: el valuador de la aseguradora decide qué se repara y qué se cambia. La aseguradora gestiona la mayoría de las piezas (no todas; algunas las consigue el taller). Al cliente se le cobra el **deducible** más los **extras**.
  - **Particular**: el taller hace todo (valuación, pedido de piezas, reparación). Al cliente se le cobra **completo**: piezas, mano de obra y extras.
- **Extras**: cualquier cosa que el cliente pide aparte de lo autorizado (ej. pintar todo el carro en vez de solo la pieza, una pieza que pide aparte). Se cobran con una etiqueta que los identifica como extra.
- Por cada pieza se necesita saber: quién la consigue (aseguradora o taller), y su estado (pendiente → recibida → instalada, o devuelta → esperando reemplazo).
- Una vista para ver piezas pendientes y devoluciones abiertas de todas las órdenes.
- Lo que la aseguradora le paga al taller **se maneja aparte**; el sistema solo registra lo que paga el cliente.

## Metas / no-metas / anti-metas

**Metas**
- Piezas como renglones de cada orden, sin inventario.
- Seguimiento de estado por pieza y tablero de piezas pendientes/devueltas.
- Cobro armado por conceptos según el tipo de orden, con extras etiquetados en el recibo.

**No-metas**
- Cuentas por cobrar a aseguradoras, facturación a aseguradoras, conciliación de pagos de aseguradora.
- Control de proveedores o costos de compra de piezas del taller.
- Inventario de consumibles.

**Anti-metas** (sería un fracaso aunque funcione)
- Que el cliente de un trabajo de seguro vea cobradas piezas que pagó la aseguradora.
- Que capturar una orden sea más lento que hoy (dar de alta piezas en otra pantalla antes de poder usarlas).
- Perder el historial de órdenes y ventas ya registradas.

## Enfoques considerados

- **A. Piezas dentro de cada orden (elegido).** Sin inventario; cada orden tiene su lista de piezas con nombre libre (con sugerencias de nombres usados antes), origen, estado y precio solo cuando se cobra. Refacciones se convierte en un tablero de seguimiento. Elegido porque refleja que cada pieza es de un solo vehículo y no agrega pantallas que mantener.
- **B. Catálogo de nombres + piezas por orden.** Igual que A pero con un catálogo fijo para elegir nombres. Descartado: más mantenimiento sin beneficio real si no hay inventario.
- **Descartado: inventario solo para particulares.** En particulares las piezas también se piden por vehículo; tendría dos modelos para lo mismo.

## Diseño

### Datos (migración `database/migracion_v3.sql`, re-ejecutable como v2)

`ordenservicio` — columnas nuevas:
- `tipo` enum('seguro','particular') NOT NULL DEFAULT 'particular'
- `aseguradora` varchar(60) NULL — texto; se ofrece lista de las aseguradoras configuradas (ver Configuración)
- `num_siniestro` varchar(40) NULL
- `deducible` decimal(10,2) NOT NULL DEFAULT 0

Tabla nueva `orden_pieza` (reemplaza a `detalleorden` para órdenes nuevas):
- `id_pieza` PK, `id_orden` FK → ordenservicio
- `nombre` varchar(100) NOT NULL, `lado` enum('izquierdo','derecho','central','N/A') DEFAULT 'N/A'
- `origen` enum('aseguradora','taller') NOT NULL
- `estado` enum('pendiente','recibida','instalada','devuelta') NOT NULL DEFAULT 'pendiente'
- `cantidad` int NOT NULL DEFAULT 1
- `precio_unitario` decimal(10,2) NULL — precio que se le cobra al cliente; NULL = no se cobra
- `es_extra` tinyint(1) NOT NULL DEFAULT 0 — pieza pedida por el cliente fuera de lo autorizado
- `id_reemplaza` int NULL FK → orden_pieza — si esta pieza es reemplazo de una devuelta
- `motivo_devolucion` varchar(200) NULL
- `fecha_estado` datetime(3) NOT NULL — última vez que cambió de estado (UTC)

Tabla nueva `orden_cargo` (conceptos cobrables que no son piezas):
- `id_cargo` PK, `id_orden` FK
- `tipo` enum('mano_obra','extra') NOT NULL
- `concepto` varchar(150) NOT NULL — ej. "Pintura completa del vehículo"
- `monto` decimal(10,2) NOT NULL

`venta` — columnas nuevas para el desglose: `piezas` decimal(10,2) DEFAULT 0, `extras` decimal(10,2) DEFAULT 0, `deducible` decimal(10,2) DEFAULT 0. Se conservan `subtotal`, `mano_obra`, `descuento`, `iva`, `precio_total`, `anticipo` (las ventas viejas siguen leyéndose igual).

Cotizaciones: tabla nueva `cotizacion_concepto` (id_cotizacion, tipo enum('pieza','mano_obra','extra'), concepto, lado, cantidad, precio_unitario). `detallecotizacion` queda solo para cotizaciones viejas.

`refaccion` y `detalleorden` **no se borran** (historial). La migración copia las piezas de órdenes existentes a `orden_pieza` con `origen='taller'`, `estado='instalada'` si la orden está completada / `'pendiente'` si está pendiente, y su precio. Después de migrar, el código ya no lee `refaccion.stock`.

### Reglas de cobro

| Concepto | Seguro | Particular |
|---|---|---|
| Piezas de la aseguradora | no se cobran (precio NULL) | n/a |
| Piezas del taller (no extra) | no se cobran por defecto; se puede poner precio si el cliente debe pagarla | se cobran |
| Piezas extra | se cobran | se cobran |
| Mano de obra (`orden_cargo` tipo mano_obra) | no se captura | se cobra |
| Extras (`orden_cargo` tipo extra) | se cobran | se cobran |
| Deducible | se cobra | n/a |

**Deducible (decidido por el usuario):** es una cantidad fija que ya incluye IVA. No se le suma IVA ni se le aplica descuento.

Cálculo:
- base = piezas cobrables + mano de obra + extras − descuento (el descuento solo aplica a esta base)
- IVA = 16 % de la base, si aplica
- total = base + IVA + deducible
- Anticipos se restan del total como hoy.

**No se puede cobrar con piezas sin instalar (decidido por el usuario):** el cobro se bloquea si la orden tiene alguna pieza en estado `pendiente` o `recibida`. Las devueltas no bloquean (su reemplazo sí cuenta). La pantalla Cobrar muestra cuáles faltan. Por eso el tablero de Piezas puede limitarse a órdenes pendientes.

### Pantallas

- **Nueva orden**: selector Seguro / Particular al inicio. En Seguro aparecen aseguradora, número de siniestro y deducible. La sección de piezas se captura escribiendo el nombre (sugerencias de nombres usados antes), lado, origen (por defecto "aseguradora" en seguro, "taller" en particular), cantidad y precio (solo visible cuando se cobra). Ya no se requiere al menos una pieza (puede haber trabajos solo de reparación).
- **Detalle de orden (órdenes)**: lista de piezas con su estado y acciones rápidas: *Marcar recibida*, *Marcar instalada*, *Devolver* (pide motivo y crea automáticamente la pieza de reemplazo en estado pendiente ligada con `id_reemplaza`). Se pueden agregar piezas y cargos (mano de obra/extras) mientras la orden esté pendiente.
- **Piezas** (reemplaza la pantalla Refacciones en el menú): tablero de todas las piezas de órdenes pendientes, filtrable por estado (pendientes, devueltas esperando reemplazo, recibidas sin instalar) y por aseguradora; muestra vehículo, orden y días en ese estado.
- **Cobrar**: muestra el desglose según la tabla de reglas; la mano de obra y los extras vienen de la orden (ya no se teclea la mano de obra solo en el cobro); se conservan descuento, IVA, método de pago, anticipos.
- **Recibo y cotización impresa**: secciones Piezas, Mano de obra, Extras (cada extra con etiqueta "EXTRA"), Deducible, totales. En seguro aparece aseguradora y siniestro.
- **Cotizaciones**: se capturan conceptos libres (pieza / mano de obra / extra) con precio; al convertir en orden se crean las piezas y cargos correspondientes. Las cotizaciones son de tipo particular.
- **Reportes / Excel**: el "top de refacciones" pasa a contar por nombre de pieza en `orden_pieza`; los totales de ventas muestran piezas, mano de obra, extras y deducible por separado; se agrega columna tipo/aseguradora en el reporte de órdenes.
- **Configuración**: lista editable de aseguradoras (inicial: ANA Seguros, Primero Seguros, Qualitas) guardada en `configuracion`.

### Cancelación

Cancelar una orden ya no devuelve existencias (no hay). Las piezas quedan con su estado; anticipos se devuelven como hoy.

### Decisiones tomadas tras la revisión (criterio de diseño, corregibles)

- **Piezas devueltas no se cobran.** Solo cuentan para el total las piezas con estado distinto de `devuelta`. La pieza de reemplazo hereda `nombre`, `lado`, `origen`, `cantidad`, `precio_unitario` y `es_extra` de la devuelta.
- **Datos del seguro editables.** Mientras la orden esté pendiente se pueden editar tipo, aseguradora, número de siniestro y deducible (nuevo endpoint de edición). Al cambiar de seguro → particular, las piezas de origen aseguradora se pasan a origen taller sin precio (el usuario debe ponérselo); al cambiar particular → seguro, los cargos de mano de obra se conservan pero no se cobran (se muestran tachados con aviso).
- **Cotizaciones abiertas viejas** se migran: cada renglón de `detallecotizacion` se copia a `cotizacion_concepto` como tipo `pieza` con su nombre, lado, cantidad y precio. Tras la migración solo existe un camino de conversión.

## Restricciones

- PHP 8.1 + MySQL/MariaDB de XAMPP, sin frameworks ni dependencias (como el resto del proyecto).
- Migración idempotente (`IF NOT EXISTS`), sin borrar datos.
- Fechas en UTC en la BD, igual que hoy.
- Permisos actuales se mantienen (empleado no elimina, reportes solo admin).

## Lo que queda a criterio del implementador

- Distribución exacta de componentes en pantalla y estilos (seguir los existentes en `assets/css`).
- Nombres de funciones y endpoints nuevos, siguiendo la convención actual de `api/*.php` e `includes/repositorio.php`.
- Actualizar `database/seed_demo.php` al modelo nuevo.
