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
      // UTC para todo el día
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

    // 🔹 Compras
    const comprasEntradas = await prisma.compra.aggregate({
      _sum: { compraCantidadQQ: true, compraTotal: true, compraRetencio: true },
      where: {
        compraMovimiento: "Entrada",
        compraFecha: { gte: desde, lte: hasta },
      },
    });

    const comprasSalidas = await prisma.compra.aggregate({
      _sum: { compraCantidadQQ: true, compraTotal: true, compraRetencio: true },
      where: {
        compraMovimiento: "Salida",
        compraFecha: { gte: desde, lte: hasta },
      },
    });

    // 🔹 Contratos
    const contratosDetalles = await prisma.detallecontrato.findMany({
      where: { tipoMovimiento: "Entrada", fecha: { gte: desde, lte: hasta } },
      select: { cantidadQQ: true, precioQQ: true },
    });

    const contratosEntradas = contratosDetalles.reduce(
      (acc, item) => {
        acc.cantidadQQ += Number(item.cantidadQQ || 0);
        acc.total += Number(item.cantidadQQ || 0) * Number(item.precioQQ || 0);
        return acc;
      },
      { cantidadQQ: 0, total: 0 }
    );

    // 🔹 Depósitos
    const depositosEntradas = await prisma.detalleliqdeposito.aggregate({
      _sum: { cantidadQQ: true, totalLps: true },
      where: {
        liqdeposito: {
          liqMovimiento: "Entrada",
          liqFecha: { gte: desde, lte: hasta },
        },
      },
    });

    // 🔹 Total Depósitos Reales (Entradas al almacén)
    const totalDepositosRaw = await prisma.deposito.aggregate({
      _sum: { depositoCantidadQQ: true },
      where: {
        depositoMovimiento: "Deposito",
        depositoFecha: { gte: desde, lte: hasta },
      },
    });
    const totalDepositosQQ = Number(
      totalDepositosRaw._sum.depositoCantidadQQ ?? 0
    );

    // 🔹 Salidas
    const salidasDetalles = await prisma.salida.findMany({
      where: {
        salidaMovimiento: "Salida",
        salidaFecha: { gte: desde, lte: hasta },
      },
      select: { salidaCantidadQQ: true, salidaPrecio: true },
    });

    const salidas = salidasDetalles.reduce(
      (acc, item) => {
        const cantidad = Number(item.salidaCantidadQQ || 0);
        const precio = Number(item.salidaPrecio || 0);
        acc.cantidadQQ += cantidad;
        acc.total += cantidad * precio;
        return acc;
      },
      { cantidadQQ: 0, total: 0 }
    );

    const contratoSalidas = await prisma.detalleContratoSalida.findMany({
      where: {
        tipoMovimiento: "Salida",
        fecha: { gte: desde, lte: hasta },
      },
      select: { cantidadQQ: true, precioQQ: true },
    });

    const contratoSalidasTotal = contratoSalidas.reduce(
      (acc, item) => {
        acc.cantidadQQ += Number(item.cantidadQQ || 0);
        acc.total += Number(item.cantidadQQ || 0) * Number(item.precioQQ || 0);
        return acc;
      },
      { cantidadQQ: 0, total: 0 }
    );

    // 🔹 Préstamos
    const prestamosActivos = await prisma.prestamos.aggregate({
      _sum: { monto: true },
      where: { estado: "ACTIVO" },
    });

    // 🔹 Movimientos de préstamo filtrando los tres tipos
    const movimientosPrestamo = await prisma.movimientos_prestamo.groupBy({
      by: ["tipo_movimiento"],
      _sum: { monto: true },
      where: {
        tipo_movimiento: { in: ["ABONO", "PAGO_INTERES", "Int-Cargo"] },
        // usa el rango de fechas definido arriba
      },
    });

    // Inicializamos los valores por tipo
    const resumenMovimientos = {
      ABONO: 0,
      PAGO_INTERES: 0,
      "Int-Cargo": 0,
    };

    movimientosPrestamo.forEach((mov) => {
      if (
        mov.tipo_movimiento &&
        resumenMovimientos.hasOwnProperty(mov.tipo_movimiento)
      ) {
        resumenMovimientos[mov.tipo_movimiento] = Number(mov._sum.monto ?? 0);
      }
    });

    // Resultado final de préstamos
    const prestamos = {
      totalPrestamosActivos: Number(prestamosActivos._sum.monto ?? 0),
      movimientos: resumenMovimientos,
    };

    // 🔹 Anticipos
    const anticiposActivos = await prisma.anticipo.aggregate({
      _sum: { monto: true },
      where: { estado: "ACTIVO" },
    });

    // 🔹 Movimientos de anticipo filtrando los dos tipos
    const movimientosAnticipo = await prisma.movimientos_anticipos.groupBy({
      by: ["tipo_movimiento"],
      _sum: { monto: true },
      where: {
        tipo_movimiento: {
          in: ["CARGO_ANTICIPO", "INTERES_ANTICIPO", "ABONO_ANTICIPO"],
        },
        // usa el mismo rango de fechas
      },
    });

    // Inicializamos los valores por tipo
    const resumenMovimientosAnticipo = {
      CARGO_ANTICIPO: 0,
      INTERES_ANTICIPO: 0,
      ABONO_ANTICIPO: 0,
    };

    movimientosAnticipo.forEach((mov) => {
      if (
        mov.tipo_movimiento &&
        resumenMovimientosAnticipo.hasOwnProperty(mov.tipo_movimiento)
      ) {
        resumenMovimientosAnticipo[mov.tipo_movimiento] = Number(
          mov._sum.monto ?? 0
        );
      }
    });

    // Resultado final de anticipos
    const anticipos = {
      totalAnticiposActivos: Number(anticiposActivos._sum.monto ?? 0),
      movimientos: resumenMovimientosAnticipo,
    };
    const inventario = await prisma.inventariocliente.aggregate({
      _sum: { cantidadQQ: true },
    });

    // 1️⃣ Total de salidas válidas
    const totalSalidasRaw = await prisma.salida.aggregate({
      _sum: { salidaCantidadQQ: true },
      where: { salidaMovimiento: "Salida" },
    });
    const totalSalidas = Number(totalSalidasRaw._sum.salidaCantidadQQ ?? 0);

    // 2️⃣ Total liquidado válido (detalle no anulado)
    const totalLiquidadoRaw = await prisma.detalleliqsalida.aggregate({
      _sum: { cantidadQQ: true },
      where: {
        OR: [
          { movimiento: null }, // incluir los nulos
          { movimiento: { not: "Anulado" } }, // incluir los distintos de "Anulado"
        ],
      },
    });
    const totalLiquidado = Number(totalLiquidadoRaw._sum.cantidadQQ ?? 0);

    // 3️⃣ Pendiente
    const pendiente = totalSalidas - totalLiquidado;

    return new Response(
      JSON.stringify({
        compras: { entradas: comprasEntradas, salidas: comprasSalidas },
        contratos: { entradas: contratosEntradas },
        depositos: { entradas: depositosEntradas, totalDepositosQQ },
        salidas,
        prestamos,
        anticipos,
        inventario: {
          disponibleQQ: Number(inventario._sum.cantidadQQ ?? 0),
        },
        totalSalidas,
        totalLiquidado,
        pendiente,
        contratoSalidasTotal,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error en API:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
