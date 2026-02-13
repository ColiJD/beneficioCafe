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
      // Usar UTC y asegurar que incluya todo el día
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

    // 🔹 1. Traer todos los clientes necesarios
    const clientes = await prisma.cliente.findMany({
      select: { clienteID: true, clienteNombre: true, clienteApellido: true },
    });

    // 🔹 2. Consultas masivas para evitar N+1
    // Compras
    const comprasRaw = await prisma.compra.groupBy({
      by: ["clienteID"],
      _sum: { compraCantidadQQ: true, compraTotal: true },
      where: {
        compraMovimiento: "Entrada",
        compraFecha: { gte: desde, lte: hasta },
      },
    });

    // Contratos (detallecontrato -> contrato -> cliente)
    const contratosRaw = await prisma.detallecontrato.findMany({
      where: {
        tipoMovimiento: "Entrada",
        fecha: { gte: desde, lte: hasta },
      },
      select: {
        cantidadQQ: true,
        precioQQ: true,
        contrato: { select: { contratoclienteID: true } },
      },
    });

    // Depósitos (detalleliqdeposito -> liqdeposito -> cliente)
    const depositosRaw = await prisma.detalleliqdeposito.findMany({
      where: {
        liqdeposito: {
          liqMovimiento: "Entrada",
          liqFecha: { gte: desde, lte: hasta },
        },
      },
      select: {
        cantidadQQ: true,
        totalLps: true,
        liqdeposito: { select: { liqclienteID: true } },
      },
    });

    // Depósitos Totales (Reales)
    const depositosRealesRaw = await prisma.deposito.groupBy({
      by: ["clienteID"],
      _sum: { depositoCantidadQQ: true },
      where: {
        depositoMovimiento: "Deposito",
        depositoFecha: { gte: desde, lte: hasta },
      },
    });

    // 🔹 3. Mapeo en memoria
    const comprasMap = new Map(comprasRaw.map((r) => [r.clienteID, r]));
    const depositosRealesMap = new Map(
      depositosRealesRaw.map((r) => [r.clienteID, r]),
    );

    // Agrupar contratos por cliente
    const contratosMap = new Map();
    contratosRaw.forEach((r) => {
      const cid = r.contrato?.contratoclienteID;
      if (!cid) return;
      const current = contratosMap.get(cid) || { cantidadQQ: 0, totalLps: 0 };
      current.cantidadQQ += Number(r.cantidadQQ || 0);
      current.totalLps += Number(r.cantidadQQ || 0) * Number(r.precioQQ || 0);
      contratosMap.set(cid, current);
    });

    // Agrupar depósitos por cliente
    const depositosLiqMap = new Map();
    depositosRaw.forEach((r) => {
      const cid = r.liqdeposito?.liqclienteID;
      if (!cid) return;
      const current = depositosLiqMap.get(cid) || {
        cantidadQQ: 0,
        totalLps: 0,
      };
      current.cantidadQQ += Number(r.cantidadQQ || 0);
      current.totalLps += Number(r.totalLps || 0);
      depositosLiqMap.set(cid, current);
    });

    // 🔹 4. Construir reporte final
    const reporte = clientes
      .map((c) => {
        const compra = comprasMap.get(c.clienteID);
        const contrato = contratosMap.get(c.clienteID);
        const depositoLiq = depositosLiqMap.get(c.clienteID);
        const depositoReal = depositosRealesMap.get(c.clienteID);

        const compraCantidadQQ = Number(compra?._sum?.compraCantidadQQ || 0);
        const compraTotalLps = Number(compra?._sum?.compraTotal || 0);
        const contratoCantidadQQ = Number(contrato?.cantidadQQ || 0);
        const contratoTotalLps = Number(contrato?.totalLps || 0);
        const depositoCantidadQQ = Number(depositoLiq?.cantidadQQ || 0);
        const depositoTotalLps = Number(depositoLiq?.totalLps || 0);
        const totalDepositosQQ = Number(
          depositoReal?._sum?.depositoCantidadQQ || 0,
        );

        const hasMovimientos =
          compraCantidadQQ > 0 ||
          contratoCantidadQQ > 0 ||
          depositoCantidadQQ > 0 ||
          totalDepositosQQ > 0;

        if (!hasMovimientos) return null;

        return {
          clienteID: c.clienteID,
          nombre: `${c.clienteNombre || ""} ${c.clienteApellido || ""}`.trim(),
          compraCantidadQQ,
          compraTotalLps,
          contratoCantidadQQ,
          contratoTotalLps,
          depositoCantidadQQ,
          depositoTotalLps,
          totalDepositosQQ,
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
