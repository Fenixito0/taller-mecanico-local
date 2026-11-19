<?php
require __DIR__ . '/includes/bootstrap.php';
$user = require_login();
$pageTitle = 'Recibo de venta';
$active = 'ordenes';
$bodyClass = 'print-ticket';
$idOrden = (int) ($_GET['id'] ?? 0);
if ($idOrden <= 0) {
    header('Location: ordenes.php');
    exit;
}
require __DIR__ . '/includes/layout_top.php';
?>
<style>@media print { @page { margin: 0; size: 80mm auto; } }</style>
<div id="recibo-root" data-id="<?= $idOrden ?>">
  <div class="center-screen"><span class="spinner lg"></span></div>
</div>
<?php
$scripts = ['recibo.js'];
require __DIR__ . '/includes/layout_bottom.php';
