import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { truncarDosDecimalesSinRedondear } from "@/lib/calculoCafe";
import { ErrorNegocio, bloquearContrato, esAnulado, noAnulado, moverInventario, respuestaError, TX_ESPERA } from "@/lib/inventarioMov";

export async function DELETE(req, { params }) {
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { detalleID: idParam } = await params;
    const detalleID = Number(idParam);
    if (!detalleID) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    // 🔹 Buscar el registro
    const registro = await prisma.detalleContratoSalida.findUnique({
      where: { detalleID },
      include: { contratoSalida: true },
    });
    if (!registro) {
      return new Response(JSON.stringify({ error: "Registro no encontrado" }), {
        status: 404,
      });
    }

    await prisma.$transaction(async (tx) => {
      // 1️⃣ Anular de forma atómica: si ya estaba anulada no se devuelve stock otra vez
      const anulada = await tx.detalleContratoSalida.updateMany({
        where: { detalleID, ...noAnulado("tipoMovimiento") },
        data: { tipoMovimiento: "Anulado" },
      });
      if (anulada.count === 0) throw new ErrorNegocio("La entrega ya está anulada");

      // 🔹 REVERSIÓN DE INVENTARIO (ANULACIÓN GLOBAL)
      // Devolver la cantidad al inventario global del producto del contrato.
      const productoID = registro.contratoSalida.contratoTipoCafe;

      // Buscamos o creamos el inventario global para este producto
      const inventarioDestino = await tx.inventariocliente.upsert({
        where: { productoID },
        update: {
          cantidadQQ: { increment: Number(registro.cantidadQQ) },
        },
        create: {
          productoID,
          cantidadQQ: Number(registro.cantidadQQ),
          cantidadSacos: 0,
        },
      });

      // Registrar Movimiento de Reversión
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: inventarioDestino.inventarioClienteID,
          tipoMovimiento: "Entrada", // Reingreso
          referenciaTipo: "Anulación Entrega Contrato",
          referenciaID: registro.contratoID,
          cantidadQQ: Number(registro.cantidadQQ),
          nota: `Anulación de entrega #${detalleID} (Producto: ${productoID})`,
        },
      });

      // 2️⃣ Verificar si el contrato debe volver a "Pendiente"
      const contratoID = registro.contratoID;
      const contrato = await tx.contratoSalida.findUnique({
        where: { contratoID },
      });

      if (contrato) {
        const agregado = await tx.detalleContratoSalida.aggregate({
          _sum: { cantidadQQ: true },
          where: {
            contratoID,
            tipoMovimiento: { notIn: ["ANULADO", "Anulado", "anulado"] },
          },
        });

        const totalEntregado = Number(agregado._sum.cantidadQQ || 0);
        const totalContrato = Number(contrato.contratoCantidadQQ || 0);

        if (totalEntregado < totalContrato) {
          await tx.contratoSalida.update({
            where: { contratoID },
            data: { estado: "Pendiente" },
          });
        }
      }
    });

    return new Response(
      JSON.stringify({
        message: "Entrega anulada correctamente y stock revertido.",
      }),
      { status: 200 },
    );
  } catch (error) {
    return respuestaError(error, "Error interno al anular el registro");
  }
}

import { NextResponse } from "next/server";

export async function GET(req, context) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
  ]);

  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { detalleID } = await context.params;

    const detalle = await prisma.detalleContratoSalida.findUnique({
      where: { detalleID: parseInt(detalleID) },
      include: {
        contratoSalida: {
          include: {
            compradores: {
              select: {
                compradorId: true,
                compradorNombre: true,
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
        { status: 404 },
      );
    }

    // Estructura plana para el frontend
    const response = {
      detalleID: detalle.detalleID,
      cantidadQQ: detalle.cantidadQQ,
      precioQQ: detalle.precioQQ,
      observaciones: detalle.observaciones,
      contratoID: detalle.contratoSalida.contratoID,
      contratoTipoCafe: detalle.contratoSalida.contratoTipoCafe,
      cliente: detalle.contratoSalida.compradores.compradorNombre || null,
      producto: detalle.contratoSalida.producto || null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "Error en GET /api/contratoSalida/detallecontrato/[detalleID]:",
      error,
    );
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { detalleID: idParam } = await params;
    const detalleID = Number(idParam);
    if (!detalleID) {
      return Response.json(
        { error: "ID de entrega inválido" },
        { status: 400 },
      );
    }

    const { contratoID, cantidadQQ, observaciones } = await request.json();

    if (!contratoID || !cantidadQQ || observaciones === undefined) {
      return Response.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 },
      );
    }

    // 1️⃣ Obtener la entrega original
    const entregaOriginal = await prisma.detalleContratoSalida.findUnique({
      where: { detalleID },
    });
    if (!entregaOriginal) {
      return Response.json(
        { error: "No se encontró la entrega a modificar" },
        { status: 404 },
      );
    }

    if (esAnulado(entregaOriginal.tipoMovimiento)) {
      return Response.json(
        { error: "No se puede modificar una entrega anulada" },
        { status: 400 },
      );
    }

    // 2️⃣ Obtener contrato: el de la entrega, no el que mande el cliente
    const idContrato = entregaOriginal.contratoID;
    const contrato = await prisma.contratoSalida.findUnique({
      where: { contratoID: idContrato },
    });
    if (!contrato) {
      return Response.json(
        { error: "No se encontró el contrato asociado" },
        { status: 400 },
      );
    }

    if (
      contrato.estado?.toUpperCase() === "ANULADO" ||
      contrato.contratoMovimiento?.toUpperCase() === "ANULADO"
    ) {
      return Response.json(
        {
          error: "El contrato está ANULADO y no se pueden modificar entregas.",
        },
        { status: 403 },
      );
    }

    const contratoCantidadQQ = Number(contrato.contratoCantidadQQ);
    const cantidadNueva = truncarDosDecimalesSinRedondear(Number(cantidadQQ));

    // 3️⃣ Transacción. Con el contrato bloqueado se recalcula todo: dos ediciones o entregas simultáneas
    // del mismo contrato se atienden una tras otra y la segunda ve lo que ya hizo la primera.
    const resultado = await prisma.$transaction(async (tx) => {
      const totalEntregado = await bloquearContrato(tx, "contratoSalida", idContrato, detalleID);

      // Se vuelve a leer la entrega: otra edición pudo cambiarla o anularla mientras tanto.
      const entrega = await tx.detalleContratoSalida.findUnique({ where: { detalleID } });
      if (esAnulado(entrega.tipoMovimiento))
        throw new ErrorNegocio("No se puede modificar una entrega anulada");

      // El saldo excluye esta entrega, así que incluye lo que se "libera" al editarla
      const saldoVisible = truncarDosDecimalesSinRedondear(contratoCantidadQQ - totalEntregado);
      if (cantidadNueva > saldoVisible)
        throw new ErrorNegocio(
          `La cantidad actualizada (${cantidadNueva}) supera el saldo disponible (${saldoVisible}).`,
        );

      const diferencia = truncarDosDecimalesSinRedondear(cantidadNueva - Number(entrega.cantidadQQ));

      if (diferencia !== 0) {
        // Más entrega = resta (solo si el inventario alcanza); menos entrega = devuelve
        const inventario = await moverInventario(tx, contrato.contratoTipoCafe, -diferencia);

        await tx.movimientoinventario.create({
          data: {
            inventarioClienteID: inventario.inventarioClienteID,
            tipoMovimiento: diferencia > 0 ? "Salida" : "Entrada",
            referenciaTipo: `Edición Entrega Contrato (${
              diferencia > 0 ? "Inc" : "Dec"
            })`,
            referenciaID: idContrato,
            cantidadQQ: Math.abs(diferencia),
            nota: `Ajuste por edición de entrega #${detalleID} (Producto: ${contrato.contratoTipoCafe})`,
          },
        });
      }

      // a) Actualizar detalle
      const entregaActualizada = await tx.detalleContratoSalida.update({
        where: { detalleID },
        data: {
          cantidadQQ: cantidadNueva,
          observaciones: observaciones || null,
          fecha: new Date(),
        },
      });

      // b) Validar si contrato queda liquidado
      const nuevoTotalEntregado = totalEntregado + cantidadNueva;
      let estadoContrato = "Pendiente";
      if (nuevoTotalEntregado >= contratoCantidadQQ) {
        estadoContrato = "Liquidado";
        await tx.contratoSalida.update({
          where: { contratoID: idContrato },
          data: { estado: "Liquidado" },
        });
      } else {
        // Asegurar que si bajó la cantidad, se quite "Liquidado" si estaba
        await tx.contratoSalida.update({
          where: { contratoID: idContrato },
          data: { estado: "Pendiente" },
        });
      }

      return {
        message: "Entrega actualizada y inventario ajustado correctamente",
        entregaActualizada,
        estadoContrato,
        saldoRestante: contratoCantidadQQ - nuevoTotalEntregado,
      };
    }, TX_ESPERA);

    return Response.json(resultado, { status: 200 });
  } catch (error) {
    return respuestaError(error, "Error al actualizar entrega");
  }
}
