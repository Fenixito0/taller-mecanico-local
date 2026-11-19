-- Migración v4: catálogos de marcas, modelos y piezas (para elegir de una lista en vez de escribir libre).
-- Se puede ejecutar varias veces sin dañar datos:
--   C:\xampp\mysql\bin\mysql.exe -uroot < database\migracion_v4.sql

SET NAMES utf8mb4;
USE taller_mecanico;

CREATE TABLE IF NOT EXISTS `marca` (
  `id_marca` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(60) NOT NULL,
  PRIMARY KEY (`id_marca`),
  UNIQUE KEY `marca_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `modelo` (
  `id_modelo` int(11) NOT NULL AUTO_INCREMENT,
  `id_marca` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  PRIMARY KEY (`id_modelo`),
  UNIQUE KEY `modelo_marca_nombre` (`id_marca`, `nombre`),
  CONSTRAINT `modelo_marca_fkey` FOREIGN KEY (`id_marca`) REFERENCES `marca` (`id_marca`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pieza_catalogo` (
  `id_pieza_cat` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  PRIMARY KEY (`id_pieza_cat`),
  UNIQUE KEY `pieza_catalogo_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Marcas y modelos más comunes en México
DROP TEMPORARY TABLE IF EXISTS `tmp_modelo`;
CREATE TEMPORARY TABLE `tmp_modelo` (`marca` varchar(60), `modelo` varchar(100)) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `tmp_modelo` VALUES
('Acura','ILX'),('Acura','MDX'),('Acura','RDX'),('Acura','TLX'),
('Audi','A1'),('Audi','A3'),('Audi','A4'),('Audi','A5'),('Audi','A6'),('Audi','Q2'),('Audi','Q3'),('Audi','Q5'),('Audi','Q7'),('Audi','Q8'),
('BAIC','BJ20'),('BAIC','BJ40'),('BAIC','D20'),('BAIC','X25'),('BAIC','X35'),('BAIC','X55'),('BAIC','X65'),
('BMW','Serie 1'),('BMW','Serie 2'),('BMW','Serie 3'),('BMW','Serie 4'),('BMW','Serie 5'),('BMW','X1'),('BMW','X2'),('BMW','X3'),('BMW','X4'),('BMW','X5'),('BMW','X6'),
('Buick','Enclave'),('Buick','Encore'),('Buick','Envision'),
('BYD','Dolphin'),('BYD','Han'),('BYD','Seal'),('BYD','Song Plus'),('BYD','Tang'),('BYD','Yuan Plus'),
('Cadillac','Escalade'),('Cadillac','XT4'),('Cadillac','XT5'),('Cadillac','XT6'),
('Chevrolet','Aveo'),('Chevrolet','Beat'),('Chevrolet','Blazer'),('Chevrolet','Camaro'),('Chevrolet','Captiva'),('Chevrolet','Cavalier'),('Chevrolet','Cheyenne'),('Chevrolet','Colorado'),('Chevrolet','Cruze'),('Chevrolet','Equinox'),('Chevrolet','Groove'),('Chevrolet','Malibu'),('Chevrolet','Onix'),('Chevrolet','S10'),('Chevrolet','Silverado'),('Chevrolet','Sonic'),('Chevrolet','Spark'),('Chevrolet','Suburban'),('Chevrolet','Tahoe'),('Chevrolet','Tornado'),('Chevrolet','Tracker'),('Chevrolet','Traverse'),('Chevrolet','Trax'),
('Chirey','Arrizo 5'),('Chirey','Tiggo 2'),('Chirey','Tiggo 4'),('Chirey','Tiggo 7'),('Chirey','Tiggo 8'),
('Chrysler','200'),('Chrysler','300'),('Chrysler','Pacifica'),('Chrysler','Town & Country'),
('Dodge','Attitude'),('Dodge','Avenger'),('Dodge','Challenger'),('Dodge','Charger'),('Dodge','Dart'),('Dodge','Durango'),('Dodge','Journey'),('Dodge','Neon'),('Dodge','Vision'),
('Fiat','500'),('Fiat','Argo'),('Fiat','Ducato'),('Fiat','Fastback'),('Fiat','Mobi'),('Fiat','Palio'),('Fiat','Pulse'),('Fiat','Strada'),('Fiat','Uno'),
('Ford','Bronco'),('Ford','Bronco Sport'),('Ford','EcoSport'),('Ford','Edge'),('Ford','Escape'),('Ford','Expedition'),('Ford','Explorer'),('Ford','F-150'),('Ford','F-250'),('Ford','Fiesta'),('Ford','Figo'),('Ford','Focus'),('Ford','Fusion'),('Ford','Ikon'),('Ford','Lobo'),('Ford','Maverick'),('Ford','Mustang'),('Ford','Ranger'),('Ford','Territory'),('Ford','Transit'),
('GMC','Acadia'),('GMC','Canyon'),('GMC','Sierra'),('GMC','Terrain'),('GMC','Yukon'),
('GWM','Haval H6'),('GWM','Haval Jolion'),('GWM','Poer'),
('Honda','Accord'),('Honda','BR-V'),('Honda','City'),('Honda','Civic'),('Honda','CR-V'),('Honda','Fit'),('Honda','HR-V'),('Honda','Odyssey'),('Honda','Pilot'),
('Hyundai','Accent'),('Hyundai','Creta'),('Hyundai','Elantra'),('Hyundai','Grand i10'),('Hyundai','HB20'),('Hyundai','Ioniq'),('Hyundai','Santa Fe'),('Hyundai','Tucson'),
('Infiniti','Q50'),('Infiniti','QX50'),('Infiniti','QX60'),
('Isuzu','D-Max'),('Isuzu','ELF'),
('JAC','Frison T6'),('JAC','Frison T8'),('JAC','J4'),('JAC','J7'),('JAC','Sei2'),('JAC','Sei3'),('JAC','Sei4'),('JAC','Sei7'),
('Jeep','Cherokee'),('Jeep','Compass'),('Jeep','Gladiator'),('Jeep','Grand Cherokee'),('Jeep','Liberty'),('Jeep','Patriot'),('Jeep','Renegade'),('Jeep','Wrangler'),
('Kia','Forte'),('Kia','K3'),('Kia','Niro'),('Kia','Optima'),('Kia','Picanto'),('Kia','Rio'),('Kia','Seltos'),('Kia','Sonet'),('Kia','Sorento'),('Kia','Soul'),('Kia','Sportage'),
('Land Rover','Defender'),('Land Rover','Discovery'),('Land Rover','Range Rover'),('Land Rover','Range Rover Evoque'),
('Lincoln','Aviator'),('Lincoln','Corsair'),('Lincoln','MKZ'),('Lincoln','Nautilus'),('Lincoln','Navigator'),
('Mazda','BT-50'),('Mazda','CX-3'),('Mazda','CX-30'),('Mazda','CX-5'),('Mazda','CX-50'),('Mazda','CX-9'),('Mazda','CX-90'),('Mazda','Mazda 2'),('Mazda','Mazda 3'),('Mazda','Mazda 6'),('Mazda','MX-5'),
('Mercedes-Benz','CLA'),('Mercedes-Benz','Clase A'),('Mercedes-Benz','Clase C'),('Mercedes-Benz','Clase E'),('Mercedes-Benz','GLA'),('Mercedes-Benz','GLB'),('Mercedes-Benz','GLC'),('Mercedes-Benz','GLE'),('Mercedes-Benz','Sprinter'),
('MG','MG GT'),('MG','MG HS'),('MG','MG RX5'),('MG','MG ZS'),('MG','MG3'),('MG','MG5'),
('MINI','Clubman'),('MINI','Cooper'),('MINI','Countryman'),
('Mitsubishi','ASX'),('Mitsubishi','Eclipse Cross'),('Mitsubishi','L200'),('Mitsubishi','Lancer'),('Mitsubishi','Mirage'),('Mitsubishi','Mirage G4'),('Mitsubishi','Montero'),('Mitsubishi','Outlander'),
('Nissan','Altima'),('Nissan','Frontier'),('Nissan','Juke'),('Nissan','Kicks'),('Nissan','Leaf'),('Nissan','March'),('Nissan','Murano'),('Nissan','Note'),('Nissan','NP300'),('Nissan','Pathfinder'),('Nissan','Sentra'),('Nissan','Tiida'),('Nissan','Tsuru'),('Nissan','Urvan'),('Nissan','Versa'),('Nissan','X-Trail'),
('Peugeot','2008'),('Peugeot','208'),('Peugeot','3008'),('Peugeot','301'),('Peugeot','308'),('Peugeot','5008'),('Peugeot','Landtrek'),('Peugeot','Manager'),('Peugeot','Partner'),('Peugeot','Rifter'),
('RAM','1500'),('RAM','2500'),('RAM','4000'),('RAM','700'),('RAM','ProMaster'),
('Renault','Captur'),('Renault','Duster'),('Renault','Fluence'),('Renault','Kangoo'),('Renault','Koleos'),('Renault','Kwid'),('Renault','Logan'),('Renault','Megane'),('Renault','Oroch'),('Renault','Sandero'),('Renault','Stepway'),
('SEAT','Arona'),('SEAT','Ateca'),('SEAT','Ibiza'),('SEAT','León'),('SEAT','Tarraco'),('SEAT','Toledo'),
('Subaru','Crosstrek'),('Subaru','Forester'),('Subaru','Impreza'),('Subaru','Outback'),('Subaru','WRX'),('Subaru','XV'),
('Suzuki','Baleno'),('Suzuki','Ciaz'),('Suzuki','Dzire'),('Suzuki','Ertiga'),('Suzuki','Ignis'),('Suzuki','Jimny'),('Suzuki','S-Cross'),('Suzuki','Swift'),('Suzuki','Vitara'),('Suzuki','XL7'),
('Tesla','Model 3'),('Tesla','Model S'),('Tesla','Model X'),('Tesla','Model Y'),
('Toyota','Avanza'),('Toyota','C-HR'),('Toyota','Camry'),('Toyota','Corolla'),('Toyota','Corolla Cross'),('Toyota','Hiace'),('Toyota','Highlander'),('Toyota','Hilux'),('Toyota','Land Cruiser'),('Toyota','Prius'),('Toyota','Raize'),('Toyota','RAV4'),('Toyota','Sequoia'),('Toyota','Sienna'),('Toyota','Tacoma'),('Toyota','Tundra'),('Toyota','Yaris'),
('Volkswagen','Amarok'),('Volkswagen','Beetle'),('Volkswagen','Caddy'),('Volkswagen','Crafter'),('Volkswagen','Gol'),('Volkswagen','Golf'),('Volkswagen','Jetta'),('Volkswagen','Nivus'),('Volkswagen','Passat'),('Volkswagen','Pointer'),('Volkswagen','Polo'),('Volkswagen','Saveiro'),('Volkswagen','T-Cross'),('Volkswagen','Taos'),('Volkswagen','Teramont'),('Volkswagen','Tiguan'),('Volkswagen','Transporter'),('Volkswagen','Vento'),('Volkswagen','Virtus'),
('Volvo','S60'),('Volvo','XC40'),('Volvo','XC60'),('Volvo','XC90');

INSERT IGNORE INTO `marca` (`nombre`) SELECT DISTINCT `marca` FROM `tmp_modelo`;
INSERT IGNORE INTO `modelo` (`id_marca`, `nombre`)
  SELECT m.`id_marca`, t.`modelo` FROM `tmp_modelo` t JOIN `marca` m ON m.`nombre` = t.`marca`;
DROP TEMPORARY TABLE `tmp_modelo`;

-- Lo que ya estaba capturado en vehículos también entra al catálogo (para no invalidar registros viejos)
INSERT IGNORE INTO `marca` (`nombre`)
  SELECT DISTINCT TRIM(`marca`) FROM `vehiculo` WHERE `marca` IS NOT NULL AND TRIM(`marca`) <> '';
INSERT IGNORE INTO `modelo` (`id_marca`, `nombre`)
  SELECT DISTINCT m.`id_marca`, TRIM(v.`modelo`) FROM `vehiculo` v JOIN `marca` m ON m.`nombre` = TRIM(v.`marca`)
  WHERE TRIM(v.`modelo`) <> '';

-- Piezas de carrocería y mecánica más comunes
INSERT IGNORE INTO `pieza_catalogo` (`nombre`) VALUES
('Absorbedor de impacto'),('Alma de defensa'),('Amortiguador'),('Antena'),('Batería'),('Bisagra de cofre'),('Bisagra de puerta'),
('Bolsa de aire'),('Brazo de suspensión'),('Cajuela'),('Calavera'),('Cámara de reversa'),('Chapa'),('Cinturón de seguridad'),
('Cofre'),('Condensador'),('Costado'),('Cristal de puerta'),('Cuarto'),('Defensa delantera'),('Defensa trasera'),
('Depósito de anticongelante'),('Emblema'),('Espejo lateral'),('Estribo'),('Fascia delantera'),('Fascia trasera'),('Faro'),
('Faro de niebla'),('Elevador de cristal'),('Guía de defensa'),('Horquilla'),('Llanta'),('Lodera'),('Luna de espejo'),
('Manija exterior'),('Manija interior'),('Medallón'),('Moldura'),('Parabrisas'),('Parrilla'),('Portaplacas'),('Poste'),
('Puerta delantera'),('Puerta trasera'),('Radiador'),('Refuerzo de defensa'),('Rin'),('Rótula'),('Salpicadera'),
('Sensor de estacionamiento'),('Soporte de radiador'),('Spoiler'),('Tablero'),('Tapa de cajuela'),('Tapón de gasolina'),
('Toldo'),('Tolva'),('Ventilador de radiador');

INSERT IGNORE INTO `pieza_catalogo` (`nombre`)
  SELECT DISTINCT TRIM(`nombre`) FROM `orden_pieza` WHERE TRIM(`nombre`) <> '';
