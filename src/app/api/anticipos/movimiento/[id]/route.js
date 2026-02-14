import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function DELETE(req, props) {
  const params = await props.params;
  // ✅ Validar permisos
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
    const movimiento = await prisma.movimientos_anticipos.findUnique({
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
      prisma.movimientos_anticipos.update({
        where: { MovimientoId },
        data: { tipo_movimiento: "ANULADO" },
      }),
    ]);

    // 🔹 Recalcular saldo y estado del anticipo
    const movimientosActualizados = await prisma.movimientos_anticipos.findMany(
      {
        where: {
          anticipoId: movimiento.anticipoId,
          tipo_movimiento: { not: "ANULADO" },
        },
      },
    );

    const totalAbonado = movimientosActualizados
      .filter((m) => ["ABONO_ANTICIPO"].includes(m.tipo_movimiento))
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    const totalPagadoInteres = movimientosActualizados
      .filter((m) => ["INTERES_ANTICIPO"].includes(m.tipo_movimiento))
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    const totalCargoInteres = movimientosActualizados
      .filter((m) => ["CARGO_ANTICIPO"].includes(m.tipo_movimiento))
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    // Obtener el anticipo para saber el monto original
    const anticipo = await prisma.anticipo.findUnique({
      where: { anticipoId: movimiento.anticipoId },
    });

    const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    const saldoTotal = roundToTwo(
      Number(anticipo.monto || 0) +
        totalCargoInteres -
        (totalAbonado + totalPagadoInteres),
    );

    let nuevoEstado = anticipo.estado;
    if (saldoTotal <= 0 && anticipo.estado !== "COMPLETADO") {
      nuevoEstado = "COMPLETADO";
    } else if (saldoTotal > 0 && anticipo.estado === "COMPLETADO") {
      nuevoEstado = "ACTIVO";
    }

    if (nuevoEstado !== anticipo.estado) {
      await prisma.anticipo.update({
        where: { anticipoId: anticipo.anticipoId },
        data: { estado: nuevoEstado },
      });
    }

    return new Response(
      JSON.stringify({
        message: "Movimiento de anticipo anulado correctamente",
      }),
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Error al anular movimiento de anticipo:", error);
    return new Response(
      JSON.stringify({
        error: "Error interno al anular el movimiento de anticipo",
      }),
      { status: 500 },
    );
  }
}
