import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { respuestaError } from "@/lib/inventarioMov";

// Tarifa del servicio de secado (L por quintal oro) de la cosecha abierta.
// Permiso propio "tarifa-secado" en Roles y permisos: ver (GET) y editar (PUT).
export async function PUT(req) {
  const s = await checkRole(req);
  if (s instanceof Response) return s;
  try {
    const t = Number((await req.json())?.tarifaSecadoQQ);
    if (!Number.isFinite(t) || t < 0) return Response.json({ error: "Tarifa no válida" }, { status: 400 });
    const abierta = await prisma.cosecha.findFirst({ where: { estado: "Abierta" }, select: { cosechaID: true } });
    if (!abierta) return Response.json({ error: "No hay una cosecha abierta" }, { status: 409 });
    return Response.json(await prisma.cosecha.update({ where: { cosechaID: abierta.cosechaID }, data: { tarifaSecadoQQ: t } }));
  } catch (error) {
    return respuestaError(error, "Error al guardar la tarifa de secado");
  }
}
