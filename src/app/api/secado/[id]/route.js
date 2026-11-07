import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { ErrorNegocio, moverInventario, respuestaError } from "@/lib/inventarioMov";

export async function GET(req, { params }) {
  const sessionOrResponse = await checkRole(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  const { id } = await params;
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
  const { id } = await params;
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
      if (!secado) throw new ErrorNegocio("Registro no encontrado", 404);

      // Finalizar o cancelar solo se puede una vez, mientras está en proceso
      const cierra = estado === "Finalizado" || estado === "Cancelado";
      if (cierra && secado.estado !== "En Proceso") {
        throw new ErrorNegocio(`El secado ya está ${secado.estado}`);
      }
      if (!cierra && secado.estado === "Anulado") {
        throw new ErrorNegocio("No se puede modificar un secado anulado");
      }
      if (estado === "Finalizado" && !(Number(cantidadSalidaQQ) > 0)) {
        throw new ErrorNegocio("Indique la cantidad de salida en QQ");
      }

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
        const inventario = await moverInventario(tx, prodDestino, Number(cantidadSalidaQQ));

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
        const inventario = await moverInventario(tx, Number(secado.productoId), Number(secado.cantidadEntradaQQ));

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
    return respuestaError(error, "Error al actualizar registro");
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    await prisma.$transaction(async (tx) => {
      const secado = await tx.secado.findUnique({ where: { secadoId: Number(id) } });
      if (!secado) throw new ErrorNegocio("No encontrado", 404);
      if (secado.estado === "Anulado") throw new ErrorNegocio("El secado ya está anulado");

      // 1. Marcar como anulado
      await tx.secado.update({
        where: { secadoId: Number(id) },
        data: { estado: "Anulado" }
      });

      // Un secado cancelado ya devolvió el café mojado al cancelarse: no se devuelve otra vez
      if (secado.estado === "Cancelado") return;

      // 2. REVERTIR INVENTARIO
      // Si ya estaba finalizado, primero se quita el café seco que se había sumado (puede fallar si ya se usó)
      if (secado.estado === "Finalizado") {
        const prodDestino = Number(secado.productoIdDestino || secado.productoId);
        const invSalida = await moverInventario(tx, prodDestino, -Number(secado.cantidadSalidaQQ));
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

      // Devolvemos el café mojado que entró originalmente
      const invEntrada = await moverInventario(tx, Number(secado.productoId), Number(secado.cantidadEntradaQQ));
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
    return respuestaError(error, "No se pudo anular el registro");
  }
}
