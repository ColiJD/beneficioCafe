import prisma from "@/lib/prisma";
import { getEmpresa } from "@/lib/empresa";
import { funcionHabilitada } from "@/lib/empresa-cliente";

import { MODULOS, ACCIONES, col, DEPENDENCIAS, aplica } from "@/lib/modulos";
export { MODULOS };

/**
 * Permisos efectivos = roles del usuario (principal + extras) ∪ permisos directos.
 * Solo suma, no hay "denegar". El rol ADMIN siempre incluye Administración (admin = true); sus demás módulos
 * se configuran como los de cualquier rol (por defecto ninguno).
 * Devuelve { admin, roles, permisos: { modulo: { ver, editar, origen: [] } } }
 */
export async function getPermisos(userId) {
  const id = Number(userId);
  // Una sola consulta (se ejecuta en cada petición a la API): permisos de cada rol del usuario
  // (principal + extras; un rol sin permisos viene con modulo NULL) y sus permisos directos.
  const filas = await prisma.$queryRaw`
    SELECT 'rol' AS tipo, r.roleName AS nombre, rp.modulo, rp.puedeVer, rp.puedeCrear, rp.puedeEditar, rp.puedeEliminar
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.roleId = r.roleId
    WHERE r.roleId IN (SELECT roleId FROM users WHERE userId = ${id}
                       UNION SELECT roleId FROM user_roles WHERE userId = ${id})
    UNION ALL
    SELECT 'directo', 'directo', up.modulo, up.puedeVer, up.puedeCrear, up.puedeEditar, up.puedeEliminar
    FROM user_permissions up
    WHERE up.userId = ${id}`;
  // Todo usuario tiene rol principal: sin filas de rol, el usuario no existe.
  const deRol = filas.filter((f) => f.tipo === "rol");
  if (!deRol.length) return null;

  const roles = [...new Set(deRol.map((f) => f.nombre))].map((roleName) => ({ roleName }));
  const admin = roles.some((r) => r.roleName === "ADMIN");

  const permisos = {};
  const add = (modulo, fila, origen) => {
    const p = (permisos[modulo] ??= { origen: [], ...Object.fromEntries(ACCIONES.map((x) => [x, false])) });
    let alguno = false;
    for (const x of ACCIONES) if (fila[col(x)]) (p[x] = true), (alguno = true);
    if (alguno) (p.ver = true), p.origen.push(origen); // cualquier acción implica ver
  };
  for (const f of filas) if (f.modulo) add(f.modulo, f, f.nombre);
  // Datos de apoyo: lo que consultan los módulos con acceso. Solo lectura de API; sin pantalla ni menú.
  for (const m of Object.keys(permisos))
    if (permisos[m].ver)
      for (const d of DEPENDENCIAS[m] || []) {
        const x = (permisos[d] ??= { origen: [], ...Object.fromEntries(ACCIONES.map((a) => [a, false])) });
        (x.datosDe ??= []).push(m);
      }
  // Funciones que este cliente no tiene (empresa.funciones): se quitan, así no aparecen en el menú ni responde su API.
  const { funciones } = await getEmpresa();
  for (const m of Object.keys(permisos)) if (!funcionHabilitada(funciones, m)) delete permisos[m];
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
