import { ErrorNegocio, redondear } from "@/lib/inventarioMov";

// Cobro por flete de una compra de café: se debita del monto a pagar, así que compraTotal (lo que se paga) ya viene sin él.
// Devuelve el flete como número (0 si no aplica). Rechaza valores negativos o un flete mayor que lo que se paga por el café.
export function validarFlete(flete, compraTotal) {
  const f = flete === undefined || flete === null || flete === "" ? 0 : Number(flete);
  if (!Number.isFinite(f) || f < 0) throw new ErrorNegocio("El cobro por flete no es válido.");
  if (Number(compraTotal) < 0) throw new ErrorNegocio("El flete no puede ser mayor que el pago por el café.");
  return redondear(f);
}
