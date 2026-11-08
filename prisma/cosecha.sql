-- Cosechas (periodos de producción). Ejecutar en la base de cada cliente.
-- Una sola cosecha "Abierta" a la vez; al cerrarla queda registrado el periodo (fechaInicio..fechaFin)
-- y una foto del inventario en ese momento (cosecha_inventario). Ninguna transacción puede fecharse
-- dentro de una cosecha cerrada. Ajustar el nombre y la fecha de inicio del INSERT por los del cliente.
CREATE TABLE IF NOT EXISTS cosecha (
  cosechaID   INT          NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(50)  NOT NULL,
  fechaInicio DATE         NOT NULL,
  fechaFin    DATE         NULL,
  estado      VARCHAR(10)  NOT NULL DEFAULT 'Abierta',
  notas       VARCHAR(255) NULL,
  cerradaEn   DATETIME     NULL,
  cerradaPor  INT          NULL,
  PRIMARY KEY (cosechaID),
  UNIQUE KEY cosecha_nombre (nombre)
);
CREATE TABLE IF NOT EXISTS cosecha_inventario (
  id            INT           NOT NULL AUTO_INCREMENT,
  cosechaID     INT           NOT NULL,
  productoID    INT           NOT NULL,
  cantidadQQ    DECIMAL(15,2) NOT NULL,
  cantidadSacos DECIMAL(15,2) NOT NULL,
  PRIMARY KEY (id),
  KEY cosecha_inventario_cosecha (cosechaID),
  CONSTRAINT cosecha_inventario_fk FOREIGN KEY (cosechaID) REFERENCES cosecha (cosechaID) ON DELETE CASCADE
);
INSERT INTO cosecha (nombre, fechaInicio)
SELECT '2026 - 2027', '2026-09-01'
WHERE NOT EXISTS (SELECT 1 FROM cosecha);
