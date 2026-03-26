import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req, { params }) {
  const { id } = params;
  try {
    const secado = await prisma.secado.findUnique({
      where: { secadoId: Number(id) },
      include: {
        secadora: true,
        producto: true
      }
    });
    return new Response(JSON.stringify(secado), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Registro no encontrado" }), {
      status: 404,
    });
  }
}

export async function PUT(req, { params }) {
  const { id } = params;
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA", "COLABORADORES"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const body = await req.json();
    const { 
      humedadFinal, 
      cantidadSalidaQQ, 
      fechaFin, 
      estado, 
      observaciones,
      productoIdDestino 
    } = body;
    
    const result = await prisma.$transaction(async (tx) => {
      // Obtenemos el registro actual
      const secado = await tx.secado.findUnique({ where: { secadoId: Number(id) } });
      if (!secado) throw new Error("Registro no encontrado");

      const secadoActualizado = await tx.secado.update({
        where: { secadoId: Number(id) },
        data: { 
          humedadFinal: humedadFinal ? Number(humedadFinal) : undefined, 
          cantidadSalidaQQ: cantidadSalidaQQ ? Number(cantidadSalidaQQ) : undefined,
          productoIdDestino: productoIdDestino ? Number(productoIdDestino) : undefined,
          fechaFin: fechaFin ? new Date(fechaFin) : undefined, 
          estado, 
          observaciones 
        },
      });

      // Si el proceso finaliza, sumamos al inventario el café seco
      if (estado === "Finalizado") {
        const prodDestino = Number(productoIdDestino || secado.productoIdDestino || secado.productoId);
        const inventario = await tx.inventariocliente.upsert({
          where: { productoID: prodDestino },
          update: { cantidadQQ: { increment: Number(cantidadSalidaQQ) } },
          create: { productoID: prodDestino, cantidadQQ: Number(cantidadSalidaQQ) }
        });

        await tx.movimientoinventario.create({
          data: {
            inventarioClienteID: inventario.inventarioClienteID,
            tipoMovimiento: "Entrada",
            referenciaTipo: `Finalización de Secado #${id}`,
            referenciaID: Number(id),
            cantidadQQ: Number(cantidadSalidaQQ),
            nota: "Entrada por finalización de secado",
          }
        });

        // Liberar secadora
        await tx.secadora.update({
          where: { secadoraId: secado.secadoraId },
          data: { estado: "Disponible" }
        });
      }

      if (estado === "Cancelado") {
        // Si cancela, devolvemos al inventario lo que entró
        const inventario = await tx.inventariocliente.upsert({
          where: { productoID: Number(secado.productoId) },
          update: { cantidadQQ: { increment: Number(secado.cantidadEntradaQQ) } },
          create: { productoID: Number(secado.productoId), cantidadQQ: Number(secado.cantidadEntradaQQ) }
        });

        await tx.movimientoinventario.create({
          data: {
            inventarioClienteID: inventario.inventarioClienteID,
            tipoMovimiento: "Entrada",
            referenciaTipo: `Cancelación de Secado #${id}`,
            referenciaID: Number(id),
            cantidadQQ: Number(secado.cantidadEntradaQQ),
            nota: "Devolución por cancelación de secado",
          }
        });

        await tx.secadora.update({
          where: { secadoraId: secado.secadoraId },
          data: { estado: "Disponible" }
        });
      }

      return secadoActualizado;
    });

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    console.error("Error updating secado:", error);
    return new Response(JSON.stringify({ error: error.message || "Error al actualizar registro" }), {
      status: 500,
    });
  }
}

export async function DELETE(req, { params }) {
  const { id } = params;
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const secado = await prisma.secado.findUnique({ where: { secadoId: Number(id) } });
    if (!secado) return new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 });

    await prisma.$transaction(async (tx) => {
      // 1. Marcar como anulado
      await tx.secado.update({
        where: { secadoId: Number(id) },
        data: { estado: "Anulado" }
      });
      
      // 2. REVERTIR INVENTARIO
      // Primero, devolvemos el café mojado que entró originalmente
      const invEntrada = await tx.inventariocliente.upsert({
        where: { productoID: Number(secado.productoId) },
        update: { cantidadQQ: { increment: Number(secado.cantidadEntradaQQ) } },
        create: { productoID: Number(secado.productoId), cantidadQQ: Number(secado.cantidadEntradaQQ) }
      });
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: invEntrada.inventarioClienteID,
          tipoMovimiento: "Entrada",
          referenciaTipo: `Anulación de Secado #${id}`,
          referenciaID: Number(id),
          cantidadQQ: Number(secado.cantidadEntradaQQ),
          nota: "Reversión de entrada por anulación",
        }
      });

      // Si ya estaba finalizado, debemos sustraer el café seco que se había sumado
      if (secado.estado === "Finalizado") {
        const prodDestino = Number(secado.productoIdDestino || secado.productoId);
        const invSalida = await tx.inventariocliente.upsert({
          where: { productoID: prodDestino },
          update: { cantidadQQ: { decrement: Number(secado.cantidadSalidaQQ) } },
          create: { productoID: prodDestino, cantidadQQ: -Number(secado.cantidadSalidaQQ) }
        });
        await tx.movimientoinventario.create({
          data: {
            inventarioClienteID: invSalida.inventarioClienteID,
            tipoMovimiento: "Salida",
            referenciaTipo: `Anulación de Secado #${id}`,
            referenciaID: Number(id),
            cantidadQQ: Number(secado.cantidadSalidaQQ),
            nota: "Reversión de salida por anulación",
          }
        });
      }

      // 3. Liberar secadora si estaba en uso
      if (secado.estado === "En Proceso") {
        await tx.secadora.update({
          where: { secadoraId: secado.secadoraId },
          data: { estado: "Disponible" }
        });
      }
    });

    return new Response(JSON.stringify({ message: "Registro anulado e inventario revertido" }), { status: 200 });
  } catch (error) {
    console.error("Error al anular secado:", error);
    return new Response(JSON.stringify({ error: "No se pudo anular el registro" }), {
      status: 500,
    });
  }
}
