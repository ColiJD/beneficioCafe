import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "AUDITORES",
    "OPERARIOS",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    // 1. Agrupar entradas válidas por contrato
    const movimientos = await prisma.detallecontrato.groupBy({
      by: ["contratoID"],
      _sum: { cantidadQQ: true },
      where: {
        tipoMovimiento: "Entrada",
        NOT: { tipoMovimiento: "Anulado" }, // ignorar anulados
      },
    });

    // Convertir resultados a un mapa rápido
    const mapaMov = new Map(
      movimientos.map((m) => [m.contratoID, Number(m._sum.cantidadQQ || 0)])
    );

    // 2. Obtener TODOS los contratos que no estén anulados
    const contratos = await prisma.contrato.findMany({
      where: {
        NOT: { contratoMovimiento: "Anulado" }, // excluir contrato anulado
      },
      include: {
        cliente: true,
        producto: true,
      },
    });

    // 3. Calcular pendientes reales
    const pendientes = contratos
      .map((c) => {
        const entradas = mapaMov.get(c.contratoID) || 0;
        const cantidad = Number(c.contratoCantidadQQ || 0);
        const pendiente = cantidad - entradas;
        const precio = Number(c.contratoPrecio || 0);
        const totalContrato = cantidad * precio;
        const totalEntregado = entradas * precio; // total entregado
        const totalPendiente = pendiente * precio; // total en Lps

        return {
          contratoID: c.contratoID,
          clienteNombre: c.cliente?.clienteNombre || null,
          clienteApellido: c.cliente?.clienteApellido || null,
          cantidadContrato: cantidad,
          entradas,
          pendiente,
          precio,
          totalContrato,
          totalEntregado,
          totalPendiente,
          tipoCafe: c.producto?.productName || null,
          completado: pendiente <= 0 ? true : false,
        };
      })
      .filter((c) => c.pendiente > 0); // solo contratos pendientes



    return Response.json({ ok: true, pendientes });
  } catch (error) {
    console.error(error);
    return Response.json(
      { ok: false, error: "Error obteniendo contratos pendientes" },
      { status: 500 }
    );
  }
}
