// Utilidades HTTP para las pruebas contra el servidor de desarrollo (que usa beneficioCafe_copia).
// Crea roles y usuarios de prueba con contraseña aleatoria y los elimina al terminar.
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../setup/db.mjs";

export const BASE = process.env.TEST_URL || "http://localhost:3000";
const SUFIJO = `${Date.now()}`;

/** Cliente HTTP con cookies (sesión de next-auth). */
export function cliente() {
  const cookies = new Map();
  const guardar = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [par] = c.split(";");
      const i = par.indexOf("=");
      cookies.set(par.slice(0, i), par.slice(i + 1));
    }
  };
  const pedir = async (ruta, { method = "GET", body, form, headers = {} } = {}) => {
    const h = { ...headers, cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") };
    let cuerpo;
    if (form) (h["content-type"] = "application/x-www-form-urlencoded"), (cuerpo = new URLSearchParams(form));
    else if (body !== undefined) (h["content-type"] = "application/json"), (cuerpo = JSON.stringify(body));
    const t0 = performance.now();
    const res = await fetch(BASE + ruta, { method, headers: h, body: cuerpo, redirect: "manual" });
    const ms = performance.now() - t0;
    guardar(res);
    const texto = await res.text();
    let json;
    try { json = JSON.parse(texto); } catch { json = undefined; }
    return { status: res.status, json, texto, ms, location: res.headers.get("location") };
  };
  return {
    pedir,
    async login(email, password) {
      const { json } = await pedir("/api/auth/csrf");
      const r = await pedir("/api/auth/callback/credentials", {
        method: "POST",
        form: { csrfToken: json.csrfToken, email, password, json: "true" },
      });
      return [...cookies.keys()].some((k) => k.includes("session-token")) ? r : null;
    },
  };
}

const creados = { usuarios: [], roles: [] };

/** Crea un rol con permisos [modulo, "ver,crear,..."] y un usuario con ese rol. Devuelve un cliente con sesión. */
export async function usuarioConPermisos(nombre, permisos, { conAdmin = false } = {}) {
  const rol = await prisma.roles.create({ data: { roleName: `QA_${nombre}_${SUFIJO}` } });
  creados.roles.push(rol.roleId);
  if (permisos.length)
    await prisma.role_permissions.createMany({
      data: permisos.map(([modulo, acciones]) => ({
        roleId: rol.roleId,
        modulo,
        puedeVer: true,
        puedeCrear: acciones.includes("crear"),
        puedeEditar: acciones.includes("editar"),
        puedeEliminar: acciones.includes("eliminar"),
      })),
    });
  const password = crypto.randomBytes(12).toString("hex");
  const email = `qa_${nombre.toLowerCase()}_${SUFIJO}@pruebas.test`;
  const user = await prisma.users.create({
    data: { userEmail: email, userPassword: await bcrypt.hash(password, 10), userName: `QA ${nombre}`, roleId: rol.roleId },
  });
  creados.usuarios.push(user.userId);
  if (conAdmin) {
    const admin = await prisma.roles.findUnique({ where: { roleName: "ADMIN" } });
    await prisma.user_roles.create({ data: { userId: user.userId, roleId: admin.roleId } });
  }
  const c = cliente();
  if (!(await c.login(email, password))) throw new Error(`No se pudo iniciar sesión como ${email}`);
  return c;
}

export async function borrarUsuariosDePrueba() {
  for (const userId of creados.usuarios) await prisma.users.deleteMany({ where: { userId } });
  for (const roleId of creados.roles) await prisma.roles.deleteMany({ where: { roleId } });
}

/** Quita las transacciones de prueba y sus movimientos (solo los IDs que crearon las pruebas). */
export async function borrarCompras(ids) {
  if (!ids.length) return;
  const refs = ids.flatMap((id) => [`Compra directa #${id}`, `Venta directa #${id}`]);
  await prisma.movimientoinventario.deleteMany({ where: { referenciaTipo: { in: refs } } });
  await prisma.compra.deleteMany({ where: { compraId: { in: ids } } });
}

export const saldo = async (productoID) =>
  Number((await prisma.inventariocliente.findUnique({ where: { productoID } }))?.cantidadQQ ?? 0);

export const percentil = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];
