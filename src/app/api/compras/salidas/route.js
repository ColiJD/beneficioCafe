// app/api/compras/salidas/route.ts
import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req) {
  // 🔹 Verificar rol
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const url = new URL(req.url);
    const compradorID = url.searchParams.get("compradorID");

    let salidas;

    if (compradorID) {
      // 🔹 Solo las salidas de un comprador específico
      salidas = await prisma.compra.findMany({
        where: {
          compraMovimiento: "Salida",
          compradorID: Number(compradorID),
        },
        include: {
          compradores: true, // Información del comprador
          producto: true, // Información del café
        },
      });
    } else {
      // 🔹 Todas las salidas
      salidas = await prisma.compra.findMany({
        where: { compraMovimiento: "Salida" },
        include: {
          compradores: true,
          producto: true,
        },
      });
    }

    // 🔹 Normalizar datos para el frontend
    const mapped = salidas.map((item) => ({
      compraId: item.compraId,
      compradorID: item.compradorID,
      compradorNombre: item.compradores?.compradorNombre || "",
      tipoCafeNombre: item.producto?.productName || "",
      compraCantidadQQ: Number(item.compraCantidadQQ || 0),
      compraPrecioQQ: Number(item.compraPrecioQQ || 0),
      compraTotalSacos: Number(item.compraTotalSacos || 0),
      compraDescripcion: item.compraDescripcion,
      compraMovimiento: item.compraMovimiento,
      compraFecha: item.compraFecha,
    }));

    return new Response(JSON.stringify(mapped), { status: 200 });
  } catch (error) {
    console.error("❌ Error al obtener salidas:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
    });
  }
}
