// Límite de intentos por clave (correo, IP) en una ventana de tiempo.
// shortcut: vive en la memoria del proceso; si la app corre en varias instancias, pasarlo a la BD o Redis.
const intentos = new Map();

/** Registra un intento y devuelve true si la clave ya pasó de `max` en los últimos `ventanaMs`. */
export function excedeLimite(clave, max, ventanaMs) {
  const ahora = Date.now();
  const recientes = (intentos.get(clave) || []).filter((t) => ahora - t < ventanaMs);
  recientes.push(ahora);
  intentos.set(clave, recientes);
  return recientes.length > max;
}

export const ipDe = (req) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
