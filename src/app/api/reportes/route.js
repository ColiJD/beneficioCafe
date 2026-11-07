import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

const sumaPorPrecio = (filas, campoQQ, campoPrecio) =>
  filas.reduce(
    (acc, item) => {
      const cantidad = Number(item[campoQQ] || 0);
      acc.cantidadQQ += cantidad;
      acc.total += cantidad * Number(item[campoPrecio] || 0);
      return acc;
    },
    { cantidadQQ: 0, total: 0 },
  );

/** { tipo: suma } solo con los tipos pedidos (los que no aparecen quedan en 0). */
const resumirTipos = (grupos, tipos) => {
  const r = Object.fromEntries(tipos.map((t) => [t, 0]));
  for (const g of grupos) if (g.tipo_movimiento in r) r[g.tipo_movimiento] = Number(g._sum.monto ?? 0);
  return r;
};

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { searchParams } = new URL(req.url);
    const desdeParam = searchParams.get("desde");
    const hastaParam = searchParams.get("hasta");

    let desde, hasta;

    if (desdeParam && hastaParam) {
      // UTC para todo el día
      desde = new Date(new Date(desdeParam).setUTCHours(0, 0, 0, 0));
      hasta = new Date(new Date(hastaParam).setUTCHours(23, 59, 59, 999));
    } else {
      const ahora = new Date();
      desde = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0));
      hasta = new Date(
        Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999),
      );
    }
    const rango = { gte: desde, lte: hasta };
    const prestamoActivo = { estado: { notIn: ["ANULADO", "Anulado"] } };

    // Todas las consultas van en paralelo: la base es remota y una tras otra sumaban ~3 s.
    const [
      comprasEntradas,
      comprasSalidas,
      contratosDetalles,
      depositosEntradas,
      totalDepositosRaw,
      salidasDetalles,
      contratoSalidas,
      prestamosActivos,
      movimientosPrestamo,
      anticiposActivos,
      movimientosAnticipo,
      inventario,
      secadoEnProceso,
      secadoFinalizado,
      totalSalidasRaw,
      totalLiquidadoRaw,
    ] = await Promise.all([
      // 🔹 Compras
      prisma.compra.aggregate({
        _sum: { compraCantidadQQ: true, compraTotal: true, compraRetencio: true },
        where: { compraMovimiento: "Entrada", compraFecha: rango },
      }),
      prisma.compra.aggregate({
        _sum: { compraCantidadQQ: true, compraTotal: true, compraRetencio: true },
        where: { compraMovimiento: "Salida", compraFecha: rango },
      }),
      // 🔹 Contratos
      prisma.detallecontrato.findMany({
        where: { tipoMovimiento: "Entrada", fecha: rango },
        select: { cantidadQQ: true, precioQQ: true },
      }),
      // 🔹 Depósitos liquidados
      prisma.detalleliqdeposito.aggregate({
        _sum: { cantidadQQ: true, totalLps: true },
        where: { liqdeposito: { liqMovimiento: "Entrada", liqFecha: rango } },
      }),
      // 🔹 Total depósitos reales (entradas al almacén)
      prisma.deposito.aggregate({
        _sum: { depositoCantidadQQ: true },
        where: { depositoMovimiento: "Deposito", depositoFecha: rango },
      }),
      // 🔹 Salidas
      prisma.salida.findMany({
        where: { salidaMovimiento: "Salida", salidaFecha: rango },
        select: { salidaCantidadQQ: true, salidaPrecio: true },
      }),
      prisma.detalleContratoSalida.findMany({
        where: { tipoMovimiento: "Salida", fecha: rango },
        select: { cantidadQQ: true, precioQQ: true },
      }),
      // 🔹 Préstamos
      prisma.prestamos.aggregate({ _sum: { monto: true }, where: prestamoActivo }),
      prisma.movimientos_prestamo.groupBy({
        by: ["tipo_movimiento"],
        _sum: { monto: true },
        where: {
          tipo_movimiento: { in: ["ABONO", "PAGO_INTERES", "Int-Cargo"] },
          prestamos: prestamoActivo,
        },
      }),
      // 🔹 Anticipos
      prisma.anticipo.aggregate({ _sum: { monto: true }, where: prestamoActivo }),
      prisma.movimientos_anticipos.groupBy({
        by: ["tipo_movimiento"],
        _sum: { monto: true },
        where: {
          tipo_movimiento: { in: ["CARGO_ANTICIPO", "INTERES_ANTICIPO", "ABONO_ANTICIPO"] },
          anticipo: prestamoActivo,
        },
      }),
      // 🔹 Inventario
      prisma.inventariocliente.aggregate({ _sum: { cantidadQQ: true } }),
      // Secado: el café sale del inventario al iniciar y vuelve (con merma) al finalizar.
      // Sin estas dos líneas, Entradas - Salidas no cuadra con el inventario disponible.
      prisma.secado.aggregate({ _sum: { cantidadEntradaQQ: true }, where: { estado: "En Proceso" } }),
      prisma.secado.aggregate({
        _sum: { cantidadEntradaQQ: true, cantidadSalidaQQ: true },
        where: { estado: "Finalizado" },
      }),
      // 1️⃣ Total de salidas válidas
      prisma.salida.aggregate({ _sum: { salidaCantidadQQ: true }, where: { salidaMovimiento: "Salida" } }),
      // 2️⃣ Total liquidado válido (detalle no anulado, incluidos los NULL)
      prisma.detalleliqsalida.aggregate({
        _sum: { cantidadQQ: true },
        where: { OR: [{ movimiento: null }, { movimiento: { not: "Anulado" } }] },
      }),
    ]);

    const totalSalidas = Number(totalSalidasRaw._sum.salidaCantidadQQ ?? 0);
    const totalLiquidado = Number(totalLiquidadoRaw._sum.cantidadQQ ?? 0);

    return new Response(
      JSON.stringify({
        compras: { entradas: comprasEntradas, salidas: comprasSalidas },
        contratos: { entradas: sumaPorPrecio(contratosDetalles, "cantidadQQ", "precioQQ") },
        depositos: {
          entradas: depositosEntradas,
          totalDepositosQQ: Number(totalDepositosRaw._sum.depositoCantidadQQ ?? 0),
        },
        salidas: sumaPorPrecio(salidasDetalles, "salidaCantidadQQ", "salidaPrecio"),
        prestamos: {
          totalPrestamosActivos: Number(prestamosActivos._sum.monto ?? 0),
          movimientos: resumirTipos(movimientosPrestamo, ["ABONO", "PAGO_INTERES", "Int-Cargo"]),
        },
        anticipos: {
          totalAnticiposActivos: Number(anticiposActivos._sum.monto ?? 0),
          movimientos: resumirTipos(movimientosAnticipo, ["CARGO_ANTICIPO", "INTERES_ANTICIPO", "ABONO_ANTICIPO"]),
        },
        inventario: { disponibleQQ: Number(inventario._sum.cantidadQQ ?? 0) },
        secado: {
          enProcesoQQ: Number(secadoEnProceso._sum.cantidadEntradaQQ ?? 0),
          mermaQQ:
            Number(secadoFinalizado._sum.cantidadEntradaQQ ?? 0) -
            Number(secadoFinalizado._sum.cantidadSalidaQQ ?? 0),
        },
        totalSalidas,
        totalLiquidado,
        pendiente: totalSalidas - totalLiquidado,
        contratoSalidasTotal: sumaPorPrecio(contratoSalidas, "cantidadQQ", "precioQQ"),
      }),
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Error en API reportes:", error);
    return new Response(JSON.stringify({ error: "Error al generar el reporte" }), { status: 500 });
  }
}
