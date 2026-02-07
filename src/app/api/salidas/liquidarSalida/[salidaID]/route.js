import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function DELETE(req, context) {
  // ✅ Verificar permisos
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    // ✅ Extraer params de forma asíncrona
    const { params } = await context;
    const liqSalidaID = Number(params.salidaID);

    if (!liqSalidaID) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    // ✅ Buscar el registro principal
    const registro = await prisma.liqsalida.findUnique({
      where: { liqSalidaID },
    });

    if (!registro) {
      return new Response(JSON.stringify({ error: "Registro no encontrado" }), {
        status: 404,
      });
    }

    // ✅ Transacción para anular todo y devolver inventario
    await prisma.$transaction(async (tx) => {
      // 1. Buscar todos los movimientos de inventario relacionados
      const movimientos = await tx.movimientoinventario.findMany({
        where: {
          referenciaTipo: "Liquidación Salida",
          referenciaID: liqSalidaID,
        },
      });

      // 2. Devolver inventario (revertir cada movimiento)
      for (const mov of movimientos) {
        // Incrementar el inventario
        await tx.inventariocliente.update({
          where: { inventarioClienteID: mov.inventarioClienteID },
          data: {
            cantidadQQ: { increment: Number(mov.cantidadQQ) },
          },
        });

        // Registrar movimiento de devolución
        await tx.movimientoinventario.create({
          data: {
            inventarioClienteID: mov.inventarioClienteID,
            tipoMovimiento: "Entrada",
            referenciaTipo: "Anulación Liquidación Salida",
            referenciaID: liqSalidaID,
            cantidadQQ: Number(mov.cantidadQQ),
            nota: `Devolución por anulación de liquidación #${liqSalidaID}`,
          },
        });
      }

      // 3. Anular la liquidación
      await tx.liqsalida.update({
        where: { liqSalidaID },
        data: { liqMovimiento: "Anulado" },
      });

      // 4. Anular los detalles
      await tx.detalleliqsalida.updateMany({
        where: { liqSalidaID },
        data: { movimiento: "Anulado" },
      });
    });

    return new Response(
      JSON.stringify({
        message:
          "Registro de liquidación de salida y detalles anulados correctamente",
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error al anular registro de liqSalida:", error);
    return new Response(
      JSON.stringify({ error: "Error interno al anular el registro" }),
      { status: 500 }
    );
  }
}

export async function PUT(req, context) {
  // ✅ Verificar permisos
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    // ✅ Extraer params y body
    const { params } = await context;
    const liqSalidaID = Number(params.salidaID);
    const body = await req.json();
    const { cantidadLiquidar, descripcion } = body;

    if (!liqSalidaID || !cantidadLiquidar) {
      return new Response(
        JSON.stringify({ error: "Datos inválidos o incompletos" }),
        { status: 400 }
      );
    }

    const nuevaCantidad = Number(cantidadLiquidar);

    // ✅ Buscar el registro actual
    const registroActual = await prisma.liqsalida.findUnique({
      where: { liqSalidaID },
    });

    if (!registroActual) {
      return new Response(JSON.stringify({ error: "Registro no encontrado" }), {
        status: 404,
      });
    }

    if (registroActual.liqMovimiento === "Anulado") {
      return new Response(
        JSON.stringify({
          error: "No se puede modificar una liquidación anulada",
        }),
        { status: 400 }
      );
    }

    const cantidadActual = Number(registroActual.liqCantidadQQ);
    const diferencia = nuevaCantidad - cantidadActual;

    // ✅ Transacción para actualizar
    await prisma.$transaction(async (tx) => {
      // 1. Si aumenta la cantidad, verificar inventario disponible
      if (diferencia > 0) {
        const totalInventario = await tx.inventariocliente.aggregate({
          _sum: { cantidadQQ: true },
        });

        const inventarioDisponible = Number(
          totalInventario._sum?.cantidadQQ ?? 0
        );

        if (inventarioDisponible < diferencia) {
          throw new Error(
            `Inventario insuficiente para el aumento. Disponible: ${inventarioDisponible.toFixed(
              2
            )} QQ, Necesario: ${diferencia.toFixed(2)} QQ`
          );
        }

        // Reducir inventario adicional
        const inventarios = await tx.inventariocliente.findMany({
          orderBy: { inventarioClienteID: "asc" },
        });

        let restanteQQ = diferencia;
        const movimientosACrear = [];

        for (const inv of inventarios) {
          if (restanteQQ <= 0) break;

          const cantidadDisponible = Number(inv.cantidadQQ);
          if (cantidadDisponible <= 0) continue;

          const descontarQQ = Math.min(restanteQQ, cantidadDisponible);

          await tx.inventariocliente.update({
            where: { inventarioClienteID: inv.inventarioClienteID },
            data: { cantidadQQ: { decrement: descontarQQ } },
          });

          movimientosACrear.push({
            inventarioClienteID: inv.inventarioClienteID,
            tipoMovimiento: "Salida",
            referenciaTipo: "Modificación Liquidación Salida",
            referenciaID: liqSalidaID,
            cantidadQQ: descontarQQ,
            nota: `Ajuste por modificación de liquidación #${liqSalidaID} (+${diferencia.toFixed(
              2
            )} QQ)`,
          });

          restanteQQ -= descontarQQ;
        }

        if (movimientosACrear.length > 0) {
          await tx.movimientoinventario.createMany({
            data: movimientosACrear,
          });
        }
      } else if (diferencia < 0) {
        // 2. Si disminuye la cantidad, devolver inventario
        const cantidadDevolver = Math.abs(diferencia);

        // Buscar los últimos movimientos de esta liquidación
        const movimientos = await tx.movimientoinventario.findMany({
          where: {
            referenciaTipo: "Liquidación Salida",
            referenciaID: liqSalidaID,
          },
          orderBy: { movimientoID: "desc" },
        });

        let restanteDevolver = cantidadDevolver;

        for (const mov of movimientos) {
          if (restanteDevolver <= 0) break;

          const cantidadMov = Number(mov.cantidadQQ);
          const devolver = Math.min(restanteDevolver, cantidadMov);

          // Incrementar inventario
          await tx.inventariocliente.update({
            where: { inventarioClienteID: mov.inventarioClienteID },
            data: { cantidadQQ: { increment: devolver } },
          });

          // Registrar devolución
          await tx.movimientoinventario.create({
            data: {
              inventarioClienteID: mov.inventarioClienteID,
              tipoMovimiento: "Entrada",
              referenciaTipo: "Modificación Liquidación Salida",
              referenciaID: liqSalidaID,
              cantidadQQ: devolver,
              nota: `Ajuste por modificación de liquidación #${liqSalidaID} (${diferencia.toFixed(
                2
              )} QQ)`,
            },
          });

          restanteDevolver -= devolver;
        }
      }

      // 3. Actualizar el registro de liquidación
      await tx.liqsalida.update({
        where: { liqSalidaID },
        data: {
          liqCantidadQQ: nuevaCantidad,
          liqDescripcion: descripcion || registroActual.liqDescripcion,
        },
      });
    });

    return new Response(
      JSON.stringify({
        message: "Liquidación actualizada correctamente",
        diferencia,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error al actualizar liquidación:", error);

    // Manejar error de inventario insuficiente
    if (error.message && error.message.includes("Inventario insuficiente")) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
      });
    }

    return new Response(
      JSON.stringify({ error: "Error interno al actualizar el registro" }),
      { status: 500 }
    );
  }
}
