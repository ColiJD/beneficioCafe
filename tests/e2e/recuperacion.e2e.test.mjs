// FUNCIONALES y SEGURIDAD de la recuperación de contraseña, sin mandar correos:
// el enlace se genera directo en la BD (como lo haría /api/auth/recover) y se recorre el resto del flujo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../setup/db.mjs";
import { cliente } from "./helpers.mjs";

const SUFIJO = Date.now();
let rol, user;
const web = cliente();
const email = `qa_recupera_${SUFIJO}@pruebas.test`;

before(async () => {
  rol = await prisma.roles.create({ data: { roleName: `QA_RECUPERA_${SUFIJO}` } });
  user = await prisma.users.create({
    data: { userEmail: email, userPassword: await bcrypt.hash(crypto.randomBytes(12).toString("hex"), 10), roleId: rol.roleId },
  });
});
after(async () => {
  if (user) await prisma.users.delete({ where: { userId: user.userId } });
  if (rol) await prisma.roles.delete({ where: { roleId: rol.roleId } });
  await prisma.$disconnect();
});

const nuevoEnlace = async (msVigencia = 3600_000) => {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.password_resets.create({ data: { userId: user.userId, token, expiresAt: new Date(Date.now() + msVigencia) } });
  return token;
};
const valido = async (token) => (await web.pedir(`/api/auth/validate-token?token=${token}`)).json.valid;
const restablecer = (token, password) => web.pedir("/api/auth/reset-password", { method: "POST", body: { token, password } });

test("FUNCIONAL: enlace válido → cambia la contraseña → se puede entrar con la nueva", async () => {
  const token = await nuevoEnlace();
  assert.equal(await valido(token), true);
  const nueva = `Nueva-${crypto.randomBytes(6).toString("hex")}`;
  const r = await restablecer(token, nueva);
  assert.equal(r.status, 200, r.texto);
  assert.equal(r.json.success, true);
  assert.ok(await cliente().login(email, nueva), "no entra con la contraseña nueva");
});

test("SEGURIDAD: el enlace es de un solo uso y se borran los demás del usuario", async () => {
  const t1 = await nuevoEnlace();
  const t2 = await nuevoEnlace();
  assert.equal((await restablecer(t1, "OtraClave-123")).status, 200);
  assert.equal(await valido(t1), false);
  assert.equal(await valido(t2), false);
  assert.equal((await restablecer(t2, "OtraClave-456")).status, 400);
});

test("SEGURIDAD: enlace vencido, inventado o vacío no sirve", async () => {
  const vencido = await nuevoEnlace(-1000);
  assert.equal(await valido(vencido), false);
  assert.equal((await restablecer(vencido, "Clave-12345")).status, 400);
  assert.equal(await valido("inventado"), false);
  assert.equal((await restablecer("inventado", "Clave-12345")).status, 400);
  assert.equal((await restablecer("", "")).status, 400);
  assert.equal((await web.pedir("/api/auth/reset-password", { method: "POST", body: { token: { gt: "" }, password: "Clave-12345" } })).status, 400);
});

test("SEGURIDAD: no acepta contraseñas de menos de 8 caracteres", async () => {
  const token = await nuevoEnlace();
  const r = await restablecer(token, "corta");
  assert.equal(r.status, 400);
  assert.equal(await valido(token), true, "un intento rechazado no debe gastar el enlace");
});

test("SEGURIDAD: la sesión del navegador no expone el token de refresco", async () => {
  const token = await nuevoEnlace();
  await restablecer(token, "ClaveSesion-123");
  const c = cliente();
  assert.ok(await c.login(email, "ClaveSesion-123"));
  const s = await c.pedir("/api/auth/session");
  assert.equal(s.status, 200);
  assert.equal(s.json.user.refreshToken, undefined);
});

test("SEGURIDAD: recover responde igual exista o no el correo, y valida la entrada", async () => {
  const r = await web.pedir("/api/auth/recover", { method: "POST", body: { email: `no_existe_${SUFIJO}@pruebas.test` } });
  assert.equal(r.status, 200);
  assert.equal(r.json.message, "Si el correo existe, se enviará un enlace");
  assert.equal((await web.pedir("/api/auth/recover", { method: "POST", body: { email: { contains: "@" } } })).status, 400);
  assert.equal((await web.pedir("/api/auth/recover", { method: "POST", body: {} })).status, 400);
});

test("SEGURIDAD: recover limita a 3 solicitudes por correo cada 15 minutos", async () => {
  const otro = `limite_${SUFIJO}@pruebas.test`; // no existe: no se manda correo
  const estados = [];
  for (let i = 0; i < 4; i++)
    estados.push((await web.pedir("/api/auth/recover", { method: "POST", body: { email: otro } })).status);
  assert.deepEqual(estados, [200, 200, 200, 429]);
});
