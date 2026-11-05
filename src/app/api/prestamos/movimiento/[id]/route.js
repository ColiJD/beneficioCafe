import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { ErrorNegocio, respuestaError } from "@/lib/inventarioMov";

export async function DELETE(req, props) {
  const params = await props.params;
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const MovimientoId = Number(params.id);
    if (!MovimientoId) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    // 🔹 Buscar el movimiento
    const movimiento = await prisma.movimientos_prestamo.findUnique({
      where: { MovimientoId },
    });

    if (!movimiento) {
      return new Response(
        JSON.stringify({ error: "Movimiento no encontrado" }),
        { status: 404 },
      );
    }

    // 🔹 Anular el movimiento dentro de una transacción
    await prisma.$transaction([
      prisma.movimientos_prestamo.update({
        where: { MovimientoId },
        data: { tipo_movimiento: "ANULADO" },
      }),
    ]);

    // 🔹 Recalcular saldo y estado del préstamo
    const movimientosActualizados = await prisma.movimientos_prestamo.findMany({
      where: {
        prestamo_id: movimiento.prestamo_id,
        tipo_movimiento: { not: "ANULADO" },
      },
    });

    const totalAbonado = movimientosActualizados
      .filter((m) => ["ABONO"].includes(m.tipo_movimiento))
      .reduce((acc, m) => acc + Number(m.monto), 0);

    const totalPagadoInteres = movimientosActualizados
      .filter((m) => ["PAGO_INTERES"].includes(m.tipo_movimiento))
      .reduce((acc, m) => acc + Number(m.monto), 0);

    const totalCargoInteres = movimientosActualizados
      .filter((m) => ["Int-Cargo"].includes(m.tipo_movimiento))
      .reduce((acc, m) => acc + Number(m.monto), 0);

    // Obtener el préstamo para saber el monto original
    const prestamo = await prisma.prestamos.findUnique({
      where: { prestamoId: movimiento.prestamo_id },
    });

    const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    const saldoTotal = roundToTwo(
      Number(prestamo.monto || 0) +
        totalCargoInteres -
        (totalAbonado + totalPagadoInteres),
    );

    let nuevoEstado = prestamo.estado;
    if (saldoTotal <= 0 && prestamo.estado !== "COMPLETADO") {
      nuevoEstado = "COMPLETADO";
    } else if (saldoTotal > 0 && prestamo.estado === "COMPLETADO") {
      nuevoEstado = "ACTIVO";
    }

    if (nuevoEstado !== prestamo.estado) {
      await prisma.prestamos.update({
        where: { prestamoId: prestamo.prestamoId },
        data: { estado: nuevoEstado },
      });
    }

    return new Response(
      JSON.stringify({ message: "Movimiento anulado correctamente" }),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ErrorNegocio) return respuestaError(error);
    console.error("❌ Error al anular movimiento:", error);
    return new Response(
      JSON.stringify({ error: "Error interno al anular el movimiento" }),
      { status: 500 },
    );
  }
}
