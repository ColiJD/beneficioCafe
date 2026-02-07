import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

// Registrar nueva salida (venta/compromiso)
export async function POST(request, req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const body = await request.json();
    const {
      compradorID,
      salidaMovimiento,
      salidaCantidadQQ,
      salidaPrecio,
      salidaDescripcion,
      contratoID,
    } = body;

    // 🔹 Validaciones básicas
    if (!compradorID || !salidaCantidadQQ || !salidaPrecio) {
      return new Response(
        JSON.stringify({ error: "Faltan datos obligatorios" }),
        { status: 400 }
      );
    }

    // 🔹 Convertir y validar números
    const cantidadQQ = parseFloat(salidaCantidadQQ);
    const precio = parseFloat(salidaPrecio);

    if (isNaN(cantidadQQ) || cantidadQQ <= 0) {
      return new Response(
        JSON.stringify({
          error: "La cantidad en QQ debe ser un número mayor que cero",
        }),
        { status: 400 }
      );
    }

    if (isNaN(precio) || precio <= 0) {
      return new Response(
        JSON.stringify({
          error: "El precio debe ser un número mayor que cero",
        }),
        { status: 400 }
      );
    }

    // 🔹 Crear salida (venta/compromiso)
    const nuevaSalida = await prisma.salida.create({
      data: {
        compradorID: Number(compradorID),
        salidaFecha: new Date(),
        salidaMovimiento: "Salida",
        salidaCantidadQQ: cantidadQQ,
        salidaPrecio: precio,
        salidaDescripcion: salidaDescripcion || "",
      },
    });

    return new Response(JSON.stringify(nuevaSalida), { status: 201 });
  } catch (error) {
    console.error("Error al registrar salida:", error);
    return new Response(
      JSON.stringify({ error: "Error al registrar salida" }),
      { status: 500 }
    );
  }
}



export async function GET(req) {
  // Validar roles
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { searchParams } = new URL(req.url);
    const fechaInicio =
      searchParams.get("desde") || searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("hasta") || searchParams.get("fechaFin");

    const inicio = fechaInicio ? new Date(fechaInicio) : new Date();
    const fin = fechaFin ? new Date(fechaFin) : new Date();

    // Consultar solo los registros
    const salidas = await prisma.salida.findMany({
      where: {
        salidaFecha: { gte: inicio, lte: fin },
        NOT: { salidaMovimiento: "Anulado" },
      },
      select: {
        salidaID: true,
        salidaFecha: true,
        salidaMovimiento: true,
        salidaCantidadQQ: true,
        salidaPrecio: true,
        salidaDescripcion: true,
        compradores: {
          select: {
            compradorId: true,
            compradorNombre: true,
          },
        },
      },
      orderBy: { salidaFecha: "desc" },
    });

    return new Response(JSON.stringify(salidas), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error al obtener salidas:", error);
    return new Response(JSON.stringify({ error: "Error al obtener salidas" }), {
      status: 500,
    });
  }
}
