<?php
require __DIR__ . '/includes/bootstrap.php';
$user = require_login();
$pageTitle = 'Cotización';
$active = 'cotizaciones';
$bodyClass = 'print-doc';
$idCot = (int) ($_GET['id'] ?? 0);
if ($idCot <= 0) {
    header('Location: cotizaciones.php');
    exit;
}
require __DIR__ . '/includes/layout_top.php';
?>
<style>@media print { @page { margin: 12mm; size: letter; } }</style>
<div id="cot-root" data-id="<?= $idCot ?>">
  <div class="center-screen"><span class="spinner lg"></span></div>
</div>
<?php
$scripts = ['cotizacion_imprimir.js'];
require __DIR__ . '/includes/layout_bottom.php';
