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
