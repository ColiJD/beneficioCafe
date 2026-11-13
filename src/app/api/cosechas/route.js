import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/permisos";
import { listarCosechas, abrirCosecha } from "@/lib/cosecha";
import { respuestaError } from "@/lib/inventarioMov";

// Ver las cosechas: cualquier usuario con sesión. Abrir y cerrar: solo administradores.
export async function GET() {
  if (!(await getServerSession(authOptions))) return Response.json({ error: "No autenticado" }, { status: 401 });
  try {
    return Response.json(await listarCosechas());
  } catch (error) {
    return respuestaError(error, "Error al obtener las cosechas");
  }
}

export async function POST(req) {
  const s = await requireAdmin();
  if (s instanceof Response) return s;
  try {
    return Response.json(await abrirCosecha(await req.json()), { status: 201 });
  } catch (error) {
    return respuestaError(error, "Error al abrir la cosecha");
  }
}

// Tarifa del servicio de secado (lempiras por quintal oro) de la cosecha abierta.
export async function PATCH(req) {
  const s = await requireAdmin();
  if (s instanceof Response) return s;
  try {
    const { tarifaSecadoQQ } = await req.json();
    const t = Number(tarifaSecadoQQ);
    if (!Number.isFinite(t) || t < 0) return Response.json({ error: "Tarifa no válida" }, { status: 400 });
    const abierta = await prisma.cosecha.findFirst({ where: { estado: "Abierta" }, select: { cosechaID: true } });
    if (!abierta) return Response.json({ error: "No hay una cosecha abierta" }, { status: 409 });
    return Response.json(await prisma.cosecha.update({ where: { cosechaID: abierta.cosechaID }, data: { tarifaSecadoQQ: t } }));
  } catch (error) {
    return respuestaError(error, "Error al guardar la tarifa de secado");
  }
}
