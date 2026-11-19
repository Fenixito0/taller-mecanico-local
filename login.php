<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/repositorio.php';

if (usuario_actual()) {
    header('Location: orden_nueva.php');
    exit;
}
$taller = config_taller();
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="<?= e(csrf_token()) ?>">
  <title><?= e($taller['nombre_taller']) ?> — Iniciar sesión</title>
  <meta name="description" content="Sistema de gestión para taller mecánico">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/styles.css">
  <script>if (localStorage.getItem("tema") === "oscuro") document.documentElement.classList.add("dark")</script>
</head>
<body>
<div class="login">

  <div class="login-right">
    <div class="login-card">
      <div class="login-logo" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
      </div>
      <p class="login-taller"><?= e($taller['nombre_taller']) ?></p>
      <?php if ($taller['eslogan'] !== ''): ?><p class="login-eslogan"><?= e($taller['eslogan']) ?></p><?php endif; ?>
      <h2>INICIAR SESIÓN</h2>
      <p class="lead">Ingrese sus credenciales para acceder al sistema</p>

      <div class="alert anim" id="login-error" hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span></span>
      </div>

      <form id="login-form" novalidate>
        <div class="field">
          <label class="label" for="username">Usuario</label>
          <input class="input" type="text" id="username" name="username" required autofocus autocomplete="username" placeholder="Ingrese su usuario">
        </div>
        <div class="field last">
          <label class="label" for="password">Contraseña</label>
          <div class="pass-wrap">
            <input class="input" type="password" id="password" name="password" required autocomplete="current-password" placeholder="Ingrese su contraseña">
            <button type="button" class="pass-toggle" id="toggle-pass" aria-label="Mostrar contraseña">
              <svg data-show width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg data-hide hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="btn-login" style="padding:1rem;letter-spacing:0.15em;box-shadow:none">INGRESAR AL SISTEMA</button>
      </form>
    </div>
  </div>
</div>
<script src="assets/js/common.js"></script>
<script src="assets/js/login.js"></script>
</body>
</html>
