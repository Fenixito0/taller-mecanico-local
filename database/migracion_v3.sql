-- Migración v3: piezas por orden (sin inventario), órdenes de seguro/particular y cobro por conceptos.
-- Se puede ejecutar varias veces sin dañar datos:
--   C:\xampp\mysql\bin\mysql.exe -uroot < database\migracion_v3.sql

SET NAMES utf8mb4;
USE taller_mecanico;

-- Tipo de orden y datos del seguro
ALTER TABLE `ordenservicio`
  ADD COLUMN IF NOT EXISTS `tipo` enum('seguro','particular') NOT NULL DEFAULT 'particular' AFTER `kilometraje`,
  ADD COLUMN IF NOT EXISTS `aseguradora` varchar(60) DEFAULT NULL AFTER `tipo`,
  ADD COLUMN IF NOT EXISTS `num_siniestro` varchar(40) DEFAULT NULL AFTER `aseguradora`,
  ADD COLUMN IF NOT EXISTS `deducible` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `num_siniestro`;

-- Desglose de la venta (subtotal sigue siendo el importe de piezas cobradas)
ALTER TABLE `venta`
  ADD COLUMN IF NOT EXISTS `piezas` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `subtotal`,
  ADD COLUMN IF NOT EXISTS `extras` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `mano_obra`,
  ADD COLUMN IF NOT EXISTS `deducible` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `extras`;

-- Piezas de cada orden (cada pieza llega para un vehículo específico)
CREATE TABLE IF NOT EXISTS `orden_pieza` (
  `id_pieza` int(11) NOT NULL AUTO_INCREMENT,
  `id_orden` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `lado` enum('izquierdo','derecho','central','N/A') NOT NULL DEFAULT 'N/A',
  `origen` enum('aseguradora','taller') NOT NULL,
  `estado` enum('pendiente','recibida','instalada','devuelta') NOT NULL DEFAULT 'pendiente',
  `cantidad` int(11) NOT NULL DEFAULT 1,
  `precio_unitario` decimal(10,2) DEFAULT NULL,
  `es_extra` tinyint(1) NOT NULL DEFAULT 0,
  `id_reemplaza` int(11) DEFAULT NULL,
  `motivo_devolucion` varchar(200) DEFAULT NULL,
  `fecha_estado` datetime(3) NOT NULL,
  PRIMARY KEY (`id_pieza`),
  KEY `pieza_orden` (`id_orden`),
  KEY `pieza_estado` (`estado`),
  KEY `pieza_nombre` (`nombre`),
  CONSTRAINT `pieza_orden_fkey` FOREIGN KEY (`id_orden`) REFERENCES `ordenservicio` (`id_orden`) ON UPDATE CASCADE,
  CONSTRAINT `pieza_reemplaza_fkey` FOREIGN KEY (`id_reemplaza`) REFERENCES `orden_pieza` (`id_pieza`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conceptos cobrables que no son piezas: mano de obra y extras
CREATE TABLE IF NOT EXISTS `orden_cargo` (
  `id_cargo` int(11) NOT NULL AUTO_INCREMENT,
  `id_orden` int(11) NOT NULL,
  `tipo` enum('mano_obra','extra') NOT NULL,
  `concepto` varchar(150) NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id_cargo`),
  KEY `cargo_orden` (`id_orden`),
  CONSTRAINT `cargo_orden_fkey` FOREIGN KEY (`id_orden`) REFERENCES `ordenservicio` (`id_orden`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conceptos libres de cotización
CREATE TABLE IF NOT EXISTS `cotizacion_concepto` (
  `id_concepto` int(11) NOT NULL AUTO_INCREMENT,
  `id_cotizacion` int(11) NOT NULL,
  `tipo` enum('pieza','mano_obra','extra') NOT NULL,
  `concepto` varchar(150) NOT NULL,
  `lado` enum('izquierdo','derecho','central','N/A') NOT NULL DEFAULT 'N/A',
  `cantidad` int(11) NOT NULL DEFAULT 1,
  `precio_unitario` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id_concepto`),
  KEY `cotcon_cot` (`id_cotizacion`),
  CONSTRAINT `cotcon_cot_fkey` FOREIGN KEY (`id_cotizacion`) REFERENCES `cotizacion` (`id_cotizacion`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copia las piezas de órdenes anteriores (solo órdenes que aún no tienen piezas nuevas)
INSERT INTO `orden_pieza` (`id_orden`, `nombre`, `lado`, `origen`, `estado`, `cantidad`, `precio_unitario`, `es_extra`, `fecha_estado`)
SELECT d.`id_orden`, r.`nombre`, r.`lado`, 'taller',
       IF(o.`estado` = 'completado', 'instalada', 'pendiente'),
       d.`cantidad`, d.`precio_unitario`, 0, o.`fecha_creacion`
FROM `detalleorden` d
JOIN `refaccion` r ON r.`id_refaccion` = d.`id_refaccion`
JOIN `ordenservicio` o ON o.`id_orden` = d.`id_orden`
WHERE NOT EXISTS (SELECT 1 FROM `orden_pieza` p WHERE p.`id_orden` = d.`id_orden`)
ORDER BY d.`id_detalle`;

-- Copia la mano de obra de ventas anteriores como cargo
INSERT INTO `orden_cargo` (`id_orden`, `tipo`, `concepto`, `monto`)
SELECT v.`id_orden`, 'mano_obra', 'Mano de obra', v.`mano_obra`
FROM `venta` v
WHERE v.`mano_obra` > 0
  AND NOT EXISTS (SELECT 1 FROM `orden_cargo` c WHERE c.`id_orden` = v.`id_orden`);

-- En ventas anteriores el subtotal era el importe de piezas
UPDATE `venta` SET `piezas` = `subtotal` WHERE `piezas` = 0 AND `subtotal` > 0;

-- Copia los renglones de cotizaciones anteriores como conceptos tipo pieza
INSERT INTO `cotizacion_concepto` (`id_cotizacion`, `tipo`, `concepto`, `lado`, `cantidad`, `precio_unitario`)
SELECT d.`id_cotizacion`, 'pieza', r.`nombre`, r.`lado`, d.`cantidad`, d.`precio_unitario`
FROM `detallecotizacion` d
JOIN `refaccion` r ON r.`id_refaccion` = d.`id_refaccion`
WHERE NOT EXISTS (SELECT 1 FROM `cotizacion_concepto` c WHERE c.`id_cotizacion` = d.`id_cotizacion`)
ORDER BY d.`id_detalle`;

-- Aseguradoras con las que trabaja el taller (editable en Configuración)
INSERT IGNORE INTO `configuracion` (`clave`, `valor`) VALUES
  ('aseguradoras', '["ANA Seguros","Primero Seguros","Qualitas"]');
