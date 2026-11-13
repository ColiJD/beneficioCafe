// Piezas de la bitácora sin prisma (las usan la extensión, que escribe con el cliente base, y las pantallas).

// Nombre legible de cada tabla; si falta, se muestra el nombre de la tabla.
export const MODULO_ETIQUETA = {
  compra: "Compras y ventas", deposito: "Depósitos", liqdeposito: "Liquidaciones de depósito",
  detalleliqdeposito: "Detalle de liquidación", contrato: "Contratos (entradas)", detallecontrato: "Entregas de contrato (entradas)",
  cierrecontrato: "Cierre de contrato", contratoSalida: "Contratos (salidas)", detalleContratoSalida: "Entregas de contrato (salidas)",
  salida: "Confirmación de ventas", liqsalida: "Liquidaciones de salida", detalleliqsalida: "Detalle de liquidación de salida",
  cliente: "Clientes", compradores: "Compradores", producto: "Productos", secado: "Secado", secadora: "Secadoras",
  caja_chica: "Caja chica", servicio_secado: "Servicio de secado", prestamos: "Préstamos clientes", anticipo: "Anticipos clientes",
  movimientos_prestamo: "Abonos de préstamos", movimientos_anticipos: "Movimientos de anticipos",
  prestamos_compradores: "Préstamos compradores", anticipo_compradores: "Anticipos compradores",
  movimientos_prestamo_compradores: "Abonos de préstamos (compradores)", movimientos_anticipos_compradores: "Movimientos de anticipos (compradores)",
  users: "Usuarios", roles: "Roles", role_permissions: "Permisos de roles", user_roles: "Roles de usuario",
  user_permissions: "Permisos de usuario", empresa: "Empresa", cosecha: "Cosechas",
  sesion: "Sesión", pantalla: "Pantallas",
};
export const EVENTOS = ["CREAR", "EDITAR", "ANULAR", "ELIMINAR", "LOGIN", "LOGIN_FALLIDO", "DENEGADO", "VISITA"];

const OCULTAR = /pass|token|hash|secret|(logo|icono)datos/i; // contraseñas, tokens e imágenes (logoDatos, iconoDatos) nunca se guardan
const LIMITE = 4000;

/** Copia segura para guardar: sin secretos ni binarios, textos y listas acotados. */
export function limpiar(v, nivel = 0) {
  if (v === null || v === undefined) return v;
  if (typeof v === "bigint") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v.length > 200 ? v.slice(0, 200) + "…" : v;
  if (typeof v !== "object") return v;
  if (v instanceof Uint8Array) return "[binario]";
  if (typeof v.toFixed === "function") return String(v); // Decimal
  if (nivel >= 3) return "[…]";
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => limpiar(x, nivel + 1));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, OCULTAR.test(k) ? "[oculto]" : limpiar(x, nivel + 1)]));
}

/** JSON listo para la columna `detalle`: sin undefined y no mayor a ~4 KB (si pasa, solo los nombres de los campos). */
export function detalleSeguro(obj) {
  const limpio = JSON.parse(JSON.stringify(limpiar(obj) ?? {}));
  if (JSON.stringify(limpio).length <= LIMITE) return limpio;
  return { _truncado: true, campos: Object.keys(limpio) };
}

/**
 * Quién hace la petición web en curso (desde su cookie de sesión, que no se puede falsificar).
 * Devuelve null fuera de una petición web (scripts, pruebas): ahí no se registra nada.
 */
export async function actorDePeticion() {
  try {
    const { headers, cookies } = await import("next/headers");
    const [h, c] = [await headers(), await cookies()];
    const { getToken } = await import("next-auth/jwt");
    const t = await getToken({ req: { headers: h, cookies: c }, secret: process.env.NEXTAUTH_SECRET });
    let ruta = null;
    try { ruta = h.get("referer") ? new URL(h.get("referer")).pathname : null; } catch { /* referer inválido */ }
    return {
      userId: t?.id ? Number(t.id) : null,
      usuario: t?.name || t?.email || null,
      rol: t?.role ?? null,
      ip: (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null,
      ruta,
    };
  } catch {
    return null;
  }
}
