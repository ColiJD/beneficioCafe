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
        Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0),
      );
      hasta = new Date(
        Date.UTC(
          ahora.getFullYear(),
          ahora.getMonth(),
          ahora.getDate(),
          23,
          59,
          59,
          999,
        ),
      );
    }

    // 🔹 1. Traer todos los compradores
    const compradores = await prisma.compradores.findMany({
      select: { compradorId: true, compradorNombre: true },
    });

    // 🔹 2. Consultas masivas para evitar N+1
    // Compras (Movimiento Salida)
    const comprasRaw = await prisma.compra.groupBy({
      by: ["compradorID"],
      _sum: { compraCantidadQQ: true, compraTotal: true },
      where: {
        compraMovimiento: "Salida",
        compraFecha: { gte: desde, lte: hasta },
      },
    });

    // Salidas (salidaMovimiento: "Salida")
    const salidasRaw = await prisma.salida.findMany({
      where: {
        salidaMovimiento: "Salida",
        salidaFecha: { gte: desde, lte: hasta },
      },
      select: {
        compradorID: true,
        salidaCantidadQQ: true,
        salidaPrecio: true,
      },
    });

    // Contratos de Salida (detalleContratoSalida)
    const contratosRaw = await prisma.detalleContratoSalida.findMany({
      where: {
        tipoMovimiento: "Salida",
        fecha: { gte: desde, lte: hasta },
      },
      select: {
        cantidadQQ: true,
        precioQQ: true,
        contratoSalida: { select: { compradorID: true } },
      },
    });

    // Salidas Ejecutadas (Liquidaciones)
    const liquidacionesRaw = await prisma.detalleliqsalida.findMany({
      where: {
        liqsalida: {
          liqFecha: { gte: desde, lte: hasta },
        },
        OR: [{ movimiento: "Salida" }, { movimiento: null }],
      },
      select: {
        cantidadQQ: true,
        salida: { select: { compradorID: true } },
      },
    });

    // 🔹 3. Mapeo en memoria
    const comprasMap = new Map(comprasRaw.map((r) => [r.compradorID, r]));

    // Agrupar Salidas por comprador
    const salidasMap = new Map();
    salidasRaw.forEach((r) => {
      const cid = r.compradorID;
      if (!cid) return;
      const current = salidasMap.get(cid) || { cantidadQQ: 0, totalLps: 0 };
      const qq = Number(r.salidaCantidadQQ || 0);
      const precio = Number(r.salidaPrecio || 0);
      current.cantidadQQ += qq;
      current.totalLps += qq * precio;
      salidasMap.set(cid, current);
    });

    // Agrupar Contratos por comprador
    const contratosMap = new Map();
    contratosRaw.forEach((r) => {
      const cid = r.contratoSalida?.compradorID;
      if (!cid) return;
      const current = contratosMap.get(cid) || { cantidadQQ: 0, totalLps: 0 };
      const qq = Number(r.cantidadQQ || 0);
      const precio = Number(r.precioQQ || 0);
      current.cantidadQQ += qq;
      current.totalLps += qq * precio;
      contratosMap.set(cid, current);
    });

    // Agrupar Liquidaciones por comprador
    const liquidacionesMap = new Map();
    liquidacionesRaw.forEach((r) => {
      const cid = r.salida?.compradorID;
      if (!cid) return;
      if (!liquidacionesMap.has(cid)) liquidacionesMap.set(cid, 0);
      liquidacionesMap.set(
        cid,
        liquidacionesMap.get(cid) + Number(r.cantidadQQ || 0),
      );
    });

    // 🔹 4. Construir reporte final
    const reporte = compradores
      .map((c) => {
        const compra = comprasMap.get(c.compradorId);
        const salida = salidasMap.get(c.compradorId);
        const contrato = contratosMap.get(c.compradorId);
        const liqQQ = liquidacionesMap.get(c.compradorId) || 0;

        const compraCantidadQQ = Number(compra?._sum?.compraCantidadQQ || 0);
        const compraTotalLps = Number(compra?._sum?.compraTotal || 0);
        const salidaCantidadQQ = Number(salida?.cantidadQQ || 0);
        const salidaTotalLps = Number(salida?.totalLps || 0);
        const contratoCantidadQQ = Number(contrato?.cantidadQQ || 0);
        const contratoTotalLps = Number(contrato?.totalLps || 0);
        const salidaEjecutadaQQ = liqQQ;

        const hasMovimientos =
          compraCantidadQQ > 0 ||
          compraTotalLps > 0 ||
          salidaCantidadQQ > 0 ||
          salidaTotalLps > 0 ||
          contratoCantidadQQ > 0 ||
          contratoTotalLps > 0 ||
          salidaEjecutadaQQ > 0;

        if (!hasMovimientos) return null;

        return {
          compradorId: c.compradorId,
          nombre: c.compradorNombre.trim(),
          compraCantidadQQ,
          compraTotalLps,
          salidaCantidadQQ,
          salidaTotalLps,
          contratoCantidadQQ,
          contratoTotalLps,
          salidaEjecutadaQQ,
        };
      })
      .filter((r) => r !== null);

    return new Response(JSON.stringify(reporte), { status: 200 });
  } catch (error) {
    console.error("❌ Error en API:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
