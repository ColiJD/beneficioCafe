import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { NextResponse } from "next/server";

export async function DELETE(req, { params }) {
  // Verificar permisos
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const salidaID = Number(params.salidaID);
    if (!salidaID) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    // Buscar el registro en la tabla salida
    const registro = await prisma.salida.findUnique({
      where: { salidaID },
    });

    if (!registro) {
      return new Response(JSON.stringify({ error: "Registro no encontrado" }), {
        status: 404,
      });
    }

    // 🔹 Verificar liquidaciones activas
    const registroLiq = await prisma.detalleliqsalida.findFirst({
      where: {
        salidaID,
        movimiento: { notIn: ["ANULADO", "anulado", "Anulado"] },
      },
      select: {
        liqSalidaID: true,
      },
    });

    if (registroLiq) {
      return new Response(
        JSON.stringify({
          error: `No se puede modificar la salida porque tiene liquidaciones asociadas (ID: ${registroLiq.liqSalidaID})`,
        }),
        { status: 403 }
      );
    }

    // Actualizar el registro como "Anulado"
    await prisma.salida.update({
      where: { salidaID },
      data: {
        salidaMovimiento: "Anulado",
        // si quieres agregar un campo estado, podrías hacerlo aquí
        // estado: "Anulado"
      },
    });

    return new Response(
      JSON.stringify({ message: "Registro de salida anulado correctamente" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error al anular registro de salida:", error);
    return new Response(
      JSON.stringify({ error: "Error interno al anular el registro" }),
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
    const salidaID = Number(params.salidaID);
    if (!salidaID) {
      return new Response(JSON.stringify({ error: "ID de salida inválido" }), {
        status: 400,
      });
    }

    const body = await request.json();
    const { cantidadQQ, precio, observaciones } = body;

    // 🔹 Validaciones básicas
    if (cantidadQQ === undefined || precio === undefined) {
      return new Response(
        JSON.stringify({ error: "Faltan datos obligatorios" }),
        { status: 400 }
      );
    }

    // 🔹 Convertir y validar números
    const cantidad = parseFloat(cantidadQQ);
    const precioNum = parseFloat(precio);

    if (isNaN(cantidad) || cantidad <= 0) {
      return new Response(
        JSON.stringify({
          error: "La cantidad en QQ debe ser un número mayor que cero",
        }),
        { status: 400 }
      );
    }

    if (isNaN(precioNum) || precioNum <= 0) {
      return new Response(
        JSON.stringify({ error: "El precio debe ser mayor que cero" }),
        { status: 400 }
      );
    }

    // 🔹 Actualizar salida
    const salidaOriginal = await prisma.salida.findUnique({
      where: { salidaID },
    });

    if (!salidaOriginal) {
      return new Response(
        JSON.stringify({ error: "No se encontró la salida a modificar" }),
        { status: 404 }
      );
    }

    // 🔹 Verificar liquidaciones activas asociadas a la salida
    const liquidacionesAsociadas = await prisma.detalleliqsalida.findMany({
      where: {
        salidaID,
        movimiento: { notIn: ["ANULADO", "anulado", "Anulado"] },
      },
      select: {
        liqSalidaID: true, // solo traer el ID de la liquidación
      },
    });

    if (liquidacionesAsociadas.length > 0) {
      return new Response(
        JSON.stringify({
          error: `No se puede modificar la salida porque tiene liquidaciones asociadas: #${liquidacionesAsociadas
            .map((l) => l.liqSalidaID)
            .join(", ")}`,
        }),
        { status: 403 }
      );
    }

    const salidaActualizada = await prisma.salida.update({
      where: { salidaID },
      data: {
        salidaCantidadQQ: cantidad,
        salidaPrecio: precioNum,
        salidaDescripcion: observaciones || "",
        salidaFecha: new Date(),
      },
    });

    return new Response(
      JSON.stringify({
        message: "Salida actualizada correctamente",
        salidaActualizada,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al actualizar salida:", error);
    return new Response(
      JSON.stringify({ error: "Error al actualizar salida" }),
      { status: 500 }
    );
  }
}

export async function GET(req, { params }) {
  try {
    const { salidaID } = await params;

    const salida = await prisma.salida.findUnique({
      where: { salidaID: Number(salidaID) },
      include: {
        compradores: {
          select: {
            compradorId: true,
            compradorNombre: true,
          },
        },
      },
    });

    if (!salida) {
      return NextResponse.json(
        { error: "Salida no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(salida);
  } catch (error) {
    console.error("ERROR GET SALIDA:", error);
    return NextResponse.json(
      { error: "Error cargando salida" },
      { status: 500 }
    );
  }
}
