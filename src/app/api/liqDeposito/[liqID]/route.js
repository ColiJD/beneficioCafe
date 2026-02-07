import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function DELETE(req, context) {
  // ✅ Verificar permisos
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    // ✅ Extraer params de forma asíncrona (Next.js 14+)
    const { params } = await context;
    const liqID = Number(params.liqID);

    if (!liqID) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    // ✅ Buscar el registro principal en liqdeposito
    const registro = await prisma.liqdeposito.findUnique({
      where: { liqID },
    });

    if (!registro) {
      return new Response(
        JSON.stringify({ error: "Registro no encontrado" }),
        { status: 404 }
      );
    }

    // ✅ Transacción para anular la liquidación y sus detalles
    await prisma.$transaction(async (tx) => {
      // 🔹 1. Anular la cabecera
      await tx.liqdeposito.update({
        where: { liqID },
        data: {
          liqMovimiento: "Anulado",
        },
      });

      // 🔹 2. Anular todos los detalles vinculados
      await tx.detalleliqdeposito.updateMany({
        where: { liqID },
        data: {
          movimiento: "Anulado",
        },
      });
    });

    return new Response(
      JSON.stringify({
        message:
          "Liquidación de depósito y sus detalles anulados correctamente",
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error al anular registro de liqdeposito:", error);
    return new Response(
      JSON.stringify({ error: "Error interno al anular el registro" }),
      { status: 500 }
    );
  }
}
