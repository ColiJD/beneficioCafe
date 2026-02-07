import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    // 🔹 Agrupamos por productoID y sumamos la cantidad total (QQ)
    const inventario = await prisma.inventariocliente.groupBy({
      by: ["productoID"],
      _sum: {
        cantidadQQ: true,
      },
      orderBy: {
        productoID: "asc",
      },
    });

    // 🔹 Obtenemos los nombres de los productos
    const productos = await prisma.producto.findMany({
      select: {
        productID: true,
        productName: true,
      },
    });

    // 🔹 Combinamos los datos de inventario y producto
    const data = inventario.map((item) => {
      const producto = productos.find((p) => p.productID === item.productoID);
      return {
        productoID: item.productoID,
        productName: producto?.productName || "Desconocido",
        cantidadQQ: parseFloat(item._sum.cantidadQQ || 0),
      };
    });

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    console.error("❌ Error al obtener inventario:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
