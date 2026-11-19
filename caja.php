<?php
require __DIR__ . '/includes/bootstrap.php';
$user = require_login();
$pageTitle = 'Corte de caja';
$active = 'caja';
$bodyClass = 'print-doc';
require __DIR__ . '/includes/layout_top.php';
?>
<style>@media print { @page { margin: 12mm; size: letter; } }</style>
<div class="page-head no-print" style="align-items:center">
  <div>
    <h1 class="page-title">CORTE DE CAJA</h1>
    <p class="page-sub">Todo el dinero que entró y salió en el día: cobros, anticipos y devoluciones</p>
  </div>
  <div class="flex" style="gap:0.75rem;align-items:center;flex-wrap:wrap">
    <button type="button" class="btn btn-outline" id="dia-prev" aria-label="Día anterior">‹</button>
    <div class="date-filter"><label for="fecha">FECHA</label><input type="date" id="fecha"></div>
    <button type="button" class="btn btn-outline" id="dia-next" aria-label="Día siguiente">›</button>
    <button type="button" class="btn btn-outline" id="dia-hoy">Hoy</button>
    <button type="button" class="btn btn-primary" id="btn-print">IMPRIMIR CORTE</button>
  </div>
</div>
<div id="caja-root"><div class="loading-box"><span class="spinner"></span><p>Calculando corte...</p></div></div>
<?php
$scripts = ['caja.js'];
require __DIR__ . '/includes/layout_bottom.php';
