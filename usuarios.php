<?php
require __DIR__ . '/includes/bootstrap.php';
$user = require_admin_page();
$pageTitle = 'Usuarios';
$active = 'usuarios';
require __DIR__ . '/includes/layout_top.php';
?>
<div class="page-head">
  <div>
    <h1 class="page-title">USUARIOS</h1>
    <p class="page-sub" id="count-label">Cargando…</p>
  </div>
  <button type="button" class="btn btn-primary" id="btn-new">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Nuevo usuario
  </button>
</div>

<div class="card" style="margin-bottom:1rem;padding:1rem 1.25rem">
  <p style="font-size:0.85rem;color:var(--text-2);line-height:1.6">
    <b>Administrador:</b> acceso completo (reportes, usuarios, bitácora, configuración, respaldos y eliminar registros).<br>
    <b>Empleado:</b> genera órdenes y cotizaciones, cobra, registra anticipos y ve el corte de caja; no puede eliminar ni ver reportes de ingresos.
  </p>
</div>

<div class="card">
  <div id="table-wrap"><div class="loading-box"><span class="spinner"></span><p>Cargando usuarios...</p></div></div>
</div>
<?php
$scripts = ['usuarios.js'];
require __DIR__ . '/includes/layout_bottom.php';
