import prisma from "@/lib/prisma";
import { truncarDosDecimalesSinRedondear } from "@/lib/calculoCafe";
import { checkRole } from "@/lib/checkRole";
import { moverInventario, respuestaError } from "@/lib/inventarioMov";

export async function POST(request) {
  // 🔹 Verificar rol usando el request correcto
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
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
        { status: 400 },
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
        { status: 400 },
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
        { status: 400 },
      );
    }

    // 3️⃣ Ejecutar transacción completa
    const resultado = await prisma.$transaction(async (tx) => {
      // 🔹 Deducción de Inventario (Global por Producto)
      // Buscamos el registro de inventario específico para el tipo de café del contrato
      // Resta solo si el saldo alcanza en ese momento (otra transacción pudo entrar en paralelo)
      const inventario = await moverInventario(
        tx,
        contrato.contratoTipoCafe || tipoCafe,
        -Number(cantidadQQ),
      );

      // Registrar movimiento de inventario
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: inventario.inventarioClienteID,
          tipoMovimiento: "Salida", // Salida física
          referenciaTipo: "Entrega Contrato Salida",
          referenciaID: Number(contratoID), // Enlazamos al Contrato
          cantidadQQ: Number(cantidadQQ),
          nota: `Entrega de contrato #${contratoID} (Producto: ${
            contrato.contratoTipoCafe || tipoCafe
          })`,
        },
      });

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
          Number(cantidadQQ),
        ),
        saldoDespuesQQ: truncarDosDecimalesSinRedondear(
          contratoCantidadQQ - nuevoTotalEntregado,
        ),
        estadoContrato,
        detalleEntregaID: detalleEntrega.detalleID,
        saldoDespuesLps: truncarDosDecimalesSinRedondear(
          (contratoCantidadQQ - nuevoTotalEntregado) * Number(precioQQ),
        ),
      };
    });

    return Response.json(
      {
        message: "Entrega de contrato registrada correctamente",
        ...resultado,
      },
      { status: 201 },
    );
  } catch (error) {
    return respuestaError(error, "Error al registrar la entrega");
  }
}
