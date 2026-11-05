import { getEmpresa, guardarEmpresa } from "@/lib/empresa";
import { getCosechaActual } from "@/lib/cosecha";
import { requireAdmin } from "@/lib/permisos";
import { MODULOS } from "@/lib/modulos";
import { respuestaError } from "@/lib/inventarioMov";

// Pública (la pantalla de login necesita nombre y logo); solo datos que ya salen impresos en los documentos.
export async function GET() {
  const { empresaID, ...e } = await getEmpresa();
  const c = await getCosechaActual().catch(() => null);
  return Response.json({ ...e, cosecha: c ? { nombre: c.nombre, fechaInicio: c.fechaInicio } : null });
}

// Configuración de la empresa: solo administradores.
export async function PUT(req) {
  const s = await requireAdmin();
  if (s instanceof Response) return s;
  try {
    const { empresaID, ...e } = await guardarEmpresa(await req.json(), MODULOS);
    return Response.json(e);
  } catch (error) {
    return respuestaError(error, "Error al guardar la empresa");
  }
}
