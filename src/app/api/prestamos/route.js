import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const body = await req.json();
    const { clienteID, monto, tasa_interes, fecha, observacion } = body;

    // 1️⃣ Validaciones básicas
    if (!clienteID || !monto || isNaN(monto)) {
      return NextResponse.json(
        { error: "Datos incompletos o monto inválido" },
        { status: 400 }
      );
    }

    // 2️⃣ Crear el nuevo préstamo
    const nuevoPrestamo = await prisma.prestamos.create({
      data: {
        clienteId: clienteID,
        monto: parseFloat(monto),
        tasa_interes: parseFloat(tasa_interes || 0),
        fecha: fecha ? new Date(fecha) : new Date(),
        observacion: observacion || "",
        estado: "ACTIVO",
      },
    });

    // 3️⃣ Obtener préstamos temporales
    const prestamosTemporales = await prisma.prestamos.findMany({
      where: { clienteId: clienteID, estado: "INICIAL" },
      select: { prestamoId: true },
    });

    const idsTemporales = prestamosTemporales.map((p) => p.prestamoId);

    if (idsTemporales.length > 0) {
      // 4️⃣ Mover movimientos de temporales al nuevo préstamo
      await prisma.movimientos_prestamo.updateMany({
        where: { prestamo_id: { in: idsTemporales } },
        data: { prestamo_id: nuevoPrestamo.prestamoId },
      });

      // 5️⃣ Marcar los temporales como absorbidos
      await prisma.prestamos.updateMany({
        where: { prestamoId: { in: idsTemporales } },
        data: { estado: "ABSORBIDO" },
      });
    }

    // 6️⃣ Recargar el préstamo con todos los movimientos actualizados
    const prestamoConMovimientos = await prisma.prestamos.findUnique({
      where: { prestamoId: nuevoPrestamo.prestamoId },
      include: { movimientos_prestamo: true },
    });

    // 7️⃣ Calcular total de intereses y total abonado
    const totalCapital = Number(prestamoConMovimientos.monto || 0);

    const totalIntereses = prestamoConMovimientos.movimientos_prestamo
      .filter((m) => ["CARGO_INTERES", "ANTICIPO"].includes(m.tipo_movimiento))
      .reduce((acc, m) => acc + Number(m.monto), 0);

    const totalAbonado = prestamoConMovimientos.movimientos_prestamo
      .filter((m) =>
        ["ABONO", "ABONO_INTERES", "PAGO_INTERES"].includes(m.tipo_movimiento)
      )
      .reduce((acc, m) => acc + Number(m.monto), 0);

    // 8️⃣ Marcar como COMPLETADO si corresponde
    if (totalAbonado >= totalCapital + totalIntereses) {
      await prisma.prestamos.update({
        where: { prestamoId: prestamoConMovimientos.prestamoId },
        data: { estado: "COMPLETADO" },
      });
    }

    return NextResponse.json({ ok: true, prestamo: prestamoConMovimientos });
  } catch (error) {
    console.error("Error al crear préstamo:", error);
    return NextResponse.json(
      { error: "Error al crear préstamo" },
      { status: 500 }
    );
  }
}
