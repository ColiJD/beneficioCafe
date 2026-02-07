import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { Prisma } from "@prisma/client";

export async function PUT(request, { params }) {
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const ventaId = Number(params.id);
    if (!ventaId)
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });

    const body = await request.json();
    const {
      compradorID,
      compraTipoCafe,
      compraCantidadQQ,
      compraTotalSacos,
      compraPrecioQQ,
      compraTotal,
      compraDescripcion,
    } = body;

    const cantidadQQNueva = parseFloat(compraCantidadQQ);
    const cantidadSacosNueva = parseFloat(compraTotalSacos);
    const precioQQ = parseFloat(compraPrecioQQ);
    const totalCompra = parseFloat(compraTotal);

    if (
      !compradorID ||
      !compraTipoCafe ||
      Number.isNaN(cantidadQQNueva) ||
      Number.isNaN(precioQQ)
    ) {
      return new Response(
        JSON.stringify({ error: "Faltan datos obligatorios o son inválidos" }),
        { status: 400 }
      );
    }

    const ventaExistente = await prisma.compra.findUnique({
      where: { compraId: ventaId },
    });

    if (!ventaExistente)
      return new Response(JSON.stringify({ error: "Venta no encontrada" }), {
        status: 404,
      });

    const cantidadQQAnterior = parseFloat(ventaExistente.compraCantidadQQ);
    const diffQQ = cantidadQQNueva - cantidadQQAnterior;

    // Verificar inventario solo si la venta aumenta
    if (diffQQ > 0) {
      const totalInventario = await prisma.inventariocliente.aggregate({
        where: { productoID: Number(compraTipoCafe) },
        _sum: { cantidadQQ: true },
      });
      const totalQQ = totalInventario._sum?.cantidadQQ || 0;
      if (totalQQ < diffQQ) {
        return new Response(
          JSON.stringify({
            error: "Inventario insuficiente para actualizar la venta",
          }),
          { status: 400 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1️⃣ Actualizar venta
      const ventaActualizada = await tx.compra.update({
        where: { compraId: ventaId },
        data: {
          compradorID: Number(compradorID),
          compraTipoCafe: Number(compraTipoCafe),
          compraCantidadQQ: new Prisma.Decimal(cantidadQQNueva),
          compraTotalSacos: new Prisma.Decimal(cantidadSacosNueva),
          compraPrecioQQ: new Prisma.Decimal(precioQQ),
          compraTotal: new Prisma.Decimal(totalCompra),
          compraDescripcion: compraDescripcion || "",
        },
      });

      // 2️⃣ Ajustar inventario y movimiento
      // 2️⃣ Ajustar inventario y movimiento
      if (diffQQ !== 0) {
        const inventarios = await tx.inventariocliente.findMany({
          where: { productoID: Number(compraTipoCafe) },
          orderBy: { inventarioClienteID: "asc" },
        });

        if (inventarios.length === 0) {
          throw new Error("No hay inventario para este tipo de café.");
        }

        if (diffQQ > 0) {
          // 🔻 Venta aumentó → reducir inventario
          let restante = diffQQ;

          for (const inv of inventarios) {
            const cantidadActual = parseFloat(inv.cantidadQQ);
            if (cantidadActual <= 0) continue;

            const reducir = Math.min(restante, cantidadActual);
            await tx.inventariocliente.update({
              where: { inventarioClienteID: inv.inventarioClienteID },
              data: {
                cantidadQQ: { decrement: new Prisma.Decimal(reducir) },
              },
            });

            restante -= reducir;
            if (restante <= 0) break;
          }

          if (restante > 0) {
            throw new Error(
              "Inventario insuficiente para realizar la actualización."
            );
          }
        } else {
          // 🔺 Venta disminuyó → devolver inventario (a primer registro)
          const devolver = Math.abs(diffQQ);
          const primerInv = inventarios[0];

          await tx.inventariocliente.update({
            where: { inventarioClienteID: primerInv.inventarioClienteID },
            data: {
              cantidadQQ: { increment: new Prisma.Decimal(devolver) },
            },
          });
        }

        // 🧾 Actualizar movimiento existente
        // 🧾 Actualizar movimientos existentes
        const movimientos = await tx.movimientoinventario.findMany({
          where: {
            referenciaTipo: { contains: `Venta directa #${ventaId}` },
            tipoMovimiento: "Salida",
            NOT: { tipoMovimiento: "Anulado" },
          },

          orderBy: { movimientoID: "asc" }, // FIFO
        });

        if (movimientos.length > 0) {
          if (diffQQ > 0) {
            // 🔻 Venta aumentó → repartir incremento proporcionalmente
            let restante = diffQQ;

            for (const mov of movimientos) {
              if (restante <= 0) break;

              // Aquí podrías repartir proporcionalmente según cantidad original
              // Para simplificar, repartimos en orden hasta cubrir el aumento
              const incremento = restante;
              const nuevaCantidad = mov.cantidadQQ.add(
                new Prisma.Decimal(incremento)
              );

              await tx.movimientoinventario.update({
                where: { movimientoID: mov.movimientoID },
                data: {
                  cantidadQQ: nuevaCantidad,
                  nota: `Ajuste por aumento de venta a comprador ${compradorID}`,
                },
              });

              restante -= incremento;
            }

            // Si sobra restante, puedes crear un nuevo movimiento adicional
            if (restante > 0) {
              await tx.movimientoinventario.create({
                data: {
                  referenciaID: ventaId,
                  tipoMovimiento: "Salida",
                  cantidadQQ: new Prisma.Decimal(restante),
                  nota: `Ajuste adicional por aumento de venta a comprador ${compradorID}`,
                  fechaMovimiento: new Date(),
                },
              });
            }
          } else {
            // 🔺 Venta disminuyó → reducir proporcionalmente entre movimientos existentes
            let restante = Math.abs(diffQQ);

            for (const mov of movimientos) {
              if (restante <= 0) break;

              const cantidadActual = parseFloat(mov.cantidadQQ);
              if (cantidadActual <= 0) continue;

              const reducir = Math.min(restante, cantidadActual);
              const nuevaCantidad = cantidadActual - reducir;

              await tx.movimientoinventario.update({
                where: { movimientoID: mov.movimientoID },
                data: {
                  cantidadQQ: new Prisma.Decimal(nuevaCantidad),
                  nota: `Ajuste por disminución de venta a comprador ${compradorID}`,
                },
              });

              restante -= reducir;
            }

            if (restante > 0) {
              console.warn(
                `⚠️ No se pudo distribuir ${restante} QQ, revisar inventario.`
              );
            }
          }
        }
      }

      return ventaActualizada;
    });

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (error) {
    console.error("❌ Error al actualizar venta:", error);
    return new Response(
      JSON.stringify({ error: "Error al actualizar venta" }),
      { status: 500 }
    );
  }
}
