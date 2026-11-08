import prisma from "@/lib/prisma";
import { detalleSeguro, actorDePeticion } from "@/lib/bitacoraCtx";

/**
 * Registra un evento que no es una escritura de negocio (login, acceso denegado, visita a una pantalla).
 * Nunca lanza: si la bitácora falla, la operación original sigue.
 * `usuario`: { userId, usuario, rol } si ya se conoce; si no, se toma de la sesión de la petición.
 */
export async function registrar({ evento, modulo = null, registroId = null, detalle, usuario, ip, ruta }) {
  try {
    const a = await actorDePeticion();
    const actor = usuario ?? a ?? {};
    await prisma.bitacora.create({
      data: {
        evento, modulo, registroId: registroId == null ? null : String(registroId),
        userId: actor.userId ?? null, usuario: actor.usuario ?? null, rol: actor.rol ?? null,
        ip: (ip ?? a?.ip ?? "").slice(0, 45) || null, ruta: (ruta ?? a?.ruta ?? "")?.slice(0, 200) || null,
        detalle: detalle ? detalleSeguro(detalle) : undefined,
      },
    });
  } catch {
    /* sin tabla o sin conexión: se ignora */
  }
}
