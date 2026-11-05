import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { NextResponse } from "next/server";
import {
  ErrorNegocio,
  esAnulado,
  moverInventario,
  movimientoOriginal,
  noAnulado,
  redondear,
  respuestaError,
} from "@/lib/inventarioMov";

export async function DELETE(req, { params }) {
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const detalleID = Number((await params).detalleID);
    if (!detalleID) {
      return Response.json({ error: "ID inválido" }, { status: 400 });
    }

    const esEntrada = await prisma.$transaction(async (tx) => {
      const registro = await tx.detallecontrato.findUnique({
        where: { detalleID },
        include: { contrato: { select: { contratoTipoCafe: true } } },
      });
      if (!registro) throw new ErrorNegocio("Registro no encontrado", 404);
      if (esAnulado(registro.tipoMovimiento)) throw new ErrorNegocio("La entrega ya está anulada");

      const ref = `EntregaContrato #${detalleID}`;
      const movimiento = await movimientoOriginal(tx, [ref]);
      if (!movimiento) throw new ErrorNegocio("Movimiento de inventario no encontrado", 404);

      // Las modificaciones de la entrega dejaron movimientos "Ajuste": se anulan junto al original
      const ajustes = await tx.movimientoinventario.findMany({
        where: { referenciaTipo: ref, tipoMovimiento: "Ajuste" },
      });
      const entrada = movimiento.tipoMovimiento === "Entrada";
      const total = redondear(
        Number(movimiento.cantidadQQ) + ajustes.reduce((a, m) => a + Number(m.cantidadQQ), 0),
      );

      // Anular una entrada resta del inventario; anular una salida lo devuelve
      await moverInventario(tx, registro.contrato.contratoTipoCafe, entrada ? -total : total);

      await tx.movimientoinventario.updateMany({
        where: { movimientoID: { in: [movimiento.movimientoID, ...ajustes.map((a) => a.movimientoID)] } },
        data: {
          tipoMovimiento: "Anulado",
          nota: `${entrada ? "EntregaContrato" : "Contrato"} anulada #${detalleID}`,
        },
      });
      await tx.detallecontrato.update({ where: { detalleID }, data: { tipoMovimiento: "Anulado" } });

      // Si el contrato estaba Liquidado y con esta anulación vuelve a tener saldo, queda Pendiente
      const contrato = await tx.contrato.findUnique({ where: { contratoID: registro.contratoID } });
      if (contrato && contrato.estado === "Liquidado") {
        const agregado = await tx.detallecontrato.aggregate({
          _sum: { cantidadQQ: true },
          where: { contratoID: registro.contratoID, ...noAnulado("tipoMovimiento") },
        });
        if (Number(agregado._sum.cantidadQQ ?? 0) < Number(contrato.contratoCantidadQQ)) {
          await tx.contrato.update({ where: { contratoID: registro.contratoID }, data: { estado: "Pendiente" } });
        }
      }
      return entrada;
    });

    return Response.json({ message: `${esEntrada ? "Entrega" : "Contrato"} anulada correctamente` });
  } catch (error) {
    return respuestaError(error, "Error interno al anular el registro");
  }
}

export async function GET(req, context) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
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
        { status: 404 },
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
    const detalleID = Number((await params).detalleID);
    if (!detalleID) {
      return Response.json({ error: "ID de entrega inválido" }, { status: 400 });
    }

    const { contratoID, cantidadQQ, observaciones } = await request.json();
    const cantidadNueva = Number(cantidadQQ);

    if (!contratoID || !(cantidadNueva > 0) || observaciones === undefined) {
      return Response.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const entregaOriginal = await tx.detallecontrato.findUnique({ where: { detalleID } });
      if (!entregaOriginal) throw new ErrorNegocio("No se encontró la entrega a modificar", 404);
      if (esAnulado(entregaOriginal.tipoMovimiento)) {
        throw new ErrorNegocio("No se puede modificar una entrega anulada");
      }

      const contrato = await tx.contrato.findUnique({ where: { contratoID: Number(contratoID) } });
      if (!contrato) throw new ErrorNegocio("No se encontró el contrato asociado");
      if (esAnulado(contrato.estado) || esAnulado(contrato.contratoMovimiento)) {
        throw new ErrorNegocio("El contrato está ANULADO y no se pueden modificar entregas.", 403);
      }

      // Saldo disponible del contrato (sin contar esta entrega)
      const detalle = await tx.detallecontrato.aggregate({
        _sum: { cantidadQQ: true },
        where: {
          contratoID: Number(contratoID),
          detalleID: { not: detalleID },
          ...noAnulado("tipoMovimiento"),
        },
      });
      const totalEntregado = parseFloat(detalle._sum?.cantidadQQ ?? "0");
      const contratoCantidadQQ = Number(contrato.contratoCantidadQQ);
      const saldoDisponible = contratoCantidadQQ - totalEntregado;

      if (cantidadNueva > saldoDisponible) {
        throw new ErrorNegocio(
          `La cantidad actualizada (${cantidadNueva}) supera el saldo disponible (${saldoDisponible}).`,
        );
      }

      const entregaActualizada = await tx.detallecontrato.update({
        where: { detalleID },
        data: { cantidadQQ: cantidadNueva, observaciones: observaciones || null, fecha: new Date() },
      });

      const diferenciaQQ = redondear(cantidadNueva - Number(entregaOriginal.cantidadQQ));
      const inventarioCliente = await moverInventario(tx, contrato.contratoTipoCafe, diferenciaQQ);

      if (diferenciaQQ !== 0) {
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
      }

      const nuevoTotalEntregado = totalEntregado + cantidadNueva;
      // Liquidado si se completó el contrato; Pendiente si al bajar la cantidad vuelve a tener saldo
      const estadoContrato = nuevoTotalEntregado >= contratoCantidadQQ ? "Liquidado" : "Pendiente";
      await tx.contrato.update({
        where: { contratoID: Number(contratoID) },
        data: { estado: estadoContrato },
      });

      return {
        message: "Entrega actualizada correctamente",
        entregaActualizada,
        estadoContrato,
        saldoRestante: contratoCantidadQQ - nuevoTotalEntregado,
      };
    });

    return Response.json(resultado);
  } catch (error) {
    return respuestaError(error, "Error al actualizar entrega");
  }
}
