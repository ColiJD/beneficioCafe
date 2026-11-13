import prisma from "@/lib/prisma";
import { checkRole, moduloDeCompra } from "@/lib/checkRole";
import { NextResponse } from "next/server";
import { validarFlete } from "@/lib/flete";
import {
  ErrorNegocio,
  esAnulado,
  moverInventario,
  movimientoOriginal,
  respuestaError,
} from "@/lib/inventarioMov";

const refs = (id) => [`Compra directa #${id}`, `Venta directa #${id}`];

export async function DELETE(req, { params }) {
  const compraId = Number((await params).id);
  const sessionOrResponse = await checkRole(req, [], compraId ? await moduloDeCompra(compraId) : undefined);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  if (!compraId) return Response.json({ error: "ID inválido" }, { status: 400 });

  try {
    const esEntrada = await prisma.$transaction(async (tx) => {
      const registro = await tx.compra.findUnique({ where: { compraId } });
      if (!registro) throw new ErrorNegocio("Registro no encontrado", 404);
      if (esAnulado(registro.compraMovimiento)) throw new ErrorNegocio("El registro ya está anulado");

      const movimiento = await movimientoOriginal(tx, refs(compraId));
      if (!movimiento) throw new ErrorNegocio("Movimiento de inventario no encontrado", 404);

      const entrada = movimiento.tipoMovimiento === "Entrada";
      const signo = entrada ? -1 : 1; // anular una compra resta, anular una venta devuelve
      await moverInventario(
        tx,
        registro.compraTipoCafe,
        signo * Number(movimiento.cantidadQQ),
        signo * Number(movimiento.cantidadSacos || 0),
      );

      await tx.movimientoinventario.update({
        where: { movimientoID: movimiento.movimientoID },
        data: { tipoMovimiento: "Anulado", nota: `${entrada ? "Compra" : "Venta"} anulada #${compraId}` },
      });
      await tx.compra.update({ where: { compraId }, data: { compraMovimiento: "Anulado" } });
      return entrada;
    });

    return Response.json({ message: `${esEntrada ? "Compra" : "Venta"} anulada correctamente` });
  } catch (error) {
    return respuestaError(error, "Error interno al anular el registro");
  }
}

export async function PUT(request, { params }) {
  const compraId = Number((await params).id);
  const sessionOrResponse = await checkRole(request, [], compraId ? await moduloDeCompra(compraId) : undefined);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  if (!compraId) return Response.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await request.json();
    const {
      clienteID,
      compraTipoDocumento,
      compraTipoCafe,
      compraPrecioQQ,
      compraCantidadQQ,
      compraTotal,
      compraTotalSacos,
      compraRetencio,
      compraFlete,
      compraDescripcion,
      compraEn,
    } = body;

    const cantidadQQNueva = parseFloat(compraCantidadQQ);
    const cantidadSacosNueva = parseFloat(compraTotalSacos);

    if (!clienteID || !compraTipoCafe || !compraPrecioQQ || !(cantidadQQNueva > 0) || !cantidadSacosNueva) {
      return Response.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    // Solo las compras llevan flete (las ventas que usan esta ruta no lo envían y no se tocan)
    const flete = compraFlete === undefined ? undefined : validarFlete(compraFlete, compraTotal);

    const updated = await prisma.$transaction(async (tx) => {
      const compraExistente = await tx.compra.findUnique({ where: { compraId } });
      if (!compraExistente) throw new ErrorNegocio("Compra no encontrada", 404);
      if (esAnulado(compraExistente.compraMovimiento)) {
        throw new ErrorNegocio("No se puede modificar un registro anulado");
      }

      const qqAnterior = parseFloat(compraExistente.compraCantidadQQ);
      const sacosAnterior = parseFloat(compraExistente.compraTotalSacos);
      const signo = compraExistente.compraMovimiento === "Salida" ? -1 : 1; // Entrada suma, Salida resta
      const productoNuevo = Number(compraTipoCafe);
      const productoAnterior = Number(compraExistente.compraTipoCafe);

      const compraActualizada = await tx.compra.update({
        where: { compraId },
        data: {
          clienteID: Number(clienteID),
          compraTipoDocumento,
          compraTipoCafe: productoNuevo,
          compraPrecioQQ: parseFloat(compraPrecioQQ),
          compraCantidadQQ: cantidadQQNueva,
          compraTotal: parseFloat(compraTotal),
          compraTotalSacos: cantidadSacosNueva,
          compraRetencio: compraRetencio ? parseFloat(compraRetencio) : 0,
          ...(flete !== undefined && { compraFlete: flete }),
          compraEn,
          compraDescripcion: compraDescripcion || "",
        },
      });

      // Inventario: mismo producto = diferencia; otro producto = revertir el anterior y aplicar el nuevo
      let inventario;
      if (productoNuevo === productoAnterior) {
        inventario = await moverInventario(
          tx,
          productoNuevo,
          signo * (cantidadQQNueva - qqAnterior),
          signo * (cantidadSacosNueva - sacosAnterior),
        );
      } else {
        await moverInventario(tx, productoAnterior, -signo * qqAnterior, -signo * sacosAnterior);
        inventario = await moverInventario(tx, productoNuevo, signo * cantidadQQNueva, signo * cantidadSacosNueva);
      }

      const movimiento = await movimientoOriginal(tx, refs(compraId));
      if (movimiento) {
        await tx.movimientoinventario.update({
          where: { movimientoID: movimiento.movimientoID },
          data: {
            inventarioClienteID: inventario.inventarioClienteID,
            cantidadQQ: cantidadQQNueva,
            cantidadSacos: cantidadSacosNueva,
            nota: "Compra actualizada",
          },
        });
      }

      return compraActualizada;
    });

    return Response.json(updated);
  } catch (error) {
    return respuestaError(error, "Error al actualizar compra");
  }
}

export async function GET(req, context) {
  const id = (await context.params).id;
  const sessionOrResponse = await checkRole(req, [], await moduloDeCompra(id));
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const compra = await prisma.compra.findUnique({
      where: { compraId: parseInt(id) },
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
            productName: true, // ✅ nombre correcto
            tara: true,
            descuento: true,
            factorOro: true,
          },
        },
        compradores: {
          select: {
            compradorId: true,
            compradorNombre: true,
          },
        },
      },
    });

    if (!compra) {
      return NextResponse.json(
        { error: "Compra no encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json(compra);
  } catch (error) {
    console.error("Error en GET /api/compras/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
