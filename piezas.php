<?php
require __DIR__ . '/includes/bootstrap.php';
$user = require_login();
$pageTitle = 'Piezas';
$active = 'piezas';
require __DIR__ . '/includes/layout_top.php';
?>
<div class="page-head">
  <div>
    <h1 class="page-title">SEGUIMIENTO DE PIEZAS</h1>
    <p class="page-sub" id="count-label">Cargando…</p>
  </div>
</div>

<div class="toolbar">
  <div class="search">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="search" id="search" data-search autocomplete="off" placeholder="Buscar pieza, placas, cliente u orden...  (atajo: /)">
  </div>
  <div class="chips" id="filtro-estado">
    <button type="button" class="chip active" data-val="">Por atender</button>
    <button type="button" class="chip" data-val="pendiente">Por llegar</button>
    <button type="button" class="chip" data-val="recibida">Recibidas sin instalar</button>
    <button type="button" class="chip" data-val="devuelta">Devueltas</button>
  </div>
  <select class="input" id="filtro-aseg" style="width:auto;min-width:180px" aria-label="Aseguradora">
    <option value="">Todas las aseguradoras</option>
  </select>
</div>

<div class="card">
  <div id="table-wrap"><div class="loading-box"><span class="spinner"></span><p>Cargando piezas...</p></div></div>
  <div class="table-foot" id="foot"></div>
</div>
<?php
$scripts = ['combo.js', 'piezas_ui.js', 'piezas.js'];
require __DIR__ . '/includes/layout_bottom.php';
