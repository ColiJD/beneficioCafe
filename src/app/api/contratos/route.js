import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function POST(request,req) {
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
      contratoclienteID,
      contratoTipoCafe,
      contratoPrecio,
      contratoCantidadQQ,
      contratoTotalLps,
      contratoEn,
      contratoDescripcion,
      contratoRetencion,
    } = body;

    // Validar campos obligatorios
    if (
      !contratoclienteID ||
      !contratoTipoCafe ||
      !contratoPrecio ||
      !contratoCantidadQQ ||
      !contratoTotalLps
    ) {
      return new Response(
        JSON.stringify({ error: "Faltan datos obligatorios del contrato" }),
        { status: 400 }
      );
    }

    // Crear contrato
    const nuevoContrato = await prisma.contrato.create({
      data: {
        contratoclienteID: Number(contratoclienteID),
        contratoFecha: new Date(),
        contratoMovimiento: "Contrato",
        contratoTipoCafe: Number(contratoTipoCafe),
        contratoPrecio: parseFloat(contratoPrecio),
        contratoCantidadQQ: parseFloat(contratoCantidadQQ),
        contratoTotalLps: parseFloat(contratoTotalLps),
        contratoRetencionQQ: parseFloat(contratoRetencion) || 0,
        contratoEn,
        contratoDescripcion: contratoDescripcion || "",
        estado: "Pendiente",
      },
    });

    return new Response(JSON.stringify(nuevoContrato), { status: 201 });
  } catch (error) {
    console.error("Error al registrar contrato:", error);
    return new Response(
      JSON.stringify({ error: "Error al registrar contrato" }),
      { status: 500 }
    );
  }
}

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    // Usamos query raw para traer todo de la vista
    const depositos = await prisma.$queryRawUnsafe(`
      SELECT * from vw_SaldoPorContrato
    `);

    return new Response(JSON.stringify(depositos), { status: 200 });
  } catch (error) {
    console.error("Error al obtener vista vw_SaldoPorContrato:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
    });
  }
}
