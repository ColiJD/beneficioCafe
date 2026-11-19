-- Abono a deuda desde la compra directa (ejecutar en producción a mano, una sola vez).
-- El abono NO se guarda en la compra: cada movimiento de abono apunta a su compra por compraId.
-- compraTotal sigue siendo el valor del café (menos flete); el abono se obtiene sumando los movimientos enlazados.
ALTER TABLE movimientos_prestamo ADD COLUMN compraId INT NULL;
ALTER TABLE movimientos_prestamo ADD CONSTRAINT fk_movprestamo_compra FOREIGN KEY (compraId) REFERENCES compra(compraId) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE movimientos_anticipos ADD COLUMN compraId INT NULL;
ALTER TABLE movimientos_anticipos ADD CONSTRAINT fk_movanticipo_compra FOREIGN KEY (compraId) REFERENCES compra(compraId) ON DELETE NO ACTION ON UPDATE NO ACTION;
