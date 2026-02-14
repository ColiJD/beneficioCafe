import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    // 🔹 Obtenemos el inventario global con el nombre del producto
    const inventario = await prisma.inventariocliente.findMany({
      include: {
        producto: {
          select: {
            productName: true,
          },
        },
      },
      orderBy: {
        productoID: "asc",
      },
    });

    // 🔹 Formateamos los datos para el frontend
    const data = inventario.map((item) => ({
      productoID: item.productoID,
      productName: item.producto?.productName || "Desconocido",
      cantidadQQ: parseFloat(item.cantidadQQ.toString()),
      cantidadSacos: parseFloat(item.cantidadSacos.toString()),
    }));

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    console.error("❌ Error al obtener inventario:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
