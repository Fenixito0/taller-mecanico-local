-- Esquema de la base de datos del Taller Mecánico (MySQL / MariaDB de XAMPP).
-- Compatible con la base de datos creada anteriormente por Prisma: si ya tienes
-- las tablas, solo se creará la tabla nueva `login_intento`.
--
-- Uso (phpMyAdmin → pestaña SQL, o consola):
--   mysql -u root < database/schema.sql

CREATE DATABASE IF NOT EXISTS taller_mecanico CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SET NAMES utf8mb4;
USE taller_mecanico;

CREATE TABLE IF NOT EXISTS `usuario` (
  `id_usuario` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `nombre` varchar(100) DEFAULT NULL,
  `rol` enum('admin','empleado') NOT NULL DEFAULT 'empleado',
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `Usuario_username_key` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cliente` (
  `rfc` varchar(13) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellido_paterno` varchar(60) NOT NULL,
  `apellido_materno` varchar(60) DEFAULT NULL,
  `telefono` varchar(15) DEFAULT NULL,
  `correo` varchar(100) DEFAULT NULL,
  `fecha_registro` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`rfc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vehiculo` (
  `id_vehiculo` int(11) NOT NULL AUTO_INCREMENT,
  `marca` varchar(60) DEFAULT NULL,
  `modelo` varchar(100) NOT NULL,
  `anio` int(11) NOT NULL,
  `color` varchar(50) DEFAULT NULL,
  `placas` varchar(10) NOT NULL,
  PRIMARY KEY (`id_vehiculo`),
  UNIQUE KEY `Vehiculo_placas_key` (`placas`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vehiculocliente` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_vehiculo` int(11) NOT NULL,
  `rfc_cliente` varchar(13) NOT NULL,
  `fecha` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `VehiculoCliente_id_vehiculo_rfc_cliente_key` (`id_vehiculo`,`rfc_cliente`),
  KEY `VehiculoCliente_rfc_cliente_fkey` (`rfc_cliente`),
  CONSTRAINT `VehiculoCliente_id_vehiculo_fkey` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculo` (`id_vehiculo`) ON UPDATE CASCADE,
  CONSTRAINT `VehiculoCliente_rfc_cliente_fkey` FOREIGN KEY (`rfc_cliente`) REFERENCES `cliente` (`rfc`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `refaccion` (
  `id_refaccion` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `lado` enum('izquierdo','derecho','central','N/A') NOT NULL DEFAULT 'N/A',
  `precio_unitario` decimal(10,2) NOT NULL DEFAULT 0.00,
  `stock` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id_refaccion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ordenservicio` (
  `id_orden` int(11) NOT NULL AUTO_INCREMENT,
  `id_vehiculo` int(11) NOT NULL,
  `rfc_cliente` varchar(13) NOT NULL,
  `id_usuario` int(11) DEFAULT NULL,
  `fecha_creacion` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `estado` enum('pendiente','completado','cancelado') NOT NULL DEFAULT 'pendiente',
  `observaciones` text DEFAULT NULL,
  PRIMARY KEY (`id_orden`),
  KEY `OrdenServicio_id_vehiculo_fkey` (`id_vehiculo`),
  KEY `OrdenServicio_rfc_cliente_fkey` (`rfc_cliente`),
  KEY `OrdenServicio_id_usuario_fkey` (`id_usuario`),
  CONSTRAINT `OrdenServicio_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `OrdenServicio_id_vehiculo_fkey` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculo` (`id_vehiculo`) ON UPDATE CASCADE,
  CONSTRAINT `OrdenServicio_rfc_cliente_fkey` FOREIGN KEY (`rfc_cliente`) REFERENCES `cliente` (`rfc`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `detalleorden` (
  `id_detalle` int(11) NOT NULL AUTO_INCREMENT,
  `id_orden` int(11) NOT NULL,
  `id_refaccion` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 1,
  `precio_unitario` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id_detalle`),
  KEY `DetalleOrden_id_orden_fkey` (`id_orden`),
  KEY `DetalleOrden_id_refaccion_fkey` (`id_refaccion`),
  CONSTRAINT `DetalleOrden_id_orden_fkey` FOREIGN KEY (`id_orden`) REFERENCES `ordenservicio` (`id_orden`) ON UPDATE CASCADE,
  CONSTRAINT `DetalleOrden_id_refaccion_fkey` FOREIGN KEY (`id_refaccion`) REFERENCES `refaccion` (`id_refaccion`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `venta` (
  `id_venta` int(11) NOT NULL AUTO_INCREMENT,
  `id_orden` int(11) NOT NULL,
  `rfc_cliente` varchar(13) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `mano_obra` decimal(10,2) NOT NULL DEFAULT 0.00,
  `iva` decimal(10,2) NOT NULL DEFAULT 0.00,
  `precio_total` decimal(10,2) NOT NULL,
  `metodo_pago` enum('efectivo','tarjeta','transferencia') NOT NULL DEFAULT 'efectivo',
  `estado_pago` enum('pendiente','pagado','cancelado') NOT NULL DEFAULT 'pendiente',
  `fecha_venta` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id_venta`),
  UNIQUE KEY `Venta_id_orden_key` (`id_orden`),
  KEY `Venta_rfc_cliente_fkey` (`rfc_cliente`),
  CONSTRAINT `Venta_id_orden_fkey` FOREIGN KEY (`id_orden`) REFERENCES `ordenservicio` (`id_orden`) ON UPDATE CASCADE,
  CONSTRAINT `Venta_rfc_cliente_fkey` FOREIGN KEY (`rfc_cliente`) REFERENCES `cliente` (`rfc`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auditoria` (
  `id_auditoria` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) DEFAULT NULL,
  `username` varchar(50) DEFAULT NULL,
  `accion` varchar(100) NOT NULL,
  `modulo` varchar(50) NOT NULL,
  `fecha` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id_auditoria`),
  KEY `Auditoria_id_usuario_fkey` (`id_usuario`),
  CONSTRAINT `Auditoria_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nuevo: intentos de login para limitar fuerza bruta (5 intentos / 15 min por IP)
CREATE TABLE IF NOT EXISTS `login_intento` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ip` varchar(45) NOT NULL,
  `fecha` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `login_intento_ip_fecha` (`ip`, `fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
