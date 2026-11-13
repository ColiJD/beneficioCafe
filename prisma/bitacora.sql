-- Bitácora de actividad. Ejecutar en la base de cada cliente (no modifica ni borra nada existente).
-- Sin la tabla el sistema funciona igual: la bitácora deja de registrar y lo reintenta cada minuto.
CREATE TABLE IF NOT EXISTS bitacora (
  bitacoraID INT          NOT NULL AUTO_INCREMENT,
  fecha      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  userId     INT          NULL,
  usuario    VARCHAR(100) NULL,
  rol        VARCHAR(50)  NULL,
  evento     VARCHAR(20)  NOT NULL,
  modulo     VARCHAR(60)  NULL,
  registroId VARCHAR(40)  NULL,
  ruta       VARCHAR(200) NULL,
  ip         VARCHAR(45)  NULL,
  detalle    JSON         NULL,
  PRIMARY KEY (bitacoraID),
  KEY bitacora_fecha (fecha),
  KEY bitacora_usuario (userId, fecha),
  KEY bitacora_evento (evento, fecha),
  KEY bitacora_modulo (modulo, fecha)
);
