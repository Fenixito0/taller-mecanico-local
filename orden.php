<?php
// Detalle de una orden en su propia página: orden.php?id=N
require __DIR__ . '/includes/bootstrap.php';
$user = require_login();
$idOrden = isset($_GET['id']) ? (int) $_GET['id'] : 0;
$pageTitle = $idOrden > 0 ? sprintf('Orden #%04d', $idOrden) : 'Orden';
$active = 'ordenes';
require __DIR__ . '/includes/layout_top.php';
?>
<div id="orden-root" data-id="<?= $idOrden ?>">
  <div class="loading-box"><span class="spinner"></span><p>Cargando orden...</p></div>
</div>
<?php
$scripts = ['combo.js', 'piezas_ui.js', 'orden_acciones.js', 'orden.js'];
require __DIR__ . '/includes/layout_bottom.php';
