import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { calcularPendientes, crearDetallesFIFO, redondear } from "@/lib/pendientesSalida";
import { noAnulado } from "@/lib/inventarioMov";

const json = (body, status) => new Response(JSON.stringify(body), { status });
const REF_LIQ = ["Liquidación Salida", "Modificación Liquidación Salida"];

export async function DELETE(req, context) {
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const liqSalidaID = Number((await context.params).salidaID);
    if (!liqSalidaID) return json({ error: "ID inválido" }, 400);

    await prisma.$transaction(async (tx) => {
      // Anular de forma atómica: si ya estaba anulada (o no existe) no se devuelve nada
      const anulada = await tx.liqsalida.updateMany({
        where: { liqSalidaID, ...noAnulado("liqMovimiento") },
        data: { liqMovimiento: "Anulado" },
      });
      if (anulada.count === 0) {
        const existe = await tx.liqsalida.findUnique({ where: { liqSalidaID } });
        throw new Error(existe ? "YA_ANULADA" : "NO_EXISTE");
      }

      // Neto pendiente de devolver = salidas originales/modificaciones - entradas de ajuste ya hechas
      const movimientos = await tx.movimientoinventario.findMany({
        where: { referenciaTipo: { in: REF_LIQ }, referenciaID: liqSalidaID },
      });
      const neto = {};
      for (const m of movimientos) {
        const signo = m.tipoMovimiento === "Salida" ? 1 : m.tipoMovimiento === "Entrada" ? -1 : 0;
        neto[m.inventarioClienteID] = (neto[m.inventarioClienteID] || 0) + signo * Number(m.cantidadQQ);
      }

      for (const [id, qq] of Object.entries(neto)) {
        const cantidad = redondear(qq);
        if (cantidad <= 0) continue;
        await tx.inventariocliente.update({
          where: { inventarioClienteID: Number(id) },
          data: { cantidadQQ: { increment: cantidad } },
        });
        await tx.movimientoinventario.create({
          data: {
            inventarioClienteID: Number(id),
            tipoMovimiento: "Entrada",
            referenciaTipo: "Anulación Liquidación Salida",
            referenciaID: liqSalidaID,
            cantidadQQ: cantidad,
            nota: `Devolución por anulación de liquidación #${liqSalidaID}`,
          },
        });
      }

      await tx.detalleliqsalida.updateMany({
        where: { liqSalidaID },
        data: { movimiento: "Anulado" },
      });
    });

    return json(
      { message: "Registro de liquidación de salida y detalles anulados correctamente" },
      200,
    );
  } catch (error) {
    if (error.message === "NO_EXISTE") return json({ error: "Registro no encontrado" }, 404);
    if (error.message === "YA_ANULADA") return json({ error: "La liquidación ya está anulada" }, 400);
    console.error("❌ Error al anular registro de liqSalida:", error);
    return json({ error: "Error interno al anular el registro" }, 500);
  }
}

export async function PUT(req, context) {
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const liqSalidaID = Number((await context.params).salidaID);
    const { cantidadLiquidar, descripcion } = await req.json();
    const nuevaCantidad = redondear(cantidadLiquidar);

    if (!liqSalidaID || !(nuevaCantidad > 0)) {
      return json({ error: "Datos inválidos o incompletos" }, 400);
    }

    const registroActual = await prisma.liqsalida.findUnique({ where: { liqSalidaID } });
    if (!registroActual) return json({ error: "Registro no encontrado" }, 404);
    if (registroActual.liqMovimiento === "Anulado") {
      return json({ error: "No se puede modificar una liquidación anulada" }, 400);
    }

    const diferencia = redondear(nuevaCantidad - Number(registroActual.liqCantidadQQ));

    await prisma.$transaction(async (tx) => {
      const inventario = await tx.inventariocliente.findUnique({
        where: { productoID: registroActual.productoID },
      });
      if (!inventario) throw new Error("Inventario insuficiente para el producto. Disponible: 0.00 QQ");

      // Los detalles por salida se recalculan (FIFO) con la nueva cantidad,
      // sin contar esta misma liquidación, y no pueden pasar de lo pendiente.
      const pendientes = await calcularPendientes(
        tx,
        registroActual.compradorID,
        registroActual.productoID,
        liqSalidaID,
      );
      const totalPendiente = redondear(pendientes.reduce((a, s) => a + s.pendiente, 0));
      if (nuevaCantidad > totalPendiente) {
        throw new Error(
          `Cantidad excede lo pendiente de liquidar. Pendiente: ${totalPendiente.toFixed(2)} QQ, Solicitado: ${nuevaCantidad.toFixed(2)} QQ`,
        );
      }

      if (diferencia > 0) {
        const bajado = await tx.inventariocliente.updateMany({
          where: { inventarioClienteID: inventario.inventarioClienteID, cantidadQQ: { gte: diferencia } },
          data: { cantidadQQ: { decrement: diferencia } },
        });
        if (bajado.count === 0) {
          throw new Error(
            `Inventario insuficiente para el producto. Disponible: ${Number(inventario.cantidadQQ).toFixed(2)} QQ, Necesario extra: ${diferencia.toFixed(2)} QQ`,
          );
        }
      } else if (diferencia < 0) {
        await tx.inventariocliente.update({
          where: { inventarioClienteID: inventario.inventarioClienteID },
          data: { cantidadQQ: { increment: -diferencia } },
        });
      }

      if (diferencia !== 0) {
        await tx.movimientoinventario.create({
          data: {
            inventarioClienteID: inventario.inventarioClienteID,
            tipoMovimiento: diferencia > 0 ? "Salida" : "Entrada",
            referenciaTipo: "Modificación Liquidación Salida",
            referenciaID: liqSalidaID,
            cantidadQQ: Math.abs(diferencia),
            nota: `Ajuste por modificación de liquidación #${liqSalidaID} (${diferencia > 0 ? "+" : ""}${diferencia.toFixed(2)} QQ)`,
          },
        });
      }

      await tx.detalleliqsalida.deleteMany({
        where: { liqSalidaID, NOT: { movimiento: "Anulado" } },
      });
      await crearDetallesFIFO(tx, liqSalidaID, pendientes, nuevaCantidad);

      await tx.liqsalida.update({
        where: { liqSalidaID },
        data: {
          liqCantidadQQ: nuevaCantidad,
          liqDescripcion: descripcion || registroActual.liqDescripcion,
        },
      });
    });

    return json({ message: "Liquidación actualizada correctamente", diferencia }, 200);
  } catch (error) {
    console.error("❌ Error al actualizar liquidación:", error);
    if (error.message?.includes("Inventario insuficiente") || error.message?.includes("Cantidad excede")) {
      return json({ error: error.message }, 400);
    }
    return json({ error: "Error interno al actualizar el registro" }, 500);
  }
}
