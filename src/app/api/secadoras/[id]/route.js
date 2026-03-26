import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req, { params }) {
  const { id } = params;
  try {
    const secadora = await prisma.secadora.findUnique({
      where: { secadoraId: Number(id) },
      include: { secados: true }
    });
    return new Response(JSON.stringify(secadora), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: "No se encontró la secadora" }), {
      status: 404,
    });
  }
}

export async function PUT(req, { params }) {
  const { id } = params;
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const body = await req.json();
    const { nombre, capacidad, tipo, estado } = body;
    const secadoraActualizada = await prisma.secadora.update({
      where: { secadoraId: Number(id) },
      data: { 
        nombre, 
        capacidad: capacidad ? Number(capacidad) : undefined, 
        tipo, 
        estado 
      },
    });
    return new Response(JSON.stringify(secadoraActualizada), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Error al actualizar" }), {
      status: 500,
    });
  }
}

export async function DELETE(req, { params }) {
  const { id } = params;
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    await prisma.secadora.delete({ where: { secadoraId: Number(id) } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return new Response(JSON.stringify({ error: "No se puede eliminar la secadora" }), {
      status: 500,
    });
  }
}
