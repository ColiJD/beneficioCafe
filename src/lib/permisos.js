import prisma from "@/lib/prisma";

import { MODULOS, ACCIONES, col, DEPENDENCIAS, aplica } from "@/lib/modulos";
export { MODULOS };

/**
 * Permisos efectivos = roles del usuario (principal + extras) ∪ permisos directos.
 * Solo suma, no hay "denegar". El rol ADMIN siempre incluye Administración (admin = true); sus demás módulos
 * se configuran como los de cualquier rol (por defecto ninguno).
 * Devuelve { admin, roles, permisos: { modulo: { ver, editar, origen: [] } } }
 */
export async function getPermisos(userId) {
  const user = await prisma.users.findUnique({
    where: { userId: Number(userId) },
    include: {
      roles: { include: { role_permissions: true } },
      user_roles: { include: { roles: { include: { role_permissions: true } } } },
      user_permissions: true,
    },
  });
  if (!user) return null;

  const roles = [user.roles, ...user.user_roles.map((ur) => ur.roles)].filter(
    (r, i, a) => a.findIndex((x) => x.roleId === r.roleId) === i,
  );
  const admin = roles.some((r) => r.roleName === "ADMIN");

  const permisos = {};
  const add = (modulo, fila, origen) => {
    const p = (permisos[modulo] ??= { origen: [], ...Object.fromEntries(ACCIONES.map((x) => [x, false])) });
    let alguno = false;
    for (const x of ACCIONES) if (fila[col(x)]) (p[x] = true), (alguno = true);
    if (alguno) (p.ver = true), p.origen.push(origen); // cualquier acción implica ver
  };
  for (const r of roles) for (const rp of r.role_permissions) add(rp.modulo, rp, r.roleName);
  for (const up of user.user_permissions) add(up.modulo, up, "directo");
  // Datos de apoyo: lo que consultan los módulos con acceso. Solo lectura de API; sin pantalla ni menú.
  for (const m of Object.keys(permisos))
    if (permisos[m].ver)
      for (const d of DEPENDENCIAS[m] || []) {
        const x = (permisos[d] ??= { origen: [], ...Object.fromEntries(ACCIONES.map((a) => [a, false])) });
        (x.datosDe ??= []).push(m);
      }
  return { admin, roles: roles.map((r) => r.roleName), permisos };
}

/** Devuelve la sesión si es ADMIN, o una Response 401/403. Para endpoints de administración. */
export async function requireAdmin() {
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);
  if (!session)
    return Response.json({ error: "No autenticado" }, { status: 401 });
  const acc = await getPermisos(session.user.id);
  if (!acc?.admin)
    return Response.json({ error: "No autorizado" }, { status: 403 });
  return session;
}

/** Normaliza lo que manda la UI: módulos válidos, solo filas con alguna acción, y toda acción implica ver. */
export function limpiarPermisos(permisos = []) {
  return permisos
    .filter((p) => MODULOS.includes(p.modulo) && ACCIONES.some((a) => aplica(p.modulo, a) && p[col(a)]))
    .map((p) => ({
      modulo: p.modulo,
      ...Object.fromEntries(ACCIONES.map((a) => [col(a), a === "ver" || (aplica(p.modulo, a) && !!p[col(a)])])),
    }));
}
