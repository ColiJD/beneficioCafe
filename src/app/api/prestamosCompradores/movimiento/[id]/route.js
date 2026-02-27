import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function DELETE(req, props) {
  const params = await props.params;
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { id } = params;

    const movimiento = await prisma.movimientos_prestamo_compradores.findUnique(
      {
        where: { MovimientoId: parseInt(id) },
      },
    );

    if (!movimiento) {
      return NextResponse.json(
        { error: "Movimiento no encontrado" },
        { status: 404 },
      );
    }

    await prisma.movimientos_prestamo_compradores.update({
      where: { MovimientoId: parseInt(id) },
      data: { tipo_movimiento: "ANULADO" },
    });

    // Recalcular estado del préstamo si es necesario
    const prestamo = await prisma.prestamos_compradores.findUnique({
      where: { prestamoId: movimiento.prestamo_id },
      include: { movimientos_prestamo: true },
    });

    if (prestamo) {
      const roundToTwo = (num) =>
        Math.round((num + Number.EPSILON) * 100) / 100;
      const abonos = prestamo.movimientos_prestamo
        .filter((m) => m.tipo_movimiento === "ABONO")
        .reduce((s, m) => s + Number(m.monto), 0);
      const cargos = prestamo.movimientos_prestamo
        .filter((m) => m.tipo_movimiento === "Int-Cargo")
        .reduce((s, m) => s + Number(m.monto), 0);
      const pagosI = prestamo.movimientos_prestamo
        .filter((m) => m.tipo_movimiento === "PAGO_INTERES")
        .reduce((s, m) => s + Number(m.monto), 0);

      const saldo = roundToTwo(
        Number(prestamo.monto) + cargos - (abonos + pagosI),
      );

      if (saldo > 0 && prestamo.estado === "COMPLETADO") {
        await prisma.prestamos_compradores.update({
          where: { prestamoId: prestamo.prestamoId },
          data: { estado: "ACTIVO" },
        });
      }
    }

    return NextResponse.json({ ok: true, message: "Movimiento eliminado" });
  } catch (error) {
    console.error("Error al eliminar movimiento de comprador:", error);
    return NextResponse.json(
      { error: "Error al eliminar movimiento" },
      { status: 500 },
    );
  }
}
