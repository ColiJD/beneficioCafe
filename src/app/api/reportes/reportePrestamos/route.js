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
    const desde = searchParams.get("desde")
      ? new Date(searchParams.get("desde"))
      : new Date("2000-01-01");

    const hasta = searchParams.get("hasta")
      ? new Date(searchParams.get("hasta"))
      : new Date();

    // 1️⃣ Clientes
    const clientes = await prisma.cliente.findMany({
      select: {
        clienteID: true,
        clienteNombre: true,
        clienteApellido: true,
      },
      orderBy: { clienteNombre: "asc" },
    });

    const resultados = [];

    for (const cli of clientes) {
      // -------------------------------------------------------------
      // 2️⃣ PRESTAMOS → activos + movimientos
      // -------------------------------------------------------------
      const activosPrestamo = await prisma.prestamos.aggregate({
        _sum: { monto: true },
        where: {
          clienteId: cli.clienteID,
          estado: "ACTIVO",
        },
      });

      const movPrestamo = await prisma.movimientos_prestamo.groupBy({
        by: ["tipo_movimiento"],
        _sum: { monto: true },
        where: {
          prestamos: { clienteId: cli.clienteID },
          fecha: { gte: desde, lte: hasta },
          tipo_movimiento: { in: ["Int-Cargo", "ABONO", "PAGO_INTERES"] },
        },
      });

      const Mpre = {
        "Int-Cargo": 0,
        ABONO: 0,
        PAGO_INTERES: 0,
      };
      for (const m of movPrestamo) {
        Mpre[m.tipo_movimiento] = Number(m._sum.monto ?? 0);
      }

      const activoPrestamo =
        Number(activosPrestamo._sum.monto ?? 0) + Mpre["Int-Cargo"];
      const abonoPrestamo = Mpre["ABONO"] + Mpre["PAGO_INTERES"];
      const saldoPrestamo = activoPrestamo - abonoPrestamo;

      // -------------------------------------------------------------
      // 3️⃣ ANTICIPOS → activos + movimientos
      // -------------------------------------------------------------
      const activosAnticipo = await prisma.anticipo.aggregate({
        _sum: { monto: true },
        where: {
          clienteId: cli.clienteID,
          estado: "ACTIVO",
        },
      });

      const movAnticipo = await prisma.movimientos_anticipos.groupBy({
        by: ["tipo_movimiento"],
        _sum: { monto: true },
        where: {
          anticipo: { clienteId: cli.clienteID },
          fecha: { gte: desde, lte: hasta },
          tipo_movimiento: {
            in: ["CARGO_ANTICIPO", "INTERES_ANTICIPO", "ABONO_ANTICIPO"],
          },
        },
      });

      const Manti = {
        CARGO_ANTICIPO: 0,
        INTERES_ANTICIPO: 0,
        ABONO_ANTICIPO: 0,
      };
      for (const m of movAnticipo) {
        Manti[m.tipo_movimiento] = Number(m._sum.monto ?? 0);
      }

      const activoAnticipo =
        Number(activosAnticipo._sum.monto ?? 0) + Manti["CARGO_ANTICIPO"];
      const abonoAnticipo = Manti["ABONO_ANTICIPO"] + Manti["INTERES_ANTICIPO"];
      const saldoAnticipo = activoAnticipo - abonoAnticipo;

      const totalCliente =
        activoPrestamo +
        abonoPrestamo +
        saldoPrestamo +
        activoAnticipo +
        abonoAnticipo +
        saldoAnticipo;

      if (totalCliente === 0) continue;

      // -------------------------------------------------------------
      // 4️⃣ Enviar cliente con cálculos listos
      // -------------------------------------------------------------
      resultados.push({
        clienteID: cli.clienteID,
        nombre: `${cli.clienteNombre ?? ""} ${
          cli.clienteApellido ?? ""
        }`.trim(),
        activoPrestamo,
        abonoPrestamo,
        saldoPrestamo,
        activoAnticipo,
        abonoAnticipo,
        saldoAnticipo,
      });
    }

    return Response.json({ ok: true, clientes: resultados });
  } catch (error) {
    console.error("ERROR REPORTE: ", error);
    return Response.json(
      { ok: false, error: "Error al obtener el reporte" },
      { status: 500 }
    );
  }
}
