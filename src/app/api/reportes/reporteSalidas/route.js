import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { searchParams } = new URL(req.url);
    const desdeParam = searchParams.get("desde");
    const hastaParam = searchParams.get("hasta");

    let desde, hasta;

    if (desdeParam && hastaParam) {
      desde = new Date(new Date(desdeParam).setUTCHours(0, 0, 0, 0));
      hasta = new Date(new Date(hastaParam).setUTCHours(23, 59, 59, 999));
    } else {
      const ahora = new Date();
      desde = new Date(
        Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0)
      );
      hasta = new Date(
        Date.UTC(
          ahora.getFullYear(),
          ahora.getMonth(),
          ahora.getDate(),
          23,
          59,
          59,
          999
        )
      );
    }

    const compradores = await prisma.compradores.findMany({
      select: { compradorId: true, compradorNombre: true },
    });

    const reportePromises = compradores.map(async (c) => {
      const compraAgg = await prisma.compra.aggregate({
        _sum: { compraCantidadQQ: true, compraTotal: true },
        where: {
          compradorID: c.compradorId,
          compraMovimiento: "Salida",
          compraFecha: { gte: desde, lte: hasta },
        },
      });

      const totalCompraQQ = Number(compraAgg._sum.compraCantidadQQ || 0);
      const totalCompraLps = Number(compraAgg._sum.compraTotal || 0);

      const salidas = await prisma.salida.findMany({
        where: {
          compradorID: c.compradorId,
          salidaFecha: { gte: desde, lte: hasta },
          salidaMovimiento: "Salida",
        },
        select: {
          salidaCantidadQQ: true,
          salidaPrecio: true, // precio unitario
        },
      });

      let salidaCantidad = 0;
      let salidaTotal = 0;

      for (const s of salidas) {
        const qq = Number(s.salidaCantidadQQ || 0);
        const precio = Number(s.salidaPrecio || 0);
        salidaCantidad += qq;
        salidaTotal += qq * precio;
      }

      const contratos = await prisma.detalleContratoSalida.findMany({
        where: {
          contratoSalida: {
            compradorID: c.compradorId,
          },
          fecha: { gte: desde, lte: hasta },
          tipoMovimiento: "Salida",
        },
        select: {
          cantidadQQ: true,
          precioQQ: true,
        },
      });

      let contratoCantidad = 0;
      let contratoTotal = 0;
      console.log(contratos);

      for (const ct of contratos) {
        const qq = Number(ct.cantidadQQ || 0);
        const precio = Number(ct.precioQQ || 0);
        contratoCantidad += qq;
        contratoTotal += qq * precio;
      }

      // 🔹 2. Salidas Ejecutadas (Liquidaciones de ConfirmacionVenta) en el rango
      const salidasEjecutadas = await prisma.detalleliqsalida.aggregate({
        _sum: { cantidadQQ: true },
        where: {
          salida: {
            compradorID: c.compradorId,
            salidaMovimiento: "Salida",
          },
          liqsalida: {
            liqFecha: { gte: desde, lte: hasta },
          },
          OR: [{ movimiento: "Salida" }, { movimiento: null }],
        },
      });
      const totalSalidaEjecutadaQQ = Number(
        salidasEjecutadas._sum.cantidadQQ || 0
      );

      if (
        totalCompraQQ === 0 &&
        totalCompraLps === 0 &&
        salidaCantidad === 0 &&
        salidaTotal === 0 &&
        contratoCantidad === 0 &&
        contratoTotal === 0 &&
        totalSalidaEjecutadaQQ === 0
      ) {
        return null;
      }

      return {
        compradorId: c.compradorId,
        nombre: c.compradorNombre.trim(),

        compraCantidadQQ: totalCompraQQ,
        compraTotalLps: totalCompraLps,

        salidaCantidadQQ: salidaCantidad,
        salidaTotalLps: salidaTotal,

        contratoCantidadQQ: contratoCantidad,
        contratoTotalLps: contratoTotal,

        salidaEjecutadaQQ: totalSalidaEjecutadaQQ,
      };
    });

    let reporte = await Promise.all(reportePromises);
    reporte = reporte.filter((r) => r !== null);

    return new Response(JSON.stringify(reporte), { status: 200 });
  } catch (error) {
    console.error("❌ Error en API:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
