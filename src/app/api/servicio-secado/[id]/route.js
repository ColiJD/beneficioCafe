import { checkRole } from "@/lib/checkRole";
import { respuestaError } from "@/lib/inventarioMov";
import { terminar, cobrar, vender, anular, asignarSecadora } from "@/lib/servicioSecado";

// PUT { accion: "secadora" | "terminar" | "cobrar" | "vender" | "anular", ...datos }
export async function PUT(req, { params }) {
  const s = await checkRole(req);
  if (s instanceof Response) return s;
  try {
    const { id } = await params;
    const { accion, ...datos } = await req.json();
    const acciones = {
      secadora: () => asignarSecadora(id, datos),
      terminar: () => terminar(id, datos),
      cobrar: () => cobrar(id, datos, Number(s.user.id)),
      vender: () => vender(id, datos, Number(s.user.id)),
      anular: () => anular(id),
    };
    if (!acciones[accion]) return Response.json({ error: "Acción no válida" }, { status: 400 });
    return Response.json(await acciones[accion]());
  } catch (error) {
    if (error?.secadoraOcupada) return Response.json({ error: error.message, secadoraOcupada: true }, { status: 409 });
    return respuestaError(error, "Error en el servicio de secado");
  }
}
