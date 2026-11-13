import { checkRole } from "@/lib/checkRole";
import { respuestaError } from "@/lib/inventarioMov";
import { getPermisos } from "@/lib/permisos";
import { listar, recibir, tarifaVigente } from "@/lib/servicioSecado";

// Estados que cada permiso deja ver: Activos con el del módulo; Pagado, Vendido y Anulado con el suyo.
const POR_PERMISO = { "servicio-secado": ["Recibido", "Seco"], "reg-servicio-pagado": ["Pagado"], "reg-servicio-vendido": ["Vendido"], "reg-servicio-anulado": ["Anulado"] };

// GET: lista de servicios (?estado=Seco) o la tarifa vigente (?tarifa=1). POST: recibir café para secar.
export async function GET(req) {
  const s = await checkRole(req);
  if (s instanceof Response) return s;
  try {
    const p = new URL(req.url).searchParams;
    if (p.get("tarifa")) return Response.json(await tarifaVigente().catch((e) => ({ error: e.message })));
    // Solo los estados que el usuario puede ver (aunque pida otros o ninguno en particular)
    const acc = await getPermisos(s.user.id);
    const permitidos = Object.entries(POR_PERMISO).filter(([m]) => acc?.permisos?.[m]?.ver).flatMap(([, e]) => e);
    const pedidos = p.get("estado")?.split(",");
    const estados = pedidos ? pedidos.filter((e) => permitidos.includes(e)) : permitidos;
    if (!estados.length) return Response.json([]);
    // Filtros: ?estado=Recibido,Seco &desde &hasta &clienteID &q
    return Response.json(await listar({ estado: estados.join(","), desde: p.get("desde"), hasta: p.get("hasta"), clienteID: p.get("clienteID"), q: p.get("q") }));
  } catch (error) {
    return respuestaError(error, "Error al obtener los servicios de secado");
  }
}

export async function POST(req) {
  const s = await checkRole(req);
  if (s instanceof Response) return s;
  try {
    return Response.json(await recibir(await req.json(), Number(s.user.id)), { status: 201 });
  } catch (error) {
    // La secadora elegida está ocupada: la pantalla le ofrece al usuario usarla igual o seguir sin secadora.
    if (error?.secadoraOcupada) return Response.json({ error: error.message, secadoraOcupada: true }, { status: 409 });
    return respuestaError(error, "Error al recibir el café para secado");
  }
}
