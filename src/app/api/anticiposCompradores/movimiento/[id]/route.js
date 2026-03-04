import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function DELETE(req, props) {
  const params = await props.params;
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const MovimientoId = Number(params.id);
    if (!MovimientoId) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const movimiento =
      await prisma.movimientos_anticipos_compradores.findUnique({
        where: { MovimientoId },
      });

    if (!movimiento) {
      return NextResponse.json(
        { error: "Movimiento no encontrado" },
        { status: 404 },
      );
    }

    await prisma.$transaction([
      prisma.movimientos_anticipos_compradores.update({
        where: { MovimientoId },
        data: { tipo_movimiento: "ANULADO" },
      }),
    ]);

    const movimientosActualizados =
      await prisma.movimientos_anticipos_compradores.findMany({
        where: {
          anticipoId: movimiento.anticipoId,
          tipo_movimiento: { not: "ANULADO" },
        },
      });

    const totalAbonado = movimientosActualizados
      .filter((m) => ["ABONO_ANTICIPO"].includes(m.tipo_movimiento))
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    const totalPagadoInteres = movimientosActualizados
      .filter((m) => ["INTERES_ANTICIPO"].includes(m.tipo_movimiento))
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    const totalCargoInteres = movimientosActualizados
      .filter((m) => ["CARGO_ANTICIPO"].includes(m.tipo_movimiento))
      .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    const anticipo = await prisma.anticipo_compradores.findUnique({
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
      await prisma.anticipo_compradores.update({
        where: { anticipoId: anticipo.anticipoId },
        data: { estado: nuevoEstado },
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Movimiento de anticipo anulado correctamente",
    });
  } catch (error) {
    console.error("Error al anular movimiento de anticipo:", error);
    return NextResponse.json(
      { error: "Error interno al anular el movimiento de anticipo" },
      { status: 500 },
    );
  }
}
