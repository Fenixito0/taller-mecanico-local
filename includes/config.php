<?php
// Configuración de la aplicación.
// Para cambiar valores sin tocar este archivo, crea includes/config.local.php
// (está en .gitignore) y devuelve un arreglo con las claves que quieras sobrescribir:
//   <?php return ['db_pass' => 'mi_password'];

$config = [
    // MySQL de XAMPP (usuario root sin contraseña por defecto)
    'db_host'  => '127.0.0.1',
    'db_port'  => 3306,
    'db_name'  => 'taller_mecanico',
    'db_user'  => 'root',
    'db_pass'  => '',

    // Zona horaria del taller (las fechas se guardan en UTC en la BD)
    'timezone' => 'America/Mazatlan',

    // Duración de la sesión en segundos (8 horas)
    'session_lifetime' => 8 * 60 * 60,

    // Límite de intentos de login por IP
    'login_max_intentos' => 5,
    'login_ventana_min'  => 15,
];

$localFile = __DIR__ . '/config.local.php';
if (is_file($localFile)) {
    $override = require $localFile;
    if (is_array($override)) {
        $config = array_merge($config, $override);
    }
}

// Solo para las pruebas automáticas (tests/): permite apuntar a la base de pruebas.
if (getenv('TALLER_DB') === 'taller_mecanico_test') {
    $config['db_name'] = 'taller_mecanico_test';
}

return $config;
