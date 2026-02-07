import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function DELETE(req, { params }) {
  // ✅ Validar permisos
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const MovimientoId = Number(params.id);
    if (!MovimientoId) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    // 🔹 Buscar el movimiento
    const movimiento = await prisma.movimientos_anticipos.findUnique({
      where: { MovimientoId },
    });

    if (!movimiento) {
      return new Response(
        JSON.stringify({ error: "Movimiento no encontrado" }),
        { status: 404 }
      );
    }

    // 🔹 Anular el movimiento dentro de una transacción
    await prisma.$transaction([
      prisma.movimientos_anticipos.update({
        where: { MovimientoId },
        data: { tipo_movimiento: "ANULADO" },
      }),
    ]);

    return new Response(
      JSON.stringify({
        message: "Movimiento de anticipo anulado correctamente",
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error al anular movimiento de anticipo:", error);
    return new Response(
      JSON.stringify({
        error: "Error interno al anular el movimiento de anticipo",
      }),
      { status: 500 }
    );
  }
}
