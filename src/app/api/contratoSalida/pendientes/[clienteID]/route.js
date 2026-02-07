import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(request, context, req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const params = await context.params;
    const { clienteID } = params;

    if (!clienteID) {
      return new Response(
        JSON.stringify({ error: "Falta el ID del cliente" }),
        { status: 400 }
      );
    }

    const contratos = await prisma.contratoSalida.findMany({
      where: {
        compradorID: Number(clienteID),
        contratoMovimiento: { notIn: ["ANULADO", "Anulado", "anulado"] },
        estado: { not: "Anulado" }, // Allow Liquidado to re-check
      },
      include: {
        producto: { select: { productName: true, productID: true } },
      },
    });

    const resultado = await Promise.all(
      contratos.map(async (c) => {
        const entregado = await prisma.detalleContratoSalida.aggregate({
          _sum: { cantidadQQ: true },
          where: {
            contratoID: c.contratoID,
            tipoMovimiento: { notIn: ["ANULADO", "Anulado", "anulado"] },
          },
        });

        const cantidadEntregada = Number(entregado._sum.cantidadQQ || 0);
        const cantidadInicial = Number(c.contratoCantidadQQ || 0);

        if (cantidadEntregada >= cantidadInicial) return null;

        return {
          contratoID: c.contratoID,
          contratoCantidadQQ: cantidadInicial,
          tipoCafeNombre: c.producto?.productName,
          tipoCafeID: c.producto?.productID,
          // Add other fields if needed by frontend
        };
      })
    );

    // Filter out nulls (completed contracts)
    const contratosPendientes = resultado.filter((c) => c !== null);

    return new Response(JSON.stringify(contratosPendientes), { status: 200 });
  } catch (error) {
    console.error("Error al obtener contratos pendientes:", error);
    return new Response(
      JSON.stringify({ error: "Error al obtener contratos pendientes" }),
      { status: 500 }
    );
  }
}
