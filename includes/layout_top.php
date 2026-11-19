<?php
/**
 * Cabecera del panel (sidebar + barra superior).
 * Variables esperadas: $user (usuario en sesión), $pageTitle, $active (clave del menú).
 */

require_once __DIR__ . '/repositorio.php';

$navGrupos = [
    'OPERACIÓN' => [
        ['key' => 'nueva', 'href' => 'orden_nueva.php', 'label' => 'Generar Orden',
         'icon' => '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>'],
        ['key' => 'ordenes', 'href' => 'ordenes.php', 'label' => 'Órdenes', 'badge' => 'pendientes',
         'icon' => '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'],
        ['key' => 'piezas', 'href' => 'piezas.php', 'label' => 'Piezas',
         'icon' => '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>'],
        ['key' => 'cotizaciones', 'href' => 'cotizaciones.php', 'label' => 'Cotizaciones',
         'icon' => '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>'],
        ['key' => 'caja', 'href' => 'caja.php', 'label' => 'Corte de Caja',
         'icon' => '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/>'],
    ],
    'CATÁLOGOS' => [
        ['key' => 'clientes', 'href' => 'clientes.php', 'label' => 'Clientes',
         'icon' => '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>'],
        ['key' => 'vehiculos', 'href' => 'vehiculos.php', 'label' => 'Vehículos',
         'icon' => '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'],
    ],
    'ADMINISTRACIÓN' => [
        ['key' => 'reportes', 'href' => 'reportes.php', 'label' => 'Reportes', 'admin' => true,
         'icon' => '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'],
        ['key' => 'usuarios', 'href' => 'usuarios.php', 'label' => 'Usuarios', 'admin' => true,
         'icon' => '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>'],
        ['key' => 'bitacora', 'href' => 'bitacora.php', 'label' => 'Bitácora', 'admin' => true,
         'icon' => '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'],
        ['key' => 'configuracion', 'href' => 'configuracion.php', 'label' => 'Configuración', 'admin' => true,
         'icon' => '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>'],
    ],
];
$esAdmin = es_admin($user);
$svgOpen = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
$bodyClass = $bodyClass ?? '';
$taller = config_taller();

// Contador de órdenes pendientes de cobro (se muestra en el menú)
try {
    $pendientesMenu = (int) (db_one("SELECT COUNT(*) AS n FROM ordenservicio WHERE estado = 'pendiente'")['n'] ?? 0);
} catch (Throwable $e) {
    log_error('menu_pendientes', $e);
    $pendientesMenu = 0;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="<?= e(csrf_token()) ?>">
  <meta name="user-rol" content="<?= e($user['rol']) ?>">
  <title><?= e($pageTitle ?? 'Panel') ?> — <?= e($taller['nombre_taller']) ?></title>
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/styles.css">
  <script>
    if (localStorage.getItem("sidebarCollapsed") === "1") document.documentElement.classList.add("collapsed")
    if (localStorage.getItem("tema") === "oscuro") document.documentElement.classList.add("dark")
  </script>
</head>
<body class="<?= e($bodyClass) ?>">
<div class="shell">
  <aside class="sidebar">
    <div class="sidebar-top"></div>
    <div class="sidebar-logo">
      <div class="ico">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
      </div>
      <div class="txt">
        <p class="t1"><?= e(mb_strtoupper($taller['nombre_taller'])) ?></p>
        <p class="t2"><?= e(mb_strtoupper($taller['eslogan'])) ?></p>
      </div>
    </div>

    <nav>
      <?php foreach ($navGrupos as $grupo => $items): ?>
        <?php $visibles = array_filter($items, static fn (array $i): bool => empty($i['admin']) || $esAdmin); ?>
        <?php if (!$visibles) continue; ?>
        <p class="nav-title"><?= e($grupo) ?></p>
        <?php foreach ($visibles as $item): ?>
          <div class="nav-wrap">
            <a href="<?= e($item['href']) ?>" class="nav-item<?= ($active ?? '') === $item['key'] ? ' active' : '' ?>" title="<?= e($item['label']) ?>">
              <?= $svgOpen . $item['icon'] ?></svg>
              <span><?= e($item['label']) ?></span>
              <?php if (($item['badge'] ?? '') === 'pendientes' && $pendientesMenu > 0): ?>
                <b class="nav-badge" title="<?= $pendientesMenu ?> orden(es) pendiente(s) de cobro"><?= $pendientesMenu ?></b>
              <?php endif; ?>
            </a>
          </div>
        <?php endforeach; ?>
      <?php endforeach; ?>
    </nav>

    <div class="sidebar-foot">
      <button type="button" class="side-btn collapse" id="btn-collapse">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        <span>Colapsar menú</span>
      </button>
      <button type="button" class="side-btn logout" id="btn-logout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        <span>Cerrar sesión</span>
      </button>
    </div>
  </aside>

  <main class="main">
    <header class="topbar">
      <button type="button" class="menu-toggle" id="btn-menu" aria-label="Abrir menú">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <?php if (($active ?? '') !== 'nueva'): ?>
        <a href="orden_nueva.php" class="btn btn-primary topbar-cta" title="Generar orden (Alt+N)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva orden
        </a>
      <?php endif; ?>
      <button type="button" class="icon-btn" id="btn-tema" title="Cambiar tema claro / oscuro" aria-label="Cambiar tema">
        <svg class="i-luna" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        <svg class="i-sol" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      </button>
      <button type="button" class="user-chip" id="btn-cuenta" title="Mi cuenta: cambiar contraseña">
        <div class="avatar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div>
          <p class="n"><?= e($user['name']) ?></p>
          <p class="r"><?= e($user['username']) ?> · <?= e($user['rol']) ?></p>
        </div>
      </button>
    </header>
    <div class="content">
