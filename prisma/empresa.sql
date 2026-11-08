-- Datos de la empresa de cada cliente (una sola fila). Ejecutar en la base de cada cliente.
-- El logo y el icono se cargan después con: node --env-file=.env scripts/cargar-logo-empresa.mjs <logo> [icono]
-- Cambiar los valores del INSERT por los del cliente. funciones = NULL significa "todas las funciones";
-- para limitar, una lista JSON con los módulos habilitados (ver src/lib/modulos.js), p. ej. '["compras","ventas"]'.
CREATE TABLE IF NOT EXISTS empresa (
  empresaID  INT          NOT NULL AUTO_INCREMENT,
  nombre     VARCHAR(120) NOT NULL,
  propietario VARCHAR(120) NOT NULL,
  ciudad     VARCHAR(80)  NOT NULL,
  pais       VARCHAR(80)  NOT NULL DEFAULT 'Honduras',
  rtn        VARCHAR(20)  NULL,
  telefono   VARCHAR(30)  NULL,
  logoDatos  LONGBLOB     NULL,
  logoTipo   VARCHAR(50)  NULL,
  iconoDatos LONGBLOB     NULL,
  iconoTipo  VARCHAR(50)  NULL,
  funciones  JSON         NULL,
  PRIMARY KEY (empresaID)
);
INSERT INTO empresa (nombre, propietario, ciudad, pais, telefono)
SELECT 'Beneficio Café Belagos', 'Belagos', 'El Paraíso', 'Honduras', '(504) 9964-9154'
WHERE NOT EXISTS (SELECT 1 FROM empresa);
