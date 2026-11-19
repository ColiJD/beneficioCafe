import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { getPermisos } from "@/lib/permisos";
import { puedeEnModulo } from "@/lib/modulos";
import { capitalPendiente } from "@/lib/abonoDeuda";
import { respuestaError } from "@/lib/inventarioMov";

// Capital pendiente del cliente en préstamos y anticipos, solo de lo que el usuario puede abonar: { prestamo, anticipo }.
export async function GET(req) {
  const s = await checkRole(req);
  if (s instanceof Response) return s;
  try {
    const clienteID = Number(new URL(req.url).searchParams.get("clienteID"));
    if (!clienteID) return Response.json({ error: "clienteID requerido" }, { status: 400 });
    const acc = await getPermisos(s.user.id);
    const [prestamo, anticipo] = await Promise.all([
      puedeEnModulo(acc, "prestamos", "crear") ? capitalPendiente(prisma, "PRESTAMO", clienteID) : 0,
      puedeEnModulo(acc, "anticipos", "crear") ? capitalPendiente(prisma, "ANTICIPO", clienteID) : 0,
    ]);
    return Response.json({ prestamo, anticipo });
  } catch (error) {
    return respuestaError(error, "Error al consultar la deuda");
  }
}
