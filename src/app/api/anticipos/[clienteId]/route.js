import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function DELETE(req) {
  // ✅ Validar permisos
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    // ✅ Obtener ID desde la URL
    const url = new URL(req.url);
    const anticipoId = Number(url.pathname.split("/").pop());

    if (!anticipoId || isNaN(anticipoId)) {
      return new Response(
        JSON.stringify({ error: "ID de anticipo inválido" }),
        {
          status: 400,
        }
      );
    }

    // ✅ Buscar el anticipo
    const anticipoExistente = await prisma.anticipo.findUnique({
      where: { anticipoId },
    });

    if (!anticipoExistente) {
      return new Response(JSON.stringify({ error: "Anticipo no encontrado" }), {
        status: 404,
      });
    }

    // ✅ Anular el anticipo
    await prisma.anticipo.update({
      where: { anticipoId },
      data: { estado: "ANULADO" },
    });

    return new Response(
      JSON.stringify({ message: "Anticipo anulado correctamente" }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("❌ Error al anular anticipo:", error);
    return new Response(
      JSON.stringify({ error: "Error interno al anular el anticipo" }),
      {
        status: 500,
      }
    );
  }
}
