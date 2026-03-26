import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const secados = await prisma.secado.findMany({
      include: {
        secadora: true,
        producto: true
      },
      orderBy: { fechaInicio: 'desc' }
    });
    return new Response(JSON.stringify(secados), { status: 200 });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Error al obtener registros de secado" }),
      { status: 500 },
    );
  }
}

export async function POST(req) {
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA", "COLABORADORES"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const body = await req.json();
    const { 
      secadoraId, 
      productoId, 
      productoIdDestino,
      cantidadEntradaQQ, 
      humedadInicial, 
      observaciones, 
      fechaInicio 
    } = body;

    // Iniciar transacción: crear registro de secado, actualizar estado de secadora y afectar inventario
    const result = await prisma.$transaction(async (tx) => {
      const nuevoSecado = await tx.secado.create({
        data: {
          secadoraId: Number(secadoraId),
          productoId: Number(productoId),
          productoIdDestino: productoIdDestino ? Number(productoIdDestino) : null,
          cantidadEntradaQQ: Number(cantidadEntradaQQ),
          humedadInicial: humedadInicial ? Number(humedadInicial) : null,
          fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
          estado: "En Proceso",
          observaciones,
        },
      });

      // Actualizar estado de secadora
      await tx.secadora.update({
        where: { secadoraId: Number(secadoraId) },
        data: { estado: "En Uso" }
      });

      // Verificar que haya inventario suficiente antes de descontar
      const invActual = await tx.inventariocliente.findUnique({
        where: { productoID: Number(productoId) }
      });

      if (!invActual || invActual.cantidadQQ < Number(cantidadEntradaQQ)) {
        throw new Error(`Inventario insuficiente. Disponible: ${invActual?.cantidadQQ || 0} QQ`);
      }

      // Descontar del inventario el producto que entra a secar
      const inventario = await tx.inventariocliente.update({
        where: { productoID: Number(productoId) },
        data: { cantidadQQ: { decrement: Number(cantidadEntradaQQ) } }
      });

      // Registrar movimiento de inventario
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: inventario.inventarioClienteID,
          tipoMovimiento: "Salida",
          referenciaTipo: `Inicio de Secado #${nuevoSecado.secadoId}`,
          referenciaID: nuevoSecado.secadoId,
          cantidadQQ: Number(cantidadEntradaQQ),
          nota: "Salida de inventario por inicio de proceso de secado",
        }
      });

      return nuevoSecado;
    });

    return new Response(JSON.stringify(result), { status: 201 });
  } catch (error) {
    console.error("Error creating secado:", error);
    return new Response(JSON.stringify({ error: "Error al registrar secado" }), {
      status: 500,
    });
  }
}
