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
    const contrato = await prisma.contrato.findUnique({
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
    const detalle = await prisma.detallecontrato.aggregate({
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
      // a) Crear detalle de entrega
      const detalleEntrega = await tx.detallecontrato.create({
        data: {
          contratoID: Number(contratoID),
          cantidadQQ: Number(cantidadQQ),
          precioQQ: Number(precioQQ),
          tipoMovimiento: "Entrada",
          fecha: new Date(),
          observaciones: descripcion || null,
        },
      });

      const nuevoTotalEntregado = totalEntregado + Number(cantidadQQ);
      let estadoContrato = "Pendiente";

      // b) Liquidar contrato si completado
      if (nuevoTotalEntregado >= contratoCantidadQQ) {
        await tx.contrato.update({
          where: { contratoID: Number(contratoID) },
          data: { estado: "Liquidado" },
        });

        estadoContrato = "Liquidado";

        // c) Registrar cierre contrato
        await tx.cierrecontrato.create({
          data: {
            contratoID: Number(contratoID),
            totalEntregadoQQ: nuevoTotalEntregado,
            totalLps: nuevoTotalEntregado * Number(precioQQ),
            tipoMovimiento: "Entrada",
            observaciones: "Contrato completado",
          },
        });
      }

      // d) Actualizar inventario del cliente
      const inventarioCliente = await tx.inventariocliente.upsert({
        where: {
          clienteID_productoID: {
            clienteID: Number(clienteID),
            productoID: Number(tipoCafe),
          },
        },
        update: {
          cantidadQQ: { increment: Number(cantidadQQ) },
          cantidadSacos: { increment: Number(totalSacos) },
        },
        create: {
          clienteID: Number(clienteID),
          productoID: Number(tipoCafe),
          cantidadQQ: Number(cantidadQQ),
          cantidadSacos: Number(totalSacos),
        },
      });

      // e) Registrar movimiento de inventario
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: inventarioCliente.inventarioClienteID,
          tipoMovimiento: "Entrada",
          referenciaTipo: `EntregaContrato #${detalleEntrega.detalleID}`,
          referenciaID: detalleEntrega.detalleID,
          cantidadQQ: Number(cantidadQQ),
          cantidadSacos: Number(totalSacos),
          nota: "Entrada de café por entrega de contrato",
        },
      });

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
