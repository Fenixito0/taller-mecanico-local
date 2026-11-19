-- Migración v2: etapas, kilometraje, inventario por cantidad, anticipos, descuentos,
-- cotizaciones y configuración del taller. Es segura de ejecutar varias veces.
SET NAMES utf8mb4;
USE taller_mecanico;

ALTER TABLE `ordenservicio`
  ADD COLUMN IF NOT EXISTS `etapa` enum('recibido','reparacion','listo') NOT NULL DEFAULT 'recibido' AFTER `estado`,
  ADD COLUMN IF NOT EXISTS `kilometraje` int(11) DEFAULT NULL AFTER `etapa`;

ALTER TABLE `venta`
  ADD COLUMN IF NOT EXISTS `descuento` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `mano_obra`,
  ADD COLUMN IF NOT EXISTS `anticipo` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `precio_total`;

-- Cada movimiento de dinero (anticipo, liquidación o devolución). Base del corte de caja.
CREATE TABLE IF NOT EXISTS `pago` (
  `id_pago` int(11) NOT NULL AUTO_INCREMENT,
  `id_orden` int(11) NOT NULL,
  `tipo` enum('anticipo','liquidacion','devolucion') NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `metodo` enum('efectivo','tarjeta','transferencia') NOT NULL DEFAULT 'efectivo',
  `fecha` datetime(3) NOT NULL,
  `id_usuario` int(11) DEFAULT NULL,
  PRIMARY KEY (`id_pago`),
  KEY `pago_orden` (`id_orden`),
  KEY `pago_fecha` (`fecha`),
  CONSTRAINT `pago_orden_fkey` FOREIGN KEY (`id_orden`) REFERENCES `ordenservicio` (`id_orden`) ON UPDATE CASCADE,
  CONSTRAINT `pago_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Las ventas anteriores a esta versión se registran como liquidación para que el historial de caja cuadre.
INSERT INTO `pago` (`id_orden`, `tipo`, `monto`, `metodo`, `fecha`)
SELECT v.`id_orden`, 'liquidacion', v.`precio_total`, v.`metodo_pago`, v.`fecha_venta`
FROM `venta` v
WHERE NOT EXISTS (SELECT 1 FROM `pago` p WHERE p.`id_orden` = v.`id_orden`);

CREATE TABLE IF NOT EXISTS `cotizacion` (
  `id_cotizacion` int(11) NOT NULL AUTO_INCREMENT,
  `rfc_cliente` varchar(13) NOT NULL,
  `id_vehiculo` int(11) NOT NULL,
  `id_usuario` int(11) DEFAULT NULL,
  `fecha` datetime(3) NOT NULL,
  `observaciones` text DEFAULT NULL,
  `kilometraje` int(11) DEFAULT NULL,
  `estado` enum('abierta','convertida') NOT NULL DEFAULT 'abierta',
  `id_orden` int(11) DEFAULT NULL,
  PRIMARY KEY (`id_cotizacion`),
  KEY `cot_cliente` (`rfc_cliente`),
  CONSTRAINT `cot_cliente_fkey` FOREIGN KEY (`rfc_cliente`) REFERENCES `cliente` (`rfc`) ON UPDATE CASCADE,
  CONSTRAINT `cot_vehiculo_fkey` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculo` (`id_vehiculo`) ON UPDATE CASCADE,
  CONSTRAINT `cot_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `cot_orden_fkey` FOREIGN KEY (`id_orden`) REFERENCES `ordenservicio` (`id_orden`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `detallecotizacion` (
  `id_detalle` int(11) NOT NULL AUTO_INCREMENT,
  `id_cotizacion` int(11) NOT NULL,
  `id_refaccion` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 1,
  `precio_unitario` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id_detalle`),
  KEY `detcot_cot` (`id_cotizacion`),
  CONSTRAINT `detcot_cot_fkey` FOREIGN KEY (`id_cotizacion`) REFERENCES `cotizacion` (`id_cotizacion`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `detcot_ref_fkey` FOREIGN KEY (`id_refaccion`) REFERENCES `refaccion` (`id_refaccion`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `configuracion` (
  `clave` varchar(50) NOT NULL,
  `valor` text DEFAULT NULL,
  PRIMARY KEY (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `configuracion` (`clave`, `valor`) VALUES
  ('nombre_taller', 'Taller Mecánico'),
  ('eslogan', 'Sistema de gestión'),
  ('direccion', ''),
  ('telefono', ''),
  ('rfc', ''),
  ('mensaje_recibo', 'Gracias por su preferencia');
