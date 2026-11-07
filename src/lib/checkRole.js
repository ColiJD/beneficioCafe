import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPermisos } from "@/lib/permisos";
import { modulosDeApi, modulosDeModulo } from "@/lib/modulos";
import prisma from "@/lib/prisma";

// /api/compras/[id] sirve compras y ventas: el módulo depende del tipo de registro
export async function moduloDeCompra(id) {
  const r = await prisma.compra.findUnique({
    where: { compraId: Number(id) },
    select: { compraMovimiento: true },
  });
  return r?.compraMovimiento === "Salida" ? "Venta" : "compras";
}

/**
 * checkRole: valida sesión y permisos del usuario (BD: roles + permisos directos).
 * Los módulos se deducen de la URL (ver modulosDeApi): GET = ver, POST = crear, PUT/PATCH = editar, DELETE = eliminar;
 * formulario y registro de una transacción son módulos distintos y el endpoint acepta el que corresponda.
 * `moduloForzado` reemplaza al deducido de la URL (p.ej. ventas servidas por /api/compras/[id]).
 * `allowedRoles` se ignora; se conserva para no tocar los endpoints existentes.
 * GET también pasa con "datos de apoyo" (ver DEPENDENCIAS: datos sí, pantalla no).
 * Un módulo sin permiso asignado (o desconocido) no lo accede nadie; ADMIN solo administra usuarios y roles.
 * @returns session si es válido, o Response si falla
 */
export async function checkRole(req, allowedRoles = [], moduloForzado) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
    });
  }

  const mods = moduloForzado
    ? modulosDeModulo(moduloForzado, req.method)
    : modulosDeApi(new URL(req.url).pathname, req.method);
  const acc = await getPermisos(session.user.id);
  const accion = { GET: "ver", POST: "crear", DELETE: "eliminar" }[req.method] ?? "editar";
  const ok =
    acc &&
    mods.some((m) => {
      const p = acc.permisos[m];
      return p?.[accion] || (accion === "ver" && p?.datosDe?.length);
    });

  if (!ok) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 403,
    });
  }

  return session;
}
