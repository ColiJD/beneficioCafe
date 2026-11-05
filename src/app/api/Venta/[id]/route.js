import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { Prisma } from "@prisma/client";
import {
  ErrorNegocio,
  esAnulado,
  moverInventario,
  movimientoOriginal,
  respuestaError,
} from "@/lib/inventarioMov";

export async function PUT(request, { params }) {
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const ventaId = Number((await params).id);
    if (!ventaId) return Response.json({ error: "ID inválido" }, { status: 400 });

    const {
      compradorID,
      compraTipoCafe,
      compraCantidadQQ,
      compraTotalSacos,
      compraPrecioQQ,
      compraTotal,
      compraDescripcion,
    } = await request.json();

    const cantidadQQNueva = parseFloat(compraCantidadQQ);
    const precioQQ = parseFloat(compraPrecioQQ);
    const totalCompra = parseFloat(compraTotal);

    if (!compradorID || !compraTipoCafe || !(cantidadQQNueva > 0) || Number.isNaN(precioQQ)) {
      return Response.json({ error: "Faltan datos obligatorios o son inválidos" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ventaExistente = await tx.compra.findUnique({ where: { compraId: ventaId } });
      if (!ventaExistente) throw new ErrorNegocio("Venta no encontrada", 404);
      if (esAnulado(ventaExistente.compraMovimiento)) {
        throw new ErrorNegocio("No se puede modificar un registro anulado");
      }
      if (ventaExistente.compraMovimiento !== "Salida") {
        throw new ErrorNegocio("El registro no es una venta");
      }

      const qqAnterior = parseFloat(ventaExistente.compraCantidadQQ);
      const sacosAnterior = parseFloat(ventaExistente.compraTotalSacos) || 0;
      const sacosNuevo = parseFloat(compraTotalSacos);
      const cantidadSacosNueva = Number.isNaN(sacosNuevo) ? sacosAnterior : sacosNuevo;
      const productoNuevo = Number(compraTipoCafe);
      const productoAnterior = Number(ventaExistente.compraTipoCafe);

      const ventaActualizada = await tx.compra.update({
        where: { compraId: ventaId },
        data: {
          compradorID: Number(compradorID),
          compraTipoCafe: productoNuevo,
          compraCantidadQQ: new Prisma.Decimal(cantidadQQNueva),
          compraTotalSacos: new Prisma.Decimal(cantidadSacosNueva),
          compraPrecioQQ: new Prisma.Decimal(precioQQ),
          compraTotal: new Prisma.Decimal(totalCompra),
          compraDescripcion: compraDescripcion || "",
        },
      });

      // Una venta resta del inventario: mismo producto = diferencia; otro producto = devolver el anterior y descontar del nuevo
      let inventario;
      if (productoNuevo === productoAnterior) {
        inventario = await moverInventario(
          tx,
          productoNuevo,
          qqAnterior - cantidadQQNueva,
          sacosAnterior - cantidadSacosNueva,
        );
      } else {
        await moverInventario(tx, productoAnterior, qqAnterior, sacosAnterior);
        inventario = await moverInventario(tx, productoNuevo, -cantidadQQNueva, -cantidadSacosNueva);
      }

      const datosMov = {
        inventarioClienteID: inventario.inventarioClienteID,
        cantidadQQ: new Prisma.Decimal(cantidadQQNueva),
        cantidadSacos: new Prisma.Decimal(cantidadSacosNueva),
        nota: `Venta actualizada - comprador ${compradorID}`,
      };
      const movimiento = await movimientoOriginal(tx, [`Venta directa #${ventaId}`]);
      if (movimiento) {
        await tx.movimientoinventario.update({
          where: { movimientoID: movimiento.movimientoID },
          data: datosMov,
        });
      } else {
        await tx.movimientoinventario.create({
          data: {
            ...datosMov,
            tipoMovimiento: "Salida",
            referenciaTipo: `Venta directa #${ventaId}`,
            referenciaID: ventaId,
          },
        });
      }

      return ventaActualizada;
    });

    return Response.json(updated);
  } catch (error) {
    return respuestaError(error, "Error al actualizar venta");
  }
}
