import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req) {
  //  Verificar roles permitidos
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

    const contratos = await prisma.contratoSalida.findMany({
      where: {
        contratoFecha: { gte: inicio, lte: fin },
        estado: { not: "Anulado" },
      },
      select: {
        contratoID: true,
        contratoFecha: true,
        contratoCantidadQQ: true,
        contratoTotalLps: true,
        contratoPrecio: true,
        contratoDescripcion: true,
        estado: true,
        compradores: {
          select: {
            compradorId: true,
            compradorNombre: true,
            // compradorApellido: true, // Assuming no apellido field based on schema
          },
        },
        producto: {
          select: { productName: true },
        },
      },
      orderBy: { contratoFecha: "desc" },
    });

    const totalQQ = contratos.reduce(
      (acc, c) => acc + Number(c.contratoCantidadQQ || 0),
      0
    );
    const totalLps = contratos.reduce(
      (acc, c) => acc + Number(c.contratoTotalLps || 0),
      0
    );

    return new Response(
      JSON.stringify({
        resumen: {
          totalRegistros: contratos.length,
          totalQQ,
          totalLps,
        },
        detalles: contratos.map((c) => ({
          contratoID: c.contratoID,
          fecha: c.contratoFecha,
          clienteID: c.compradores?.compradorId || 0,
          nombreCliente: c.compradores?.compradorNombre || "Sin nombre",
          tipoCafe: c.producto?.productName || "Sin especificar",
          cantidadQQ: Number(c.contratoCantidadQQ || 0),
          precio: Number(c.contratoPrecio || 0),
          totalLps: Number(c.contratoTotalLps || 0),
          descripcion: c.contratoDescripcion || "—",
          estado: c.estado || "Pendiente",
        })),
        rango: { inicio: inicio.toISOString(), fin: fin.toISOString() },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(" Error en reporte de contratos:", error);
    return new Response(
      JSON.stringify({ error: "Error al generar reporte de contratos" }),
      { status: 500 }
    );
  }
}
