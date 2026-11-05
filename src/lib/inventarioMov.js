// Utilidades comunes para anular/modificar transacciones que mueven inventario.

export class ErrorNegocio extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

// Transacciones que bloquean una fila (contrato, secadora) pueden esperar a otra: más margen que los 5 s de Prisma.
export const TX_ESPERA = { maxWait: 10_000, timeout: 20_000 };

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

/**
 * Bloquea el contrato (SELECT ... FOR UPDATE) hasta que termine la transacción y devuelve lo entregado.
 * Dos entregas o ediciones simultáneas del mismo contrato se atienden una tras otra, así la segunda
 * ve lo que ya entregó la primera y no se pasa de lo pactado.
 * `tabla` = "contratoSalida" | "contrato"; `excluirDetalleID` = la entrega que se está editando.
 */
export async function bloquearContrato(tx, tabla, contratoID, excluirDetalleID) {
  const id = Number(contratoID);
  if (tabla === "contratoSalida") await tx.$queryRaw`SELECT contratoID FROM contratoSalida WHERE contratoID = ${id} FOR UPDATE`;
  else await tx.$queryRaw`SELECT contratoID FROM contrato WHERE contratoID = ${id} FOR UPDATE`;
  const modelo = tabla === "contratoSalida" ? tx.detalleContratoSalida : tx.detallecontrato;
  const r = await modelo.aggregate({
    _sum: { cantidadQQ: true },
    where: {
      contratoID: id,
      // tipoMovimiento admite NULL solo en detalleContratoSalida
      ...(tabla === "contratoSalida" ? noAnulado("tipoMovimiento") : { tipoMovimiento: { notIn: ["ANULADO", "Anulado", "anulado"] } }),
      ...(excluirDetalleID ? { detalleID: { not: Number(excluirDetalleID) } } : {}),
    },
  });
  return Number(r._sum.cantidadQQ ?? 0);
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
  // P2034: conflicto o deadlock; P2028: la transacción esperó demasiado. En ambos casos no se guardó nada.
  if (error?.code === "P2034" || error?.code === "P2028") {
    return Response.json({ error: "Otra operación se registró al mismo tiempo. Intente de nuevo." }, { status: 409 });
  }
  console.error(mensaje, error);
  return Response.json({ error: mensaje }, { status: 500 });
}
