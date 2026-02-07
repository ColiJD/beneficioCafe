import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function DELETE(req, { params }) {
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const detalleID = Number(params.detalleID);
    if (!detalleID) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    // 🔹 Buscar el registro (puede ser compra o venta)
    const registro = await prisma.detallecontrato.findUnique({
      where: { detalleID },
    });
    if (!registro) {
      return new Response(JSON.stringify({ error: "Registro no encontrado" }), {
        status: 404,
      });
    }

    // 🔹 Buscar el movimiento asociado
    const movimiento = await prisma.movimientoinventario.findFirst({
      where: {
        referenciaTipo: { contains: `EntregaContrato #${detalleID}` },
        NOT: { tipoMovimiento: "Anulado" },
      },
    });

    if (!movimiento) {
      return new Response(
        JSON.stringify({ error: "Movimiento de inventario no encontrado" }),
        { status: 404 }
      );
    }

    // 🔹 Determinar tipo de movimiento (Entrada o Salida)
    const esEntrada = movimiento.tipoMovimiento === "Entrada";
    const esSalida = movimiento.tipoMovimiento === "Salida";

    if (!esEntrada && !esSalida) {
      return new Response(
        JSON.stringify({
          error: "El movimiento ya fue anulado)",
        }),
        { status: 400 }
      );
    }

    // 🔹 Ejecutar la lógica correspondiente en una transacción
    await prisma.$transaction([
      // 1️⃣ Actualizar movimiento
      prisma.movimientoinventario.update({
        where: { movimientoID: movimiento.movimientoID },
        data: {
          tipoMovimiento: "Anulado",
          nota: `${
            esEntrada ? "EntregaContrato" : "Contrato"
          } anulada #${detalleID}`,
        },
      }),

      // 2️⃣ Ajustar inventario (según tipo)
      prisma.inventariocliente.update({
        where: { inventarioClienteID: movimiento.inventarioClienteID },
        data: esEntrada
          ? {
              // Si era Entrada, ahora restamos
              cantidadQQ: { decrement: movimiento.cantidadQQ },
            }
          : {
              // Si era Salida, ahora sumamos
              cantidadQQ: { increment: movimiento.cantidadQQ },
            },
      }),

      // 3️⃣ Actualizar estado del registro (compra/venta)
      prisma.detallecontrato.update({
        where: { detalleID },
        data: { tipoMovimiento: "Anulado" },
      }),
    ]);

    return new Response(
      JSON.stringify({
        message: `${esEntrada ? "Entrega" : "Contrato"} anulada correctamente`,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error al anular registro:", error);
    return new Response(
      JSON.stringify({ error: "Error interno al anular el registro" }),
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

export async function GET(req, context) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
  ]);

  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { detalleID } = await context.params;

    const detalle = await prisma.detallecontrato.findUnique({
      where: { detalleID: parseInt(detalleID) },
      include: {
        contrato: {
          include: {
            cliente: {
              select: {
                clienteID: true,
                clienteNombre: true,
                clienteApellido: true,
              },
            },
            producto: {
              select: {
                productID: true,
                productName: true,
              },
            },
          },
        },
      },
    });

    if (!detalle) {
      return NextResponse.json(
        { error: "Detalle no encontrado" },
        { status: 404 }
      );
    }

    // Estructura plana para el frontend
    const response = {
      detalleID: detalle.detalleID,
      cantidadQQ: detalle.cantidadQQ,
      precioQQ: detalle.precioQQ,
      observaciones: detalle.observaciones,
      contratoID: detalle.contrato.contratoID,
      contratoTipoCafe: detalle.contrato.contratoTipoCafe,
      cliente:
        detalle.contrato.cliente.clienteNombre +
          " " +
          detalle.contrato.cliente.clienteApellido || null,
      producto: detalle.contrato.producto || null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "Error en GET /api/contratos/detallecontrato/[detalleID]:",
      error
    );
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const detalleID = Number(params.detalleID);
    if (!detalleID) {
      return Response.json(
        { error: "ID de entrega inválido" },
        { status: 400 }
      );
    }

    const { contratoID, cantidadQQ, observaciones } = await request.json();
    console.log("Datos recibidos:", {
      detalleID,
      contratoID,
      cantidadQQ,
      observaciones,
    });

    if (!contratoID || !cantidadQQ || observaciones === undefined) {
      return Response.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    // 1️⃣ Obtener la entrega original
    const entregaOriginal = await prisma.detallecontrato.findUnique({
      where: { detalleID },
    });
    if (!entregaOriginal) {
      return Response.json(
        { error: "No se encontró la entrega a modificar" },
        { status: 404 }
      );
    }

    // 2️⃣ Obtener contrato y datos del cliente/producto
    const contrato = await prisma.contrato.findUnique({
      where: { contratoID: Number(contratoID) },
    });
    if (!contrato) {
      return Response.json(
        { error: "No se encontró el contrato asociado" },
        { status: 400 }
      );
    }
    const clienteID = contrato.contratoclienteID;
    const tipoCafe = contrato.contratoTipoCafe;

    if (
      contrato.estado?.toUpperCase() === "ANULADO" ||
      contrato.contratoMovimiento?.toUpperCase() === "ANULADO"
    ) {
      return Response.json(
        {
          error: "El contrato está ANULADO y no se pueden modificar entregas.",
        },
        { status: 403 }
      );
    }

    // 3️⃣ Calcular saldo disponible
    const detalle = await prisma.detallecontrato.aggregate({
      _sum: { cantidadQQ: true },
      where: {
        contratoID: Number(contratoID),
        detalleID: { not: detalleID },
        tipoMovimiento: { notIn: ["ANULADO", "anulado", "Anulado"] },
      },
    });
    const totalEntregado = parseFloat(detalle._sum?.cantidadQQ ?? "0");
    const contratoCantidadQQ = Number(contrato.contratoCantidadQQ);
    const saldoDisponible = contratoCantidadQQ - totalEntregado;

    const cantidadNueva = Number(cantidadQQ);
    if (cantidadNueva > saldoDisponible) {
      return Response.json(
        {
          error: `La cantidad actualizada (${cantidadNueva}) supera el saldo disponible (${saldoDisponible}).`,
        },
        { status: 400 }
      );
    }

    // 4️⃣ Transacción para actualizar entrega e inventario
    const resultado = await prisma.$transaction(async (tx) => {
      // a) Actualizar detalle
      const entregaActualizada = await tx.detallecontrato.update({
        where: { detalleID },
        data: {
          cantidadQQ: cantidadNueva,
          observaciones: observaciones || null,
          fecha: new Date(),
        },
      });

      // b) Ajustar inventario
      const diferenciaQQ = cantidadNueva - Number(entregaOriginal.cantidadQQ);
      const inventarioCliente = await tx.inventariocliente.upsert({
        where: {
          clienteID_productoID: {
            clienteID: Number(clienteID),
            productoID: Number(tipoCafe),
          },
        },
        update: { cantidadQQ: { increment: diferenciaQQ } },
        create: {
          clienteID: Number(clienteID),
          productoID: Number(tipoCafe),
          cantidadQQ: cantidadNueva,
        },
      });

      // c) Registrar movimiento de inventario
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: inventarioCliente.inventarioClienteID,
          tipoMovimiento: "Ajuste",
          referenciaTipo: `EntregaContrato #${detalleID}`,
          referenciaID: detalleID,
          cantidadQQ: diferenciaQQ,
          nota: "Ajuste por modificación de entrega",
        },
      });

      // d) Validar si contrato queda liquidado
      const nuevoTotalEntregado = totalEntregado + cantidadNueva;
      let estadoContrato = "Pendiente";
      if (nuevoTotalEntregado >= contratoCantidadQQ) {
        estadoContrato = "Liquidado";
        await tx.contrato.update({
          where: { contratoID },
          data: { estado: "Liquidado" },
        });
      }

      return {
        message: "Entrega actualizada correctamente",
        entregaActualizada,
        estadoContrato,
        saldoRestante: contratoCantidadQQ - nuevoTotalEntregado,
      };
    });

    return Response.json(resultado, { status: 200 });
  } catch (error) {
    console.error("Error en PUT /api/contratos/entregar:", error);
    return Response.json(
      { error: error?.message || "Error al actualizar entrega" },
      { status: 500 }
    );
  }
}
