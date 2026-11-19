<?php
require __DIR__ . '/includes/bootstrap.php';

header('Location: ' . (usuario_actual() ? 'orden_nueva.php' : 'login.php'));
exit;
