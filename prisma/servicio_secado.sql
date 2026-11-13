-- Servicio de secado a clientes. Ejecutar en la base de cada cliente; se puede repetir sin efecto.
-- No modifica datos existentes: crea la tabla nueva y agrega a cosecha la columna de tarifa (vacía salvo la cosecha abierta).
CREATE TABLE IF NOT EXISTS servicio_secado (
  servicioID        INT           NOT NULL AUTO_INCREMENT,
  fecha             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  clienteID         INT           NOT NULL,
  productoID        INT           NOT NULL,
  pesoBrutoEntrada  DECIMAL(15,2) NOT NULL,
  sacosEntrada      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  humedadInicial    DECIMAL(5,2)  NULL,
  oroEntrada        DECIMAL(15,2) NOT NULL,
  tarifaQQ          DECIMAL(10,2) NOT NULL,
  cobro             DECIMAL(15,2) NOT NULL,
  secadoraId        INT           NULL,
  secadoraReservada TINYINT(1)    NOT NULL DEFAULT 0,
  productoSecoID    INT           NULL,
  pesoBrutoSalida   DECIMAL(15,2) NULL,
  sacosSalida       DECIMAL(15,2) NULL,
  humedadFinal      DECIMAL(5,2)  NULL,
  oroSalida         DECIMAL(15,2) NULL,
  fechaFin          DATETIME      NULL,
  estado            VARCHAR(20)   NOT NULL DEFAULT 'Recibido',
  formaPago         VARCHAR(20)   NULL,
  pagoEfectivo      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  pagoTransferencia DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  pagoCheque        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  cajaChicaId       INT           NULL,
  compraId          INT           NULL,
  qqVendidos        DECIMAL(15,2) NULL,
  observaciones     VARCHAR(255)  NULL,
  usuarioId         INT           NULL,
  PRIMARY KEY (servicioID),
  KEY servicio_secado_cliente (clienteID),
  KEY servicio_secado_estado (estado)
);
-- Si la tabla ya existía de una versión anterior, agrega la forma de pago del cobro.
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'servicio_secado' AND COLUMN_NAME = 'formaPago');
SET @sql := IF(@existe = 0, 'ALTER TABLE servicio_secado ADD COLUMN formaPago VARCHAR(20) NULL', 'SELECT 1');
PREPARE agregar FROM @sql;
EXECUTE agregar;
DEALLOCATE PREPARE agregar;
-- Pagos repartidos (efectivo / transferencia / cheque). Para tablas creadas con versiones anteriores.
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'servicio_secado' AND COLUMN_NAME = 'pagoEfectivo');
SET @sql := IF(@existe = 0, 'ALTER TABLE servicio_secado ADD COLUMN pagoEfectivo DECIMAL(15,2) NOT NULL DEFAULT 0.00, ADD COLUMN pagoTransferencia DECIMAL(15,2) NOT NULL DEFAULT 0.00, ADD COLUMN pagoCheque DECIMAL(15,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE agregar FROM @sql;
EXECUTE agregar;
DEALLOCATE PREPARE agregar;
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cosecha' AND COLUMN_NAME = 'tarifaSecadoQQ');
SET @sql := IF(@existe = 0, 'ALTER TABLE cosecha ADD COLUMN tarifaSecadoQQ DECIMAL(10,2) NULL', 'SELECT 1');
PREPARE agregar FROM @sql;
EXECUTE agregar;
DEALLOCATE PREPARE agregar;
-- Tarifa de la cosecha vigente (2026-2027: L 250.00 por quintal oro). Ajustar si cambia.
UPDATE cosecha SET tarifaSecadoQQ = 250.00 WHERE estado = 'Abierta' AND tarifaSecadoQQ IS NULL;
