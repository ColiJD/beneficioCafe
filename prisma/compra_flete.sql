-- Cobro por flete en las compras de café. Ejecutar en la base de cada cliente; se puede repetir sin efecto.
-- Agrega una columna a compra (con 0 en lo que ya existe): no cambia ningún dato ni monto existente.
SET @existe := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'compra' AND COLUMN_NAME = 'compraFlete');
SET @sql := IF(@existe = 0, 'ALTER TABLE compra ADD COLUMN compraFlete DECIMAL(15,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE agregar FROM @sql;
EXECUTE agregar;
DEALLOCATE PREPARE agregar;
