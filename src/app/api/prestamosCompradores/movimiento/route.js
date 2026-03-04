import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function POST(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const body = await req.json();
    const {
      compradorID,
      tipo_movimiento,
      monto,
      fecha,
      observacion,
      interes,
      dias,
    } = body;

    if (!compradorID || !tipo_movimiento || monto == null || isNaN(monto)) {
      return NextResponse.json(
        { error: "Datos incompletos o monto inválido" },
        { status: 400 },
      );
    }

    const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;
    const montoIngresado = roundToTwo(parseFloat(monto));

    await prisma.$transaction(async (tx) => {
      const prestamos = await tx.prestamos_compradores.findMany({
        where: { compradorId: compradorID, estado: { not: "ANULADO" } },
        include: { movimientos_prestamo: true },
        orderBy: { fecha: "asc" },
      });

      if (prestamos.length === 0) {
        throw new Error(
          "No existen préstamos registrados para este comprador.",
        );
      }

      // === 🔹 ABONO AL CAPITAL (FIFO) ===
      if (tipo_movimiento === "ABONO") {
        let deudaTotalCapital = 0;

        const prestamosPendientes = prestamos
          .map((p) => {
            const capitalPagado = p.movimientos_prestamo
              .filter((m) => ["ABONO"].includes(m.tipo_movimiento))
              .reduce((sum, m) => sum + Number(m.monto), 0);

            const capitalPagadoRounded = roundToTwo(capitalPagado);
            const deudaCapital = roundToTwo(
              Number(p.monto) - capitalPagadoRounded,
            );

            deudaTotalCapital = roundToTwo(deudaTotalCapital + deudaCapital);
            return { prestamo: p, deudaCapital };
          })
          .filter((p) => p.deudaCapital > 0);

        if (prestamosPendientes.length === 0) {
          throw new Error("No hay capital pendiente para este comprador.");
        }

        if (montoIngresado > deudaTotalCapital) {
          throw new Error(
            `El abono (L. ${montoIngresado.toFixed(2)}) excede el capital pendiente (L. ${deudaTotalCapital.toFixed(2)}).`,
          );
        }

        let montoRestante = montoIngresado;
        for (const p of prestamosPendientes) {
          if (montoRestante <= 0) break;

          const montoAplicar = roundToTwo(
            Math.min(montoRestante, p.deudaCapital),
          );

          await tx.movimientos_prestamo_compradores.create({
            data: {
              prestamo_id: p.prestamo.prestamoId,
              fecha: fecha ? new Date(fecha) : new Date(),
              tipo_movimiento,
              monto: montoAplicar,
              interes: null,
              dias: dias ? parseInt(dias) : null,
              descripcion: observacion || tipo_movimiento,
            },
          });

          // Recalcular estado
          const movimientosActualizados =
            await tx.movimientos_prestamo_compradores.findMany({
              where: { prestamo_id: p.prestamo.prestamoId },
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

          const saldoTotal = roundToTwo(
            Number(p.prestamo.monto) +
              totalCargoInteres -
              (totalAbonado + totalPagadoInteres),
          );

          if (saldoTotal <= 0) {
            await tx.prestamos_compradores.update({
              where: { prestamoId: p.prestamo.prestamoId },
              data: { estado: "COMPLETADO" },
            });
          }

          montoRestante = roundToTwo(montoRestante - montoAplicar);
        }
      }

      // === 🔹 PAGO DE INTERESES ===
      if (tipo_movimiento === "PAGO_INTERES") {
        let interesesTotales = 0;

        const prestamosConIntereses = prestamos
          .map((p) => {
            const cargos = p.movimientos_prestamo
              .filter((m) => m.tipo_movimiento === "Int-Cargo")
              .reduce((sum, m) => sum + Number(m.monto), 0);
            const pagosInteres = p.movimientos_prestamo
              .filter((m) => m.tipo_movimiento === "PAGO_INTERES")
              .reduce((sum, m) => sum + Number(m.monto), 0);

            const interesPendiente = roundToTwo(
              roundToTwo(cargos) - roundToTwo(pagosInteres),
            );
            interesesTotales = roundToTwo(interesesTotales + interesPendiente);
            return { prestamo: p, interesPendiente };
          })
          .filter((p) => p.interesPendiente > 0);

        if (prestamosConIntereses.length === 0) {
          throw new Error("No hay intereses pendientes para este comprador.");
        }

        if (montoIngresado > interesesTotales) {
          throw new Error(
            `El pago de intereses (L. ${montoIngresado}) excede los intereses pendientes (L. ${interesesTotales}).`,
          );
        }

        let montoRestante = montoIngresado;
        for (const p of prestamosConIntereses) {
          if (montoRestante <= 0) break;

          const montoAplicar = roundToTwo(
            Math.min(montoRestante, p.interesPendiente),
          );

          await tx.movimientos_prestamo_compradores.create({
            data: {
              prestamo_id: p.prestamo.prestamoId,
              fecha: fecha ? new Date(fecha) : new Date(),
              tipo_movimiento,
              monto: montoAplicar,
              interes: null,
              dias: dias ? parseInt(dias) : null,
              descripcion: observacion || tipo_movimiento,
            },
          });

          // Recalcular estado
          const movimientosActualizados =
            await tx.movimientos_prestamo_compradores.findMany({
              where: { prestamo_id: p.prestamo.prestamoId },
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

          const saldoTotal = roundToTwo(
            Number(p.prestamo.monto) +
              totalCargoInteres -
              (totalAbonado + totalPagadoInteres),
          );

          if (saldoTotal <= 0) {
            await tx.prestamos_compradores.update({
              where: { prestamoId: p.prestamo.prestamoId },
              data: { estado: "COMPLETADO" },
            });
          }

          montoRestante = roundToTwo(montoRestante - montoAplicar);
        }
      }

      // === 🔹 INT-CARGO ===
      if (tipo_movimiento === "Int-Cargo") {
        const prestamosPendientes = prestamos
          .filter((p) => p.estado !== "ANULADO")
          .map((p) => {
            const abonos = p.movimientos_prestamo
              .filter((m) => m.tipo_movimiento === "ABONO")
              .reduce((s, m) => s + Number(m.monto), 0);
            const cargos = p.movimientos_prestamo
              .filter((m) => m.tipo_movimiento === "Int-Cargo")
              .reduce((s, m) => s + Number(m.monto), 0);
            const pagosI = p.movimientos_prestamo
              .filter((m) => m.tipo_movimiento === "PAGO_INTERES")
              .reduce((s, m) => s + Number(m.monto), 0);

            const saldo = roundToTwo(
              Number(p.monto) + cargos - (abonos + pagosI),
            );
            return { ...p, saldo };
          })
          .filter((p) => p.saldo > 0);

        if (prestamosPendientes.length === 0) {
          throw new Error(
            "No hay préstamos con saldo pendiente para aplicar cargos.",
          );
        }

        const p = prestamosPendientes[0];

        await tx.movimientos_prestamo_compradores.create({
          data: {
            prestamo_id: p.prestamoId,
            fecha: fecha ? new Date(fecha) : new Date(),
            tipo_movimiento,
            monto: montoIngresado,
            interes: interes ? parseFloat(interes) : null,
            dias: dias ? parseInt(dias) : null,
            descripcion: observacion || "Interés cargado",
          },
        });

        if (p.estado === "COMPLETADO") {
          await tx.prestamos_compradores.update({
            where: { prestamoId: p.prestamoId },
            data: { estado: "ACTIVO" },
          });
        }
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Movimiento registrado correctamente.",
    });
  } catch (error) {
    console.error("Error al registrar movimiento de comprador:", error);
    return NextResponse.json(
      { error: error.message || "Error interno al registrar movimiento." },
      { status: 500 },
    );
  }
}
