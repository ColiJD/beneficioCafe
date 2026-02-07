import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * checkRole: valida sesión y rol
 * @param {Array} allowedRoles - roles permitidos para el endpoint
 * @param {Request} req - request de Next.js
 * @returns {Object} session si es válido, o Response si falla
 */
export async function checkRole(req, allowedRoles = []) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
    });
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(session.user.role)) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 403,
    });
  }

  return session;
}
