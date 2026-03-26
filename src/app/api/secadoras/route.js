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
    const secadoras = await prisma.secadora.findMany({
      orderBy: { nombre: 'asc' }
    });
    return new Response(JSON.stringify(secadoras), { status: 200 });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Error al obtener secadoras" }),
      { status: 500 },
    );
  }
}

export async function POST(req) {
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const body = await req.json();
    const { nombre, capacidad, tipo } = body;

    const nuevaSecadora = await prisma.secadora.create({
      data: {
        nombre,
        capacidad: capacidad ? Number(capacidad) : null,
        tipo,
        estado: "Disponible"
      },
    });

    return new Response(JSON.stringify(nuevaSecadora), { status: 201 });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Error al crear secadora" }), {
      status: 500,
    });
  }
}
