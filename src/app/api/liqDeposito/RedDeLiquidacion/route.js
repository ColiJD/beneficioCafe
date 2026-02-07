import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const liquidaciones = await prisma.liqdeposito.findMany({
      where: {
        NOT: { liqMovimiento: "Anulado" }, // Excluir anulados
      },
      select: {
        liqID: true,
        liqFecha: true,
        liqclienteID: true,
        liqCatidadQQ: true,
        liqPrecio: true,
        liqTotalLps: true,
        liqDescripcion: true,
        liqEn: true,
        liqMovimiento: true,
        cliente: {
          select: {
            clienteID: true,
            clienteNombre: true,
            clienteApellido: true,
          },
        },
        producto: {
          select: { productName: true },
        },
      },
      orderBy: { liqFecha: "desc" },
    });

    // ✅ Respuesta en el mismo formato que tu front espera
    return NextResponse.json({ detalles: liquidaciones }, { status: 200 });
  } catch (error) {
    console.error("⚠️ Error al obtener liquidaciones:", error);
    return NextResponse.json(
      {
        error: "Error al obtener reporte de liquidaciones",
        detalle: error.message,
      },
      { status: 500 }
    );
  }
}
