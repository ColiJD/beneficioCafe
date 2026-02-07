import prisma from "@/lib/prisma";
import { truncarDosDecimalesSinRedondear } from "@/lib/calculoCafe";
import { checkRole } from "@/lib/checkRole";

export async function POST(request) {
  // 🔹 Verificar rol usando el request correcto
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const {
      contratoID,
      clienteID,
      tipoCafe,
      cantidadQQ,
      precioQQ,
      totalSacos,
      descripcion,
    } = await request.json();

    // 1️⃣ Obtener contrato
    const contrato = await prisma.contratoSalida.findUnique({
      where: { contratoID: Number(contratoID) },
    });

    if (!contrato) {
      return Response.json(
        { error: "No se encontró el contrato" },
        { status: 400 }
      );
    }

    // ❌ Bloquear entrega si el contrato está anulado
    if (
      contrato.contratoMovimiento?.toUpperCase() === "ANULADO" ||
      contrato.estado?.toUpperCase() === "ANULADO"
    ) {
      return Response.json(
        {
          error: "Este contrato está ANULADO y no permite registrar entregas.",
        },
        { status: 400 }
      );
    }

    // 2️⃣ Calcular total entregado (solo detalles válidos)
    const detalle = await prisma.detalleContratoSalida.aggregate({
      _sum: { cantidadQQ: true },
      where: {
        contratoID: Number(contratoID),
        tipoMovimiento: { notIn: ["ANULADO", "Anulado", "anulado"] },
      },
    });

    const totalEntregado = parseFloat(detalle._sum?.cantidadQQ ?? "0");
    const contratoCantidadQQ = Number(contrato.contratoCantidadQQ);
    const saldoDisponible = contratoCantidadQQ - totalEntregado;

    const cantidadQQNum = truncarDosDecimalesSinRedondear(Number(cantidadQQ));
    const saldoDispNum = truncarDosDecimalesSinRedondear(saldoDisponible);

    if (cantidadQQNum > saldoDispNum) {
      return Response.json(
        {
          error: `La cantidad a entregar (${cantidadQQNum}) supera el saldo disponible (${saldoDispNum})`,
        },
        { status: 400 }
      );
    }

    // 3️⃣ Ejecutar transacción completa
    const resultado = await prisma.$transaction(async (tx) => {
      // 🔹 Deducción de Inventario (Global)
      // Se descuenta de cualquier inventario disponible hasta cubrir la cantidad
      const inventarios = await tx.inventariocliente.findMany({
        orderBy: { inventarioClienteID: "asc" },
      });

      let restanteQQ = Number(cantidadQQ);
      let totalDescontado = 0;

      for (const inv of inventarios) {
        if (restanteQQ <= 0) break;

        const cantidadDisponible = Number(inv.cantidadQQ);
        if (cantidadDisponible <= 0) continue;

        const descontarQQ = Math.min(restanteQQ, cantidadDisponible);

        // Actualizar inventario
        await tx.inventariocliente.update({
          where: { inventarioClienteID: inv.inventarioClienteID },
          data: {
            cantidadQQ: { decrement: descontarQQ },
          },
        });

        // Registrar movimiento
        await tx.movimientoinventario.create({
          data: {
            inventarioClienteID: inv.inventarioClienteID,
            tipoMovimiento: "Salida", // Salida física
            referenciaTipo: "Entrega Contrato Salida",
            referenciaID: Number(contratoID), // Enlazamos al Contrato
            cantidadQQ: descontarQQ,
            nota: `Entrega de contrato #${contratoID} (Producto del contrato: ${tipoCafe})`,
          },
        });

        restanteQQ -= descontarQQ;
        totalDescontado += descontarQQ;
      }

      if (restanteQQ > 0.009) {
        // Margen por decimales
        throw new Error(
          `Inventario global insuficiente. Faltan ${restanteQQ.toFixed(
            2
          )} QQ para cubrir la entrega.`
        );
      }

      // a) Crear detalle de entrega
      const detalleEntrega = await tx.detalleContratoSalida.create({
        data: {
          contratoID: Number(contratoID),
          cantidadQQ: Number(cantidadQQ),
          precioQQ: Number(precioQQ),
          tipoMovimiento: "Salida",
          fecha: new Date(),
          observaciones: descripcion || null,
        },
      });

      const nuevoTotalEntregado = totalEntregado + Number(cantidadQQ);
      let estadoContrato = "Pendiente";

      // b) Liquidar contrato si completado
      if (nuevoTotalEntregado >= contratoCantidadQQ) {
        await tx.contratoSalida.update({
          where: { contratoID: Number(contratoID) },
          data: { estado: "Liquidado" },
        });

        estadoContrato = "Liquidado";
      }

      return {
        saldoAntesQQ: truncarDosDecimalesSinRedondear(saldoDisponible),
        cantidadEntregadaQQ: truncarDosDecimalesSinRedondear(
          Number(cantidadQQ)
        ),
        saldoDespuesQQ: truncarDosDecimalesSinRedondear(
          contratoCantidadQQ - nuevoTotalEntregado
        ),
        estadoContrato,
        detalleEntregaID: detalleEntrega.detalleID,
        saldoDespuesLps: truncarDosDecimalesSinRedondear(
          (contratoCantidadQQ - nuevoTotalEntregado) * Number(precioQQ)
        ),
      };
    });

    return Response.json(
      {
        message: "Entrega de contrato registrada correctamente",
        ...resultado,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en POST /api/contratos/entregar:", error);
    return Response.json(
      { error: error?.message || "Error interno" },
      { status: 500 }
    );
  }
}
