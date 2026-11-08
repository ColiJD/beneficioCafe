import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { ErrorNegocio, respuestaError } from "@/lib/inventarioMov";

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
      clienteID,
      tipo_movimiento,
      monto,
      fecha,
      observacion,
      interes,
      dias,
    } = body;

    if (!clienteID || !tipo_movimiento || monto == null || isNaN(monto)) {
      return NextResponse.json(
        { error: "Datos incompletos o monto inválido" },
        { status: 400 },
      );
    }

    const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;
    const montoIngresado = roundToTwo(parseFloat(monto));

    await prisma.$transaction(async (tx) => {
      const prestamos = await tx.prestamos.findMany({
        where: { clienteId: clienteID, estado: { not: "ANULADO" } },
        include: { movimientos_prestamo: true },
        orderBy: { fecha: "asc" },
      });

      if (prestamos.length === 0) {
        throw new Error("No existen préstamos registrados para este cliente.");
      }

      // === 🔹 ABONO AL CAPITAL ===
      if (tipo_movimiento === "ABONO") {
        let deudaTotalCapital = 0;

        // Filtrar préstamos con capital pendiente
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
          throw new Error("No hay capital pendiente para este cliente.");
        }

        if (montoIngresado > deudaTotalCapital) {
          throw new Error(
            `El abono (L. ${montoIngresado.toFixed(
              2,
            )}) excede el capital pendiente (L. ${deudaTotalCapital.toFixed(
              2,
            )}).`,
          );
        }

        // Aplicar ABONO FIFO
        let montoRestante = montoIngresado;
        for (const p of prestamosPendientes) {
          if (montoRestante <= 0) break;

          const montoAplicar = roundToTwo(
            Math.min(montoRestante, p.deudaCapital),
          );

          await tx.movimientos_prestamo.create({
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

          const totalAbonos = p.prestamo.movimientos_prestamo
            .filter((m) => m.tipo_movimiento === "ABONO")
            .reduce((sum, m) => sum + Number(m.monto), 0);

          const totalCapital = Number(p.prestamo.monto || 0);
          const saldoCapital = roundToTwo(
            totalCapital - (totalAbonos + montoAplicar),
          );

          // Verificar si el préstamo está completamente pagado
          // Necesitamos recalcular intereses también para saber si TODO está pagado
          // Pero aquí solo estamos abonando a capital.
          // La lógica completa debería verificar (Capital Pendiente + Interes Pendiente) <= 0

          // Recalcular estado del préstamo
          const movimientosActualizados =
            await tx.movimientos_prestamo.findMany({
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
            await tx.prestamos.update({
              where: { prestamoId: p.prestamo.prestamoId },
              data: { estado: "COMPLETADO" },
            });
          } else if (p.prestamo.estado === "COMPLETADO") {
            await tx.prestamos.update({
              where: { prestamoId: p.prestamo.prestamoId },
              data: { estado: "ACTIVO" },
            });
          }

          montoRestante = roundToTwo(montoRestante - montoAplicar);
        }
      }

      // === 🔹 PAGO DE INTERESES ===
      if (tipo_movimiento === "PAGO_INTERES") {
        let interesesTotales = 0;

        // Filtrar préstamos con intereses pendientes
        const prestamosConIntereses = prestamos
          .map((p) => {
            const cargos = p.movimientos_prestamo
              .filter((m) => m.tipo_movimiento === "Int-Cargo")
              .reduce((sum, m) => sum + Number(m.monto), 0);
            const pagosInteres = p.movimientos_prestamo
              .filter((m) => m.tipo_movimiento === "PAGO_INTERES")
              .reduce((sum, m) => sum + Number(m.monto), 0);

            const cargosRounded = roundToTwo(cargos);
            const pagosInteresRounded = roundToTwo(pagosInteres);
            const interesPendiente = roundToTwo(
              cargosRounded - pagosInteresRounded,
            );

            interesesTotales = roundToTwo(interesesTotales + interesPendiente);
            return { prestamo: p, interesPendiente };
          })
          .filter((p) => p.interesPendiente > 0);

        if (prestamosConIntereses.length === 0) {
          throw new Error("No hay intereses pendientes para este cliente.");
        }

        if (montoIngresado > interesesTotales) {
          throw new Error(
            `El pago de intereses (L. ${montoIngresado}) excede los intereses pendientes (L. ${interesesTotales}).`,
          );
        }

        // Aplicar PAGO_INTERES FIFO
        let montoRestante = montoIngresado;
        for (const p of prestamosConIntereses) {
          if (montoRestante <= 0) break;

          const montoAplicar = roundToTwo(
            Math.min(montoRestante, p.interesPendiente),
          );

          await tx.movimientos_prestamo.create({
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

          // Recalcular estado del préstamo tras pago de interés
          const movimientosActualizados =
            await tx.movimientos_prestamo.findMany({
              where: { prestamo_id: p.prestamoId },
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
            Number(p.monto) +
              totalCargoInteres -
              (totalAbonado + totalPagadoInteres),
          );

          if (saldoTotal <= 0) {
            await tx.prestamos.update({
              where: { prestamoId: p.prestamoId },
              data: { estado: "COMPLETADO" },
            });
          } else if (p.estado === "COMPLETADO") {
            await tx.prestamos.update({
              where: { prestamoId: p.prestamoId },
              data: { estado: "ACTIVO" },
            });
          }

          montoRestante = roundToTwo(montoRestante - montoAplicar);
        }
      }

      // === 🔹 INT-CARGO ===
      if (tipo_movimiento === "Int-Cargo") {
        const prestamosValidos = prestamos
          .filter((p) => !["ANULADO"].includes(p.estado))
          .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        if (prestamosValidos.length === 0) {
          throw new Error(
            "No hay préstamos activos para aplicar el interés cargado.",
          );
        }

        // Filtrar préstamos con deuda real (capital + intereses + cargos)
        const prestamosConDeuda = prestamosValidos
          .map((p) => {
            // Capital pendiente
            const totalAbonos = p.movimientos_prestamo
              .filter((m) => m.tipo_movimiento === "ABONO")
              .reduce((sum, m) => sum + Number(m.monto), 0);
            const capitalPendiente = roundToTwo(
              Number(p.monto) - roundToTwo(totalAbonos),
            );

            // Intereses pendientes
            const totalCargosInt = p.movimientos_prestamo
              .filter((m) => m.tipo_movimiento === "Int-Cargo")
              .reduce((sum, m) => sum + Number(m.monto), 0);
            const totalPagosInteres = p.movimientos_prestamo
              .filter((m) => m.tipo_movimiento === "PAGO_INTERES")
              .reduce((sum, m) => sum + Number(m.monto), 0);
            const interesPendiente = roundToTwo(
              roundToTwo(totalCargosInt) - roundToTwo(totalPagosInteres),
            );

            return {
              ...p,
              capitalPendiente,
              interesPendiente,
              totalCargosInt,
            };
          })
          // Solo préstamos que aún tengan capital o intereses pendientes
          .filter((p) => p.capitalPendiente > 0 || p.interesPendiente > 0);

        if (prestamosConDeuda.length === 0) {
          throw new Error(
            "Todos los préstamos de este cliente están completamente pagados. No se pueden agregar más cargos de interés.",
          );
        }

        // Tomar el primer préstamo con deuda real (FIFO)
        const p = prestamosConDeuda[0];

        await tx.movimientos_prestamo.create({
          data: {
            prestamo_id: p.prestamoId,
            fecha: fecha ? new Date(fecha) : new Date(),
            tipo_movimiento: "Int-Cargo",
            monto: montoIngresado,
            interes: interes ? parseFloat(interes) : null,
            dias: dias ? parseInt(dias) : null,
            descripcion: observacion || "Interés cargado",
          },
        });

        // Al agregar un cargo, si el préstamo estaba completado, vuelve a estar activo
        if (p.estado === "COMPLETADO") {
          await tx.prestamos.update({
            where: { prestamoId: p.prestamoId },
            data: { estado: "ACTIVO" },
          });
        }
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Movimiento registrado correctamente siguiendo FIFO.",
    });
  } catch (error) {
    if (error instanceof ErrorNegocio) return respuestaError(error);
    console.error("Error al registrar movimiento:", error);
    return NextResponse.json(
      { error: error.message || "Error interno al registrar movimiento." },
      { status: 500 },
    );
  }
}
