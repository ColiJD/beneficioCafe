import prisma from "@/lib/prisma";

export async function GET(req, { params }) {
  try {
    const { clienteId } = params;

    // Buscar cliente con préstamos, movimientos y anticipos
    const cliente = await prisma.cliente.findUnique({
      where: { clienteID: Number(clienteId) },
      include: {
        prestamos: {
          include: {
            movimientos_prestamo: {
              orderBy: { fecha: "asc" },
            },
          },
          orderBy: { fecha: "desc" },
        },
        anticipo: {
          include: {
            movimientos_anticipos: {
              orderBy: { fecha: "asc" },
            },
          },
          orderBy: { fecha: "desc" },
        },
      },
    });

    if (!cliente) {
      return new Response(
        JSON.stringify({ message: "Cliente no encontrado" }),
        { status: 404 }
      );
    }

    return new Response(JSON.stringify(cliente), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error al obtener datos del cliente:", error);
    return new Response(
      JSON.stringify({ message: "Error interno del servidor" }),
      { status: 500 }
    );
  }
}

import { checkRole } from "@/lib/checkRole";

export async function DELETE(req) {
  // Validar permisos
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    // Obtener ID desde la URL
    const url = new URL(req.url);
    const prestamoId = Number(url.pathname.split("/").pop());

    if (!prestamoId || isNaN(prestamoId)) {
      return new Response(
        JSON.stringify({ error: "ID de préstamo inválido" }),
        {
          status: 400,
        }
      );
    }

    // Buscar el préstamo
    const prestamoExistente = await prisma.prestamos.findUnique({
      where: { prestamoId },
    });

    if (!prestamoExistente) {
      return new Response(JSON.stringify({ error: "Préstamo no encontrado" }), {
        status: 404,
      });
    }

    // Anular el préstamo
    await prisma.prestamos.update({
      where: { prestamoId },
      data: { estado: "ANULADO" },
    });

    return new Response(
      JSON.stringify({ message: "Préstamo anulado correctamente" }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("❌ Error al anular préstamo:", error);
    return new Response(
      JSON.stringify({ error: "Error interno al anular el préstamo" }),
      {
        status: 500,
      }
    );
  }
}
