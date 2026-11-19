<?php
require __DIR__ . '/includes/bootstrap.php';
$user = require_admin_page();
$pageTitle = 'Configuración';
$active = 'configuracion';
require __DIR__ . '/includes/layout_top.php';
?>
<div class="page-head">
  <div>
    <h1 class="page-title">CONFIGURACIÓN</h1>
    <p class="page-sub">Datos del taller que aparecen en recibos, cotizaciones, cortes, Excel y el inicio de sesión</p>
  </div>
</div>

<div class="cfg-grid">
  <form class="card cfg-card" id="cfg-form" novalidate>
    <h3 class="cfg-title">DATOS DEL TALLER</h3>
    <div class="alert" id="cfg-err" hidden></div>
    <div class="field"><label class="label" for="nombre_taller">Nombre del taller <span class="req">*</span></label>
      <input class="input" id="nombre_taller" name="nombre_taller" maxlength="100" required></div>
    <div class="field"><label class="label" for="eslogan">Eslogan / giro</label>
      <input class="input" id="eslogan" name="eslogan" maxlength="100" placeholder="Ej. Servicio automotriz integral"></div>
    <div class="field"><label class="label" for="direccion">Dirección</label>
      <input class="input" id="direccion" name="direccion" maxlength="200" placeholder="Calle, número, colonia, ciudad"></div>
    <div class="cfg-2">
      <div class="field"><label class="label" for="telefono">Teléfono</label>
        <input class="input" id="telefono" name="telefono" maxlength="30" inputmode="tel"></div>
      <div class="field"><label class="label" for="rfc">RFC</label>
        <input class="input mono" id="rfc" name="rfc" maxlength="13" style="text-transform:uppercase" placeholder="Opcional">
        <p class="hint">12 caracteres (moral) o 13 (física)</p></div>
    </div>
    <div class="field"><label class="label" for="mensaje_recibo">Mensaje al pie del recibo</label>
      <input class="input" id="mensaje_recibo" name="mensaje_recibo" maxlength="150"></div>
    <button type="submit" class="btn btn-primary" id="cfg-save" style="box-shadow:none">GUARDAR CAMBIOS</button>
  </form>

  <div class="card cfg-card">
    <h3 class="cfg-title">ASEGURADORAS</h3>
    <p style="font-size:0.88rem;color:var(--text-2);line-height:1.6;margin-bottom:1rem">
      Aparecen al crear una orden de seguro y en el filtro del tablero de piezas.
    </p>
    <div class="alert" id="aseg-err" hidden></div>
    <div id="aseg-lista"></div>
    <div class="flex" style="gap:0.5rem;margin:0.75rem 0 1rem">
      <input class="input" id="aseg-nueva" maxlength="60" placeholder="Nombre de la aseguradora" aria-label="Nueva aseguradora">
      <button type="button" class="btn btn-soft" id="aseg-add">AGREGAR</button>
    </div>
    <button type="button" class="btn btn-primary" id="aseg-save" style="box-shadow:none">GUARDAR ASEGURADORAS</button>
  </div>

  <div class="card cfg-card">
    <h3 class="cfg-title">RESPALDO DE LA BASE DE DATOS</h3>
    <p style="font-size:0.88rem;color:var(--text-2);line-height:1.6;margin-bottom:1rem">
      Descarga un archivo <b>.sql</b> con toda la información (clientes, vehículos, órdenes y sus piezas, ventas, pagos,
      cotizaciones, usuarios y bitácora). Guárdalo en una USB o en la nube.
    </p>
    <button type="button" class="btn btn-excel" id="btn-respaldo">DESCARGAR RESPALDO</button>
    <p class="hint" style="margin-top:1rem;line-height:1.6">Para restaurar: abre phpMyAdmin, selecciona la base <span class="mono">taller_mecanico</span> → Importar → elige el archivo. <b>Reemplaza los datos actuales.</b></p>
  </div>
</div>
<?php
$scripts = ['configuracion.js'];
require __DIR__ . '/includes/layout_bottom.php';
