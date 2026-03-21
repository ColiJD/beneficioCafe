import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req, { params }) {
  try {
    const sessionOrResponse = await checkRole(req, [
      "ADMIN",
      "GERENCIA",
      "COLABORADORES",
      "AUDITORES",
    ]);
    if (sessionOrResponse instanceof Response) return sessionOrResponse;
    
    // En Next.js 15, params debe ser esperado antes de usarse
    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ error: "Parmetro ID faltante" }, { status: 400 });
    }

    const productoID = Number(id);
    if (isNaN(productoID)) {
      return NextResponse.json({ error: "ID de producto no es un número" }, { status: 400 });
    }

    // 🔹 Buscamos el inventario asociado al producto
    const inventario = await prisma.inventariocliente.findUnique({
      where: { productoID },
      include: {
        producto: true,
        movimientoinventario: {
          orderBy: { fecha: "asc" },
        },
      },
    });

    if (!inventario) {
      return NextResponse.json([]);
    }

    // 🔹 Formateamos los movimientos para el frontend
    // Nota: Como la vista vw_movimientos_inventario est fallando en DB (Error 1356),
    // consultamos directamente las tablas. El nombre del cliente se puede inferir
    // o dejar como referencia al documento original para no impactar rendimiento.
    const formattedData = inventario.movimientoinventario.map((m) => ({
      movimientoID: m.movimientoID,
      tipoMovimiento: m.tipoMovimiento,
      cantidadQQ: parseFloat(m.cantidadQQ.toString()),
      fecha: m.fecha.toISOString(),
      referenciaTipo: m.referenciaTipo,
      // Temporales mientras se restaura la vista en DB
      clienteNombre: m.referenciaTipo?.split("#")[0] || "Movimiento",
      clienteApellido: m.referenciaID ? `Ref #${m.referenciaID}` : "",
      tipoCafe: inventario.producto?.productName || "Caf",
    }));

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("❌ ERROR API MOVIMIENTOS:", error.message);
    return NextResponse.json({ 
      error: "Error al cargar movimientos desde tablas directas",
      debug: error.message 
    }, { status: 500 });
  }
}
