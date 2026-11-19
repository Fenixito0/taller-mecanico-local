<?php
require __DIR__ . '/includes/bootstrap.php';
$user = require_admin_page();
$pageTitle = 'Reportes';
$active = 'reportes';
require __DIR__ . '/includes/layout_top.php';
?>
<div class="page-head" style="align-items:center;margin-bottom:1.5rem">
  <h1 class="page-title">REPORTES</h1>
  <div class="no-print flex" style="gap:0.75rem;align-items:center;flex-wrap:wrap">
    <div class="date-filter"><label for="desde">DESDE</label><input type="date" id="desde"></div>
    <div class="date-filter"><label for="hasta">HASTA</label><input type="date" id="hasta"></div>
    <button type="button" class="btn btn-excel" id="btn-excel" style="padding:0.6rem 1rem;border-radius:8px;font-size:0.8rem;letter-spacing:0.08em;gap:0.4rem">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      EXCEL
    </button>
    <button type="button" class="btn btn-primary" id="btn-print" style="padding:0.6rem 1rem;border-radius:8px;font-size:0.8rem;letter-spacing:0.08em;gap:0.4rem;box-shadow:none">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      IMPRIMIR
    </button>
  </div>
</div>

<div class="chips no-print" id="presets" style="margin-bottom:1rem">
  <button type="button" class="chip" data-preset="hoy">Hoy</button>
  <button type="button" class="chip" data-preset="ayer">Ayer</button>
  <button type="button" class="chip active" data-preset="semana">Esta semana</button>
  <button type="button" class="chip" data-preset="mes">Este mes</button>
  <button type="button" class="chip" data-preset="mes_ant">Mes pasado</button>
  <button type="button" class="chip" data-preset="anio">Este año</button>
</div>

<div class="tabs no-print" id="tabs">
  <button type="button" class="tab active" data-tab="ordenes">ÓRDENES DE SERVICIO</button>
  <button type="button" class="tab" data-tab="ventas">INGRESOS Y VENTAS</button>
</div>

<div id="report"></div>
<?php
$scripts = ['reportes.js'];
require __DIR__ . '/includes/layout_bottom.php';
