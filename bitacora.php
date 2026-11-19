<?php
require __DIR__ . '/includes/bootstrap.php';
$user = require_admin_page();
$pageTitle = 'Bitácora';
$active = 'bitacora';
require __DIR__ . '/includes/layout_top.php';
?>
<div class="page-head">
  <div>
    <h1 class="page-title">BITÁCORA</h1>
    <p class="page-sub" id="count-label">Quién hizo qué y cuándo</p>
  </div>
</div>

<div class="toolbar">
  <div class="search">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="search" id="search" data-search autocomplete="off" placeholder="Buscar acción o usuario...  (atajo: /)">
  </div>
  <select class="input" id="modulo" style="width:auto;min-width:170px"><option value="">Todos los módulos</option></select>
  <div class="date-filter"><label for="desde">DESDE</label><input type="date" id="desde"></div>
  <div class="date-filter"><label for="hasta">HASTA</label><input type="date" id="hasta"></div>
</div>

<div class="card">
  <div id="table-wrap"><div class="loading-box"><span class="spinner"></span><p>Cargando bitácora...</p></div></div>
  <div class="table-foot pager" id="foot"></div>
</div>
<?php
$scripts = ['bitacora.js'];
require __DIR__ . '/includes/layout_bottom.php';
