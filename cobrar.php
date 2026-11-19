<?php
require __DIR__ . '/includes/bootstrap.php';
$user = require_login();
$pageTitle = 'Cobrar venta';
$active = 'ordenes';
$idOrden = (int) ($_GET['id'] ?? 0);
if ($idOrden <= 0) {
    header('Location: ordenes.php');
    exit;
}
require __DIR__ . '/includes/layout_top.php';
?>
<div id="cobro-root" data-id="<?= $idOrden ?>">
  <div class="center-screen"><span class="spinner lg"></span></div>
</div>
<?php
$scripts = ['cobrar.js'];
require __DIR__ . '/includes/layout_bottom.php';
