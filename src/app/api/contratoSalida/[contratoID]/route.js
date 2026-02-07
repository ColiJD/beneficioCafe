import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { NextResponse } from "next/server";
export async function DELETE(req, { params }) {
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const contratoID = Number(params.contratoID);
    if (!contratoID) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    // 🔹 Buscar el contrato
    const contrato = await prisma.contratoSalida.findUnique({
      where: { contratoID },
    });
    if (!contrato) {
      return new Response(JSON.stringify({ error: "Contrato no encontrado" }), {
        status: 404,
      });
    }

    // 🔹 Buscar detalles activos (NO anulados)
    const detallesActivos = await prisma.detalleContratoSalida.findMany({
      where: {
        contratoID,
        tipoMovimiento: { not: "Anulado" }, // ← ignorar anulados
      },
      select: {
        detalleID: true,
      },
    });

    if (detallesActivos.length > 0) {
      const lista = detallesActivos.map((d) => `#${d.detalleID}`).join(", ");

      return new Response(
        JSON.stringify({
          error: `No se puede eliminar el contrato porque tiene entregas activas: ${lista}.`,
          detalles: detallesActivos,
        }),
        { status: 400 }
      );
    }
    // 🔹 Anular el contrato si no hay detalles tipo Entrada activos
    await prisma.contratoSalida.update({
      where: { contratoID },
      data: { estado: "Anulado", contratoMovimiento: "Anulado" },
    });

    return new Response(
      JSON.stringify({
        message: "Contrato anulado correctamente",
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error al anular contrato:", error);
    return new Response(
      JSON.stringify({ error: "Error interno al anular el contrato" }),
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const contratoID = Number(params.contratoID);
    if (!contratoID) {
      return new Response(
        JSON.stringify({ error: "ID de contrato inválido" }),
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      compradorID,
      contratoTipoCafe,
      contratoPrecio,
      contratoCantidadQQ,
      contratoTotalLps,
      contratoDescripcion,
    } = body;

    // Validación de campos obligatorios
    if (
      !compradorID ||
      !contratoTipoCafe ||
      !contratoPrecio ||
      !contratoCantidadQQ ||
      !contratoTotalLps
    ) {
      return new Response(
        JSON.stringify({ error: "Faltan datos obligatorios" }),
        { status: 400 }
      );
    }

    // Verificar existencia del contrato
    const contratoExistente = await prisma.contratoSalida.findUnique({
      where: { contratoID },
    });
    if (!contratoExistente) {
      return new Response(JSON.stringify({ error: "Contrato no encontrado" }), {
        status: 404,
      });
    }

    // Verificar si existen detalles asociados no anulados
    const detalleAsociado = await prisma.detalleContratoSalida.findFirst({
      where: {
        contratoID,
        tipoMovimiento: { not: "Anulado" }, // ignorar anulados
      },
      select: { detalleID: true }, // solo traemos el ID para el mensaje
    });

    if (detalleAsociado) {
      return new Response(
        JSON.stringify({
          error: `No se puede modificar este contrato #${contratoID} porque ya tiene entregas registradas (Detalle ID: ${detalleAsociado.detalleID}).`,
        }),
        { status: 403 }
      );
    }

    // 🔧 Actualizar contrato
    const contratoActualizado = await prisma.contratoSalida.update({
      where: { contratoID },
      data: {
        compradorID: Number(compradorID),
        contratoTipoCafe: Number(contratoTipoCafe),
        contratoPrecio: parseFloat(contratoPrecio),
        contratoCantidadQQ: parseFloat(contratoCantidadQQ),
        contratoTotalLps: parseFloat(contratoTotalLps),
        contratoDescripcion: contratoDescripcion || "N/A",
      },
    });

    return new Response(JSON.stringify(contratoActualizado), { status: 200 });
  } catch (error) {
    console.error("Error al actualizar contrato:", error);
    return new Response(
      JSON.stringify({ error: "Error al actualizar contrato" }),
      { status: 500 }
    );
  }
}

export async function GET(req, context) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
  ]);

  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { contratoID } = context.params;

    const contrato = await prisma.contratoSalida.findUnique({
      where: { contratoID: parseInt(contratoID) },

      include: {
        compradores: {
          select: {
            compradorId: true,
            compradorNombre: true,
            // compradorApellido: true, // Compradores might not have apellido separately if it's just one name field
          },
        },
        producto: {
          select: {
            productID: true,
            productName: true,
          },
        },
      },
    });

    if (!contrato) {
      return NextResponse.json(
        { error: "Contrato no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(contrato);
  } catch (error) {
    console.error("Error en GET /api/contratos/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
