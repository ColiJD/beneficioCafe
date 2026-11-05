import { requireAdmin } from "@/lib/permisos";
import { cerrarCosecha } from "@/lib/cosecha";
import { respuestaError } from "@/lib/inventarioMov";

export async function POST(req) {
  const s = await requireAdmin();
  if (s instanceof Response) return s;
  try {
    return Response.json(await cerrarCosecha(await req.json(), s.user.id));
  } catch (error) {
    return respuestaError(error, "Error al cerrar la cosecha");
  }
}
