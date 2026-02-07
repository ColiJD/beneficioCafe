import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { truncarDosDecimalesSinRedondear } from "@/lib/calculoCafe";

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
      // 1️⃣ Actualizar estado del registro a "Anulado"
      await tx.detalleContratoSalida.update({
        where: { detalleID },
        data: { tipoMovimiento: "Anulado" },
      });

      // 🔹 REVERSIÓN DE INVENTARIO (ANULACIÓN)
      // Devolver la cantidad al inventario. Intentamos devolverlo al producto del contrato si existe, sino al primero.
      // Como la deducción fue global, la devolución también es "flexible", pero preferimos mantener coherencia si posible.
      const productoID = registro.contratoSalida.productoID || 0; // Necesitamos incluir esto en el findUnique inicial si no está

      // Buscamos inventario preferente (mismo producto) o cualquiera
      // Nota: Para hacerlo robusto, buscamos el primer inventario disponible.
      const inventarioDestino = await tx.inventariocliente.findFirst({
        orderBy: { inventarioClienteID: "asc" }, // Devolvemos al primero que encontremos (LIFO/FIFO no aplica tanto en devolución global simplificada)
      });

      if (inventarioDestino) {
        // Devolvemos Cantidad
        await tx.inventariocliente.update({
          where: { inventarioClienteID: inventarioDestino.inventarioClienteID },
          data: {
            cantidadQQ: { increment: Number(registro.cantidadQQ) },
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
            nota: `Anulación de entrega #${detalleID}`,
          },
        });
      }

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
        { status: 404 }
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
    const { detalleID: idParam } = await params;
    const detalleID = Number(idParam);
    if (!detalleID) {
      return Response.json(
        { error: "ID de entrega inválido" },
        { status: 400 }
      );
    }

    const { contratoID, cantidadQQ, observaciones } = await request.json();

    if (!contratoID || !cantidadQQ || observaciones === undefined) {
      return Response.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    // 1️⃣ Obtener la entrega original
    const entregaOriginal = await prisma.detalleContratoSalida.findUnique({
      where: { detalleID },
    });
    if (!entregaOriginal) {
      return Response.json(
        { error: "No se encontró la entrega a modificar" },
        { status: 404 }
      );
    }

    // 2️⃣ Obtener contrato
    const contrato = await prisma.contratoSalida.findUnique({
      where: { contratoID: Number(contratoID) },
    });
    if (!contrato) {
      return Response.json(
        { error: "No se encontró el contrato asociado" },
        { status: 400 }
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
        { status: 403 }
      );
    }

    // 3️⃣ Calcular Saldo y Validar
    // (Omitimos logica redundante de saldo si confiamos en la validacion de abajo, pero por seguridad la dejamos)
    const detalle = await prisma.detalleContratoSalida.aggregate({
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

    const cantidadNueva = truncarDosDecimalesSinRedondear(Number(cantidadQQ));
    const saldoVisible = truncarDosDecimalesSinRedondear(saldoDisponible);

    // Nota: saldoDisponible incluye la cantidad "liberada" de esta entrega porque la excluímos en el where
    // Comentado para permitir edición flexible si hay inventario
    /* if (cantidadNueva > saldoVisible) {
      return Response.json(
        {
          error: `La cantidad actualizada (${cantidadNueva}) supera el saldo disponible (${saldoVisible}).`,
        },
        { status: 400 }
      );
    } */

    // 🔹 Nueva Validación: Verificar Si hay Inventario Físico suficiente para el INCREMENTO
    const cantidadAnterior = Number(entregaOriginal.cantidadQQ);
    const diferencia = truncarDosDecimalesSinRedondear(
      cantidadNueva - cantidadAnterior
    );

    if (diferencia > 0) {
      const stockActualResult = await prisma.inventariocliente.aggregate({
        _sum: { cantidadQQ: true },
      });
      const stockActual = Number(stockActualResult._sum.cantidadQQ || 0);

      if (diferencia > stockActual) {
        return Response.json(
          {
            error: `Inventario insuficiente para cubrir el incremento. Incremento: ${diferencia}, Stock Global: ${truncarDosDecimalesSinRedondear(
              stockActual
            )}`,
          },
          { status: 400 }
        );
      }
    }

    // 4️⃣ Transacción para actualizar entrega e inventario
    const resultado = await prisma.$transaction(async (tx) => {
      const cantidadAnterior = Number(entregaOriginal.cantidadQQ);
      const diferencia = cantidadNueva - cantidadAnterior;

      if (diferencia !== 0) {
        if (diferencia > 0) {
          // 🔹 Aumentó la entrega -> Debemos descontar más inventario
          const inventarios = await tx.inventariocliente.findMany({
            orderBy: { inventarioClienteID: "asc" },
          });

          let restantePorDescontar = diferencia;

          for (const inv of inventarios) {
            if (restantePorDescontar <= 0) break;
            const disp = Number(inv.cantidadQQ);
            if (disp <= 0) continue;

            const desc = Math.min(restantePorDescontar, disp);
            await tx.inventariocliente.update({
              where: { inventarioClienteID: inv.inventarioClienteID },
              data: { cantidadQQ: { decrement: desc } },
            });
            await tx.movimientoinventario.create({
              data: {
                inventarioClienteID: inv.inventarioClienteID,
                tipoMovimiento: "Salida",
                referenciaTipo: "Edición Entrega Contrato (Inc)",
                referenciaID: Number(contratoID),
                cantidadQQ: desc,
                nota: `Ajuste positivo por edición de entrega #${detalleID}`,
              },
            });
            restantePorDescontar -= desc;
          }

          if (restantePorDescontar > 0.009) {
            throw new Error(
              `Inventario global insuficiente para cubrir el incremento.`
            );
          }
        } else {
          // 🔹 Disminuyó la entrega (diferencia negativa) -> Devolver inventario
          const devolverQQ = Math.abs(diferencia);

          // Devolvemos al primer inventario (simplificación global)
          const inventarioDestino = await tx.inventariocliente.findFirst({
            orderBy: { inventarioClienteID: "asc" },
          });

          if (inventarioDestino) {
            await tx.inventariocliente.update({
              where: {
                inventarioClienteID: inventarioDestino.inventarioClienteID,
              },
              data: { cantidadQQ: { increment: devolverQQ } },
            });
            await tx.movimientoinventario.create({
              data: {
                inventarioClienteID: inventarioDestino.inventarioClienteID,
                tipoMovimiento: "Entrada",
                referenciaTipo: "Edición Entrega Contrato (Dec)",
                referenciaID: Number(contratoID),
                cantidadQQ: devolverQQ,
                nota: `Ajuste negativo por edición de entrega #${detalleID}`,
              },
            });
          }
        }
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
          where: { contratoID },
          data: { estado: "Liquidado" },
        });
      } else {
        // Asegurar que si bajó la cantidad, se quite "Liquidado" si estaba
        await tx.contratoSalida.update({
          where: { contratoID },
          data: { estado: "Pendiente" },
        });
      }

      return {
        message: "Entrega actualizada y inventario ajustado correctamente",
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
