export const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const ANULADO = ["ANULADO", "Anulado", "anulado"];

/**
 * Salidas de un comprador/producto con lo que aún falta por liquidar (FIFO por fecha).
 * `excluirLiqID` ignora los detalles de esa liquidación (para recalcular al modificarla).
 */
export async function calcularPendientes(tx, compradorID, productoID, excluirLiqID) {
  const salidas = await tx.salida.findMany({
    where: { compradorID, productoID, salidaMovimiento: { notIn: ANULADO } },
    orderBy: { salidaFecha: "asc" },
    include: {
      detalleliqsalida: { select: { cantidadQQ: true, movimiento: true, liqSalidaID: true } },
    },
  });

  return salidas
    .map((s) => {
      const liquidado = s.detalleliqsalida
        .filter((d) => !ANULADO.includes(d.movimiento) && d.liqSalidaID !== excluirLiqID)
        .reduce((acc, d) => acc + Number(d.cantidadQQ || 0), 0);
      return { salidaID: s.salidaID, pendiente: redondear(Number(s.salidaCantidadQQ) - redondear(liquidado)) };
    })
    .filter((s) => s.pendiente > 0);
}

/** Reparte `cantidad` entre las salidas pendientes (FIFO) y crea los detalles de la liquidación. */
export async function crearDetallesFIFO(tx, liqSalidaID, pendientes, cantidad) {
  let resto = redondear(cantidad);
  for (const s of pendientes) {
    if (resto <= 0) break;
    const descontar = redondear(Math.min(s.pendiente, resto));
    await tx.detalleliqsalida.create({
      data: { liqSalidaID, salidaID: s.salidaID, cantidadQQ: descontar, movimiento: "Salida" },
    });
    resto = redondear(resto - descontar);
  }
}
