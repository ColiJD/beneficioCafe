// Utilidades comunes para anular/modificar transacciones que mueven inventario.

export class ErrorNegocio extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

export const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const esAnulado = (v) => String(v ?? "").toUpperCase() === "ANULADO";

// `not` solo no devuelve filas NULL; así se incluyen los registros sin estado.
export const noAnulado = (campo) => ({
  OR: [{ [campo]: null }, { [campo]: { notIn: ["ANULADO", "Anulado", "anulado"] } }],
});

/**
 * Suma o resta (cantidad con signo) al saldo del producto. Si resta, exige que quede saldo
 * suficiente; así una anulación o edición no deja el inventario en negativo.
 * Devuelve la fila de inventariocliente.
 */
export async function moverInventario(tx, productoID, dQQ, dSacos = 0) {
  const qq = redondear(dQQ);
  const sacos = Number(dSacos) || 0;
  const id = Number(productoID);

  if (qq < 0) {
    const r = await tx.inventariocliente.updateMany({
      where: { productoID: id, cantidadQQ: { gte: -qq } },
      data: { cantidadQQ: { increment: qq }, cantidadSacos: { increment: sacos } },
    });
    if (r.count === 0) {
      const actual = await tx.inventariocliente.findUnique({ where: { productoID: id } });
      throw new ErrorNegocio(
        `Inventario insuficiente para el producto #${id}. Disponible: ${Number(actual?.cantidadQQ ?? 0).toFixed(2)} QQ, Necesario: ${(-qq).toFixed(2)} QQ`,
      );
    }
    return tx.inventariocliente.findUnique({ where: { productoID: id } });
  }

  return tx.inventariocliente.upsert({
    where: { productoID: id },
    update: { cantidadQQ: { increment: qq }, cantidadSacos: { increment: sacos } },
    create: { productoID: id, cantidadQQ: qq, cantidadSacos: sacos },
  });
}

/** Movimiento original (Entrada/Salida) de una transacción, buscando la referencia exacta ("#3" no coincide con "#30"). */
export function movimientoOriginal(tx, referencias) {
  return tx.movimientoinventario.findFirst({
    where: { referenciaTipo: { in: referencias }, tipoMovimiento: { in: ["Entrada", "Salida"] } },
    orderBy: { movimientoID: "asc" },
  });
}

export function respuestaError(error, mensaje) {
  if (error instanceof ErrorNegocio) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error?.code === "P2034") {
    // Conflicto o deadlock entre transacciones simultáneas: no se guardó nada, se puede reintentar.
    return Response.json({ error: "Otra operación se registró al mismo tiempo. Intente de nuevo." }, { status: 409 });
  }
  console.error(mensaje, error);
  return Response.json({ error: mensaje }, { status: 500 });
}
