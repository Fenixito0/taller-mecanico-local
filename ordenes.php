<?php
require __DIR__ . '/includes/bootstrap.php';
$user = require_login();
$pageTitle = 'Órdenes';
$active = 'ordenes';
require __DIR__ . '/includes/layout_top.php';
?>
<div class="page-head">
  <div>
    <h1 class="page-title">ÓRDENES DE SERVICIO</h1>
    <p class="page-sub" id="count-label">Cargando…</p>
  </div>
  <a href="orden_nueva.php" class="btn btn-primary">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Nueva Orden
  </a>
</div>

<div class="stat-cards">
  <div class="stat-card"><div class="ico" style="background:#FFF7ED"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div><p class="n" style="color:#C2410C" id="c-pendiente">0</p><p class="l">Pendientes</p></div></div>
  <div class="stat-card"><div class="ico" style="background:#F0FDF4"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div><p class="n" style="color:#15803D" id="c-completado">0</p><p class="l">Completadas</p></div></div>
  <div class="stat-card"><div class="ico" style="background:#FFF1F2"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BE123C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div><div><p class="n" style="color:#BE123C" id="c-cancelado">0</p><p class="l">Canceladas</p></div></div>
</div>

<div class="toolbar">
  <div class="search">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="search" id="search" data-search autocomplete="off" placeholder="Buscar por folio, cliente, placas...  (atajo: /)">
  </div>
  <div class="chips" id="filtro-estado">
    <button type="button" class="chip active" data-val="todos">Todos</button>
    <button type="button" class="chip" data-val="pendiente">Pendiente</button>
    <button type="button" class="chip" data-val="listo">Listas para entregar</button>
    <button type="button" class="chip" data-val="completado">Completado</button>
    <button type="button" class="chip" data-val="cancelado">Cancelado</button>
  </div>
</div>

<div class="card">
  <div id="table-wrap"><div class="loading-box"><span class="spinner"></span><p>Cargando órdenes...</p></div></div>
  <div class="table-foot" id="foot" hidden></div>
</div>
<?php
$scripts = ['combo.js', 'piezas_ui.js', 'orden_acciones.js', 'ordenes.js'];
require __DIR__ . '/includes/layout_bottom.php';
