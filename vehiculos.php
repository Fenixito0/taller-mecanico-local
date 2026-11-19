<?php
require __DIR__ . '/includes/bootstrap.php';
$user = require_login();
$pageTitle = 'Vehículos';
$active = 'vehiculos';
require __DIR__ . '/includes/layout_top.php';
?>
<div class="page-head">
  <div>
    <h1 class="page-title">VEHÍCULOS</h1>
    <p class="page-sub" id="count-label">Cargando…</p>
  </div>
  <button type="button" class="btn btn-primary" id="btn-new">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Nuevo Vehículo
  </button>
</div>

<div class="toolbar">
  <div class="search wide">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="search" id="search" data-search autocomplete="off" placeholder="Buscar por marca, modelo, placas...  (atajo: /)">
  </div>
</div>

<div class="card">
  <div id="table-wrap"><div class="loading-box"><span class="spinner"></span><p>Cargando vehículos...</p></div></div>
  <div class="table-foot" id="foot"></div>
</div>
<?php
$scripts = ['combo.js', 'forms.js', 'vehiculos.js'];
require __DIR__ . '/includes/layout_bottom.php';
