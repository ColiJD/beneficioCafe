import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/permisos";
import { registrar } from "@/lib/bitacora";
import { moduloDeRuta } from "@/lib/modulos";
import prisma from "@/lib/prisma";
import { respuestaError } from "@/lib/inventarioMov";

// Cualquier usuario con sesión registra su propia visita a una pantalla (lo llama el layout privado).
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "No autenticado" }, { status: 401 });
  const { ruta } = await req.json().catch(() => ({}));
  if (typeof ruta !== "string" || !ruta.startsWith("/private")) return Response.json({ error: "Ruta no válida" }, { status: 400 });
  await registrar({ evento: "VISITA", modulo: "pantalla", ruta: ruta.slice(0, 200), detalle: { modulo: moduloDeRuta(ruta) } });
  return new Response(null, { status: 204 });
}

const fecha = (v) => {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d) ? d : undefined;
};

// Consultar la bitácora: solo administradores.
// ?desde &hasta &userId &evento &modulo &q &pagina &tamano  |  ?resumen=1  |  ?opciones=1
export async function GET(req) {
  const s = await requireAdmin();
  if (s instanceof Response) return s;
  try {
    const p = new URL(req.url).searchParams;

    if (p.get("opciones")) {
      const [usuarios, modulos] = await Promise.all([
        prisma.$queryRaw`SELECT DISTINCT userId, usuario FROM bitacora WHERE userId IS NOT NULL ORDER BY usuario`,
        prisma.$queryRaw`SELECT DISTINCT modulo FROM bitacora WHERE modulo IS NOT NULL ORDER BY modulo`,
      ]);
      return Response.json({ usuarios, modulos: modulos.map((m) => m.modulo) });
    }

    // Mapa de calor: por día (hora de Honduras, UTC-6), usuarios distintos y eventos de entrada (inicios de sesión y visitas).
    if (p.get("mapa")) {
      const desde = new Date(Date.now() - 190 * 24 * 3600 * 1000);
      const uid = Number(p.get("userId")) || null;
      const filas = await prisma.$queryRaw`
        SELECT DATE_FORMAT(CONVERT_TZ(fecha, '+00:00', '-06:00'), '%Y-%m-%d') AS dia,
               COUNT(DISTINCT userId) AS usuarios, COUNT(*) AS eventos
        FROM bitacora
        WHERE evento IN ('LOGIN', 'VISITA') AND userId IS NOT NULL AND fecha >= ${desde}
          AND (${uid} IS NULL OR userId = ${uid})
        GROUP BY dia`;
      return Response.json(filas.map((f) => ({ dia: f.dia, usuarios: Number(f.usuarios), eventos: Number(f.eventos) })));
    }

    if (p.get("resumen")) {
      const desde = new Date(Date.now() - 24 * 3600 * 1000);
      const [porEvento, activos, ultimos] = await Promise.all([
        prisma.bitacora.groupBy({ by: ["evento"], where: { fecha: { gte: desde } }, _count: true }),
        prisma.bitacora.groupBy({ by: ["userId", "usuario"], where: { fecha: { gte: desde }, userId: { not: null } }, _count: true, _max: { fecha: true }, orderBy: { _max: { fecha: "desc" } } }),
        prisma.bitacora.findFirst({ orderBy: { fecha: "desc" }, select: { fecha: true } }),
      ]);
      return Response.json({
        porEvento: Object.fromEntries(porEvento.map((e) => [e.evento, e._count])),
        activos: activos.map((a) => ({ userId: a.userId, usuario: a.usuario, acciones: a._count, ultima: a._max.fecha })),
        ultimoEvento: ultimos?.fecha ?? null,
      });
    }

    const q = p.get("q")?.trim();
    const where = {
      fecha: { gte: fecha(p.get("desde")), lte: fecha(p.get("hasta")) },
      ...(p.get("userId") && { userId: Number(p.get("userId")) }),
      ...(p.get("evento") && { evento: { in: p.get("evento").split(",") } }),
      ...(p.get("modulo") && { modulo: p.get("modulo") }),
      ...(q && { OR: [{ usuario: { contains: q } }, { registroId: { contains: q } }, { ruta: { contains: q } }, { ip: { contains: q } }] }),
    };
    const tamano = Math.min(Math.max(Number(p.get("tamano")) || 50, 1), 200);
    const pagina = Math.max(Number(p.get("pagina")) || 1, 1);
    const [total, filas] = await Promise.all([
      prisma.bitacora.count({ where }),
      prisma.bitacora.findMany({ where, orderBy: { bitacoraID: "desc" }, skip: (pagina - 1) * tamano, take: tamano }),
    ]);
    return Response.json({ total, filas });
  } catch (error) {
    return respuestaError(error, "Error al consultar la bitácora");
  }
}
