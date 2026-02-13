import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helper function to round numbers
const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

export async function POST(req) {
  try {
    const results = {
      prestamos: { total: 0, updated: 0 },
      anticipos: { total: 0, updated: 0 },
    };

    // === FIX PRESTAMOS ===
    const prestamos = await prisma.prestamos.findMany({
      include: { movimientos_prestamo: true },
    });
    results.prestamos.total = prestamos.length;

    for (const p of prestamos) {
      if (p.estado === "ANULADO") continue;

      const totalAbonado = p.movimientos_prestamo
        .filter((m) => ["ABONO"].includes(m.tipo_movimiento))
        .reduce((acc, m) => acc + Number(m.monto), 0);

      const totalPagadoInteres = p.movimientos_prestamo
        .filter((m) => ["PAGO_INTERES"].includes(m.tipo_movimiento))
        .reduce((acc, m) => acc + Number(m.monto), 0);

      const totalCargoInteres = p.movimientos_prestamo
        .filter((m) => ["Int-Cargo"].includes(m.tipo_movimiento))
        .reduce((acc, m) => acc + Number(m.monto), 0);

      const saldoTotal = roundToTwo(
        Number(p.monto || 0) +
          totalCargoInteres -
          (totalAbonado + totalPagadoInteres),
      );

      let nuevoEstado = p.estado;
      if (saldoTotal <= 0 && p.estado !== "COMPLETADO") {
        nuevoEstado = "COMPLETADO";
      } else if (saldoTotal > 0 && p.estado === "COMPLETADO") {
        nuevoEstado = "ACTIVO";
      }

      if (nuevoEstado !== p.estado) {
        await prisma.prestamos.update({
          where: { prestamoId: p.prestamoId },
          data: { estado: nuevoEstado },
        });
        results.prestamos.updated++;
      }
    }

    // === FIX ANTICIPOS ===
    const anticipos = await prisma.anticipo.findMany({
      include: { movimientos_anticipos: true },
    });
    results.anticipos.total = anticipos.length;

    for (const a of anticipos) {
      if (a.estado === "ANULADO") continue;

      const totalAbonado = a.movimientos_anticipos
        .filter((m) => ["ABONO_ANTICIPO"].includes(m.tipo_movimiento))
        .reduce((acc, m) => acc + Number(m.monto || 0), 0);

      const totalPagadoInteres = a.movimientos_anticipos
        .filter((m) => ["INTERES_ANTICIPO"].includes(m.tipo_movimiento))
        .reduce((acc, m) => acc + Number(m.monto), 0);

      const totalCargoInteres = a.movimientos_anticipos
        .filter((m) => ["CARGO_ANTICIPO"].includes(m.tipo_movimiento))
        .reduce((acc, m) => acc + Number(m.monto), 0);

      const saldoTotal = roundToTwo(
        Number(a.monto || 0) +
          totalCargoInteres -
          (totalAbonado + totalPagadoInteres),
      );

      let nuevoEstado = a.estado;
      if (saldoTotal <= 0 && a.estado !== "COMPLETADO") {
        nuevoEstado = "COMPLETADO";
      } else if (saldoTotal > 0 && a.estado === "COMPLETADO") {
        nuevoEstado = "ACTIVO";
      }

      if (nuevoEstado !== a.estado) {
        await prisma.anticipo.update({
          where: { anticipoId: a.anticipoId },
          data: { estado: nuevoEstado },
        });
        results.anticipos.updated++;
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Proceso de corrección finalizado.",
      results,
    });
  } catch (error) {
    console.error("Error fixes:", error);
    return NextResponse.json(
      { error: "Error al ejecutar corrección" },
      { status: 500 },
    );
  }
}
