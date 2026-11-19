<?php
require __DIR__ . '/includes/bootstrap.php';
$user = require_login();
$pageTitle = 'Generar orden';
$active = 'nueva';
require __DIR__ . '/includes/layout_top.php';
?>
<div id="wizard-root">
  <div class="page-head" style="align-items:center">
    <div>
      <h1 class="page-title">GENERAR ORDEN DE SERVICIO</h1>
      <p class="page-sub" style="margin-top:0">Selecciona cliente, vehículo y el trabajo a realizar. Si no existen, regístralos aquí mismo.</p>
    </div>
    <button type="button" class="btn btn-outline" id="btn-reset" hidden style="font-size:0.8rem">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
      Empezar de nuevo
    </button>
  </div>

  <div class="steps" id="steps"></div>

  <div class="wizard">
    <div>
      <div id="step-content"></div>
      <div class="wizard-nav">
        <button type="button" class="btn btn-outline" id="btn-prev" style="font-size:0.85rem">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Anterior
        </button>
        <span class="kbd-hint" id="nav-hint"></span>
        <button type="button" class="btn btn-primary" id="btn-next" style="padding:0.8rem 1.75rem"></button>
      </div>
    </div>

    <div class="side-panel">
      <div class="side-card">
        <div class="side-card-head"><h3>Resumen de Orden</h3></div>
        <div class="red-line"></div>
        <div class="side-card-body" id="side-summary"></div>
      </div>
    </div>
  </div>
</div>
<?php
$scripts = ['combo.js', 'forms.js', 'orden_nueva.js'];
require __DIR__ . '/includes/layout_bottom.php';
