# Taller Mecánico — versión local (XAMPP)

Sistema de gestión para taller mecánico hecho solo con **PHP, HTML, CSS y JavaScript** (sin frameworks ni dependencias externas). Usa la base de datos MySQL de XAMPP.

Módulos: clientes, vehículos, órdenes de servicio de **seguro** o **particulares** con seguimiento de sus piezas, cotizaciones, cobro con recibo de 80 mm, corte de caja, reportes y exportación a Excel (.xlsx).

## Requisitos

- XAMPP con **Apache** y **MySQL** (PHP 8.1 o superior).

## Instalación

1. Copia la carpeta del proyecto a `C:\xampp\htdocs\taller-mecanico` (o crea un alias de Apache hacia esta carpeta).
2. Arranca Apache y MySQL desde el panel de XAMPP.
3. Crea o actualiza la base de datos (no borra datos existentes):

   ```
   C:\xampp\mysql\bin\mysql.exe -uroot < database\schema.sql
   C:\xampp\mysql\bin\mysql.exe -uroot < database\migracion_v2.sql
   C:\xampp\mysql\bin\mysql.exe -uroot < database\migracion_v3.sql
   C:\xampp\mysql\bin\mysql.exe -uroot < database\migracion_v4.sql
   ```

   `migracion_v2.sql` agrega etapas, kilometraje, pagos/anticipos, descuentos, cotizaciones y la configuración del taller. `migracion_v3.sql` agrega las órdenes de seguro, las piezas por orden, los cargos (mano de obra y extras) y la lista de aseguradoras; copia las refacciones de las órdenes anteriores como piezas. `migracion_v4.sql` agrega los catálogos de **marcas, modelos y piezas** (con las más comunes en México y lo que ya estaba capturado). Todas se pueden ejecutar varias veces sin dañar datos.

4. Crea un usuario (mínimo 8 caracteres de contraseña):

   ```
   C:\xampp\php\php.exe database\crear_usuario.php admin MiClaveSegura admin "Administrador"
   ```

   El rol puede ser `admin` o `empleado`. Si el usuario ya existe, se actualiza su contraseña.

5. Abre <http://localhost/taller-mecanico/>.

Para probar con datos de ejemplo (solo si la base no tiene clientes): `C:\xampp\php\php.exe database\seed_demo.php` crea 10 clientes con su vehículo y 10 órdenes de seguro y particulares, con piezas en todos los estados.

### Sin Apache (servidor integrado de PHP)

```
cd C:\Proyectos\taller-mecanico-local
C:\xampp\php\php.exe -S localhost:8000
```

Luego abre <http://localhost:8000/>. (Las reglas de `.htaccess` solo aplican con Apache.)

## Configuración

Los valores por defecto están en `includes/config.php` (MySQL en `127.0.0.1:3306`, base `taller_mecanico`, usuario `root` sin contraseña, zona horaria `America/Mazatlan`).

Para cambiarlos sin tocar ese archivo, crea `includes/config.local.php` (ignorado por git):

```php
<?php
return [
    'db' => ['pass' => 'mi_contraseña'],
    'timezone' => 'America/Mexico_City',
];
```

## Estructura

| Carpeta / archivo | Contenido |
|---|---|
| `*.php` (raíz) | Páginas: login, generar orden, órdenes, piezas, cotizaciones, corte de caja, cobrar, recibo, clientes, vehículos, reportes, usuarios, bitácora, configuración |
| `api/` | Endpoints JSON usados por el frontend y la exportación a Excel |
| `includes/` | Configuración, conexión PDO, sesión/autenticación, consultas, reglas de piezas y cobro, y generador de .xlsx |
| `assets/` | CSS, JavaScript, fuentes e ícono |
| `database/` | Esquema SQL, migraciones, script para crear usuarios y datos de ejemplo |
| `tests/` | Pruebas automáticas |

## Uso rápido

Al iniciar sesión se abre **Generar Orden**. Ahí mismo puedes registrar clientes y vehículos nuevos sin salir del asistente, elegir si la orden es de **seguro** (aseguradora, número de siniestro y deducible) o **particular**, capturar las piezas a cambio (y en particular la mano de obra y los extras), anotar el kilometraje y ver el historial del cliente. Si el cliente de un trabajo particular aún no aprueba, usa **Guardar como cotización**. Si sales a medias, la orden en progreso se recupera al volver.

### Para evitar errores de captura

- **Nada se escribe libre si puede elegirse**: marca, modelo (solo los de la marca elegida), pieza y cliente propietario se eligen de una lista con buscador. Si no existe, la lista ofrece **Agregar** (con confirmación) y queda para todos.
- **Placas**: 6 o 7 letras y números, con letras y números a la vez; los guiones y espacios se quitan solos. Se avisa si ya están registradas.
- **Número de siniestro**: obligatorio en seguro, solo letras y números, de 12 a 16 caracteres (se pasa a mayúsculas solo).
- **RFC**: formato del SAT (3 o 4 letras, fecha AAMMDD válida y 3 de homoclave).
- **Los botones no se bloquean**: si falta algo aparece una advertencia y el sistema te lleva al dato que falta, resaltado. Lo mismo al cobrar (piezas sin instalar, descuento inválido, efectivo insuficiente); antes de registrar un cobro se pide confirmación.
- Si escribiste una pieza o un extra y no le diste «Agregar», se avisa antes de seguir.
- Cambiar una orden a seguro cuando ya tiene precios, mano de obra o extras pide confirmación.

### Piezas

No hay inventario: cada pieza llega para un vehículo en particular y se captura dentro de su orden, con su lado, quién la consigue (**aseguradora** o **taller**) y su estado:

*Pendiente* (por llegar) → *Recibida* → *Instalada*. Si llega mal se marca **Devuelta** con el motivo, y el sistema crea sola la pieza de reemplazo como *Pendiente*.

La pantalla **Piezas** junta las piezas por atender de todas las órdenes abiertas, con filtros por estado y aseguradora y los días que llevan en ese estado. Una orden **no se puede cobrar** mientras tenga piezas pendientes o recibidas sin instalar.

### Qué se le cobra al cliente

| Tipo de orden | Se cobra |
|---|---|
| Seguro | Solo el **deducible**, que ya incluye IVA y no lleva descuento. Las órdenes de seguro **no llevan extras ni cobros aparte**: si el cliente pide algo más, se hace otra orden particular |
| Particular | Piezas + mano de obra + extras, más IVA |

Los **extras** (solo en órdenes particulares) son trabajos que el cliente pide aparte (por ejemplo, pintar todo el carro) y aparecen marcados como `EXTRA` en la orden, el recibo y la cotización. Lo que la aseguradora le paga al taller se lleva fuera del sistema.

### Flujo de una orden

1. **Generar Orden**: tipo de orden, piezas, mano de obra y extras (particular).
2. **Órdenes**: la flecha o el folio abren la orden en su **propia página** (`orden.php?id=N`, imprimible) para marcar piezas recibidas, instaladas o devueltas, agregar piezas o cargos y corregir los datos del seguro; avanza la etapa *Recibido → Reparación → Listo*, registra **anticipos** y avisa al cliente con el botón **WhatsApp**, que abre el chat con el mensaje ya escrito; nada se envía solo.
3. **Cobrar**: disponible cuando todas las piezas están instaladas. **Descuento** en $ o % (no aplica al deducible) e IVA. Los anticipos se restan del total.
4. **Cancelar**: si hubo anticipos, se registra la devolución.

### Otros módulos

| Módulo | Para qué sirve | Quién lo ve |
|---|---|---|
| Cotizaciones | Presupuestos de trabajos particulares (piezas, mano de obra y extras) imprimibles; se convierten en orden con un clic | Todos |
| Corte de caja | Dinero del día por método y por tipo (cobros, anticipos, devoluciones), imprimible | Todos |
| Reportes | Ingresos y órdenes por periodo, con exportación a Excel | Administrador |
| Usuarios | Altas, cambio de rol, desactivar cuentas y restablecer contraseñas | Administrador |
| Bitácora | Quién hizo qué y cuándo, con filtros | Administrador |
| Configuración | Nombre, dirección, teléfono y RFC del taller, que aparecen en el login, el recibo, las cotizaciones y el Excel; la lista de **aseguradoras**; y el **respaldo** de la base en un clic | Administrador |

El rol **empleado** no puede eliminar clientes, vehículos, cotizaciones, piezas pendientes ni cargos, y no ve reportes de ingresos. Cualquier usuario puede cambiar su contraseña dando clic en su nombre (arriba a la derecha) y alternar el **modo oscuro** con el botón de luna o sol.

| Atajo | Acción |
|---|---|
| `Alt + N` | Ir a Generar Orden desde cualquier pantalla |
| `/` | Enfocar el buscador de la pantalla |
| `Enter` en el buscador | Elegir el único resultado (o registrar uno nuevo si no hay resultados) |
| `Ctrl + Enter` | Siguiente paso / generar orden / registrar cobro |
| `Enter` en un formulario | Guardar |
| `Esc` | Cerrar ventana o menú |

## Pruebas

```
C:\xampp\php\php.exe tests\run.php           # todas
C:\xampp\php\php.exe tests\run.php cobro     # solo un archivo o una prueba (filtro por nombre)
```

Requieren MySQL encendido. Usan una base aparte, `taller_mecanico_test`, que se recrea desde los scripts de `database/` en cada corrida; tus datos no se tocan. Las pruebas de la API levantan el servidor integrado de PHP en el puerto 8099.

## Seguridad

- Sesiones con cookie `HttpOnly` y `SameSite=Lax`, que expiran a las 8 horas.
- Token CSRF en todas las peticiones que modifican datos.
- Límite de 5 intentos de inicio de sesión por IP cada 15 minutos.
- Consultas preparadas (PDO) en toda la aplicación.
- Precios y totales calculados en el servidor, no en el navegador.
- `includes/` y `database/` no son accesibles desde el navegador con Apache.
