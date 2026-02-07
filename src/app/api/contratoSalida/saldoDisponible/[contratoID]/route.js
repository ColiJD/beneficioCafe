import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req, context) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const params = await context.params;
    const { contratoID } = params;

    if (!contratoID) {
      return new Response(
        JSON.stringify({ error: "Falta el ID del contrato" }),
        { status: 400 }
      );
    }

    const contrato = await prisma.contratoSalida.findUnique({
      where: { contratoID: Number(contratoID) },
      include: {
        producto: { select: { productName: true, productID: true } },
      },
    });

    if (!contrato) {
      return new Response(JSON.stringify({ error: "Contrato no encontrado" }), {
        status: 404,
      });
    }

    const entregado = await prisma.detalleContratoSalida.aggregate({
      _sum: { cantidadQQ: true },
      where: {
        contratoID: Number(contratoID),
        tipoMovimiento: { notIn: ["ANULADO", "Anulado", "anulado"] },
      },
    });

    const cantidadEntregada = Number(entregado._sum.cantidadQQ || 0);
    const cantidadInicial = Number(contrato.contratoCantidadQQ || 0);
    const saldoDisponibleQQ = cantidadInicial - cantidadEntregada;

    const precioQQ = Number(contrato.contratoPrecio || 0);
    const saldoDisponibleLps = saldoDisponibleQQ * precioQQ;

    return new Response(
      JSON.stringify({
        tipoCafeID: contrato.producto?.productID || 0,
        tipoCafeNombre: contrato.producto?.productName || "",
        precioQQ: precioQQ,
        saldoDisponibleQQ: saldoDisponibleQQ > 0 ? saldoDisponibleQQ : 0,
        saldoDisponibleLps: saldoDisponibleLps > 0 ? saldoDisponibleLps : 0,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al obtener saldo del contrato:", error);
    return new Response(
      JSON.stringify({ error: "Error al obtener saldo del contrato" }),
      { status: 500 }
    );
  }
}
