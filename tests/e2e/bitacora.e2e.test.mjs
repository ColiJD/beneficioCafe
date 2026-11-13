// BITÁCORA: registra quién hizo qué (escrituras, logins, accesos denegados, visitas) y solo la ve un administrador.
// Crea un cliente de prueba y lo elimina; borra de la bitácora solo las filas de los usuarios de prueba (por ID).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../setup/db.mjs";
import { cliente, usuarioConPermisos, borrarUsuariosDePrueba } from "./helpers.mjs";

const hoyHN = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const correoFalso = `qa_noexiste_${Date.now()}@pruebas.test`;
const cedula = `QA${String(Date.now()).slice(-10)}`;
let desdeID, anonimo, u, admin, uid, adminId, clienteID;

const filas = (where) => prisma.bitacora.findMany({ where: { bitacoraID: { gt: desdeID }, ...where }, orderBy: { bitacoraID: "asc" } });
const usuarioDe = async (nombre) => (await prisma.users.findFirst({ where: { userName: `QA ${nombre}` }, orderBy: { userId: "desc" } })).userId;

before(async () => {
  desdeID = (await prisma.bitacora.aggregate({ _max: { bitacoraID: true } }))._max.bitacoraID ?? 0;
  anonimo = cliente();
  u = await usuarioConPermisos("BITUSER", [["clientes", "crear,editar,eliminar"]]);
  admin = await usuarioConPermisos("BITADMIN", [], { conAdmin: true });
  uid = await usuarioDe("BITUSER");
  adminId = await usuarioDe("BITADMIN");
});
after(async () => {
  if (clienteID) await prisma.cliente.deleteMany({ where: { clienteID } });
  const mias = await filas({ OR: [{ userId: { in: [uid, adminId].filter(Boolean) } }, { evento: "LOGIN_FALLIDO", usuario: null }] });
  const ids = mias.filter((f) => f.userId || f.detalle?.correo === correoFalso).map((f) => f.bitacoraID);
  await prisma.bitacora.deleteMany({ where: { bitacoraID: { in: ids } } });
  await borrarUsuariosDePrueba();
  await prisma.$disconnect();
});

test("el inicio de sesión queda registrado con usuario y rol", async () => {
  const [f] = await filas({ userId: uid, evento: "LOGIN" });
  assert.ok(f, "no hay fila LOGIN");
  assert.equal(f.usuario, "QA BITUSER");
  assert.match(f.rol, /^QA_BITUSER/);
});

test("un intento fallido guarda el correo y nunca la contraseña", async () => {
  const intento = "ClaveMala-12345";
  assert.equal(await anonimo.login(correoFalso, intento), null);
  const [f] = await filas({ evento: "LOGIN_FALLIDO" }).then((r) => r.filter((x) => x.detalle?.correo === correoFalso));
  assert.ok(f, "no hay fila LOGIN_FALLIDO");
  assert.equal(f.detalle.motivo, "el usuario no existe");
  assert.ok(!JSON.stringify(f).includes(intento), "la contraseña quedó en la bitácora");
});

test("crear, editar y eliminar un cliente quedan registrados con el usuario y el registro", async () => {
  const c = await u.pedir("/api/clientes", { method: "POST", body: { clienteCedula: cedula, clienteNombre: "QA Bitacora", clienteApellido: "Prueba", clienteTelefono: "0" } });
  assert.equal(c.status, 201, c.texto);
  clienteID = c.json.clienteID;
  const [crear] = await filas({ userId: uid, evento: "CREAR", modulo: "cliente" });
  assert.ok(crear, "no hay fila CREAR");
  assert.equal(crear.registroId, String(clienteID));
  assert.equal(crear.detalle.datos.clienteNombre, "QA Bitacora");

  const e = await u.pedir(`/api/clientes/${clienteID}`, { method: "PUT", body: { clienteNombre: "QA Editado", clienteApellido: "Prueba" } });
  assert.equal(e.status, 200, e.texto);
  const editar = await filas({ userId: uid, evento: "EDITAR", modulo: "cliente", registroId: String(clienteID) });
  assert.ok(editar.length >= 1, "no hay fila EDITAR");

  const d = await u.pedir(`/api/clientes/${clienteID}`, { method: "DELETE" });
  assert.equal(d.status, 200, d.texto);
  const [borrar] = await filas({ userId: uid, evento: "ELIMINAR", modulo: "cliente" });
  assert.ok(borrar, "no hay fila ELIMINAR");
  assert.equal(borrar.detalle.eliminado.clienteNombre, "QA Editado", "al eliminar se guarda lo que había");
  clienteID = null;
});

test("un acceso sin permiso queda registrado como DENEGADO", async () => {
  assert.equal((await u.pedir("/api/compras")).status, 403);
  const [f] = await filas({ userId: uid, evento: "DENEGADO" });
  assert.ok(f, "no hay fila DENEGADO");
  assert.equal(f.ruta, "/api/compras");
  assert.equal(f.detalle.metodo, "GET");
});

test("las visitas a pantallas se registran; sin sesión o con una ruta ajena se rechazan", async () => {
  assert.equal((await u.pedir("/api/bitacora", { method: "POST", body: { ruta: "/private/page/cliente" } })).status, 204);
  const [f] = await filas({ userId: uid, evento: "VISITA" });
  assert.equal(f.ruta, "/private/page/cliente");
  assert.equal((await u.pedir("/api/bitacora", { method: "POST", body: { ruta: "/api/auth/roles" } })).status, 400);
  assert.equal((await u.pedir("/api/bitacora", { method: "POST", body: {} })).status, 400);
  assert.ok([401, 307, 308].includes((await anonimo.pedir("/api/bitacora", { method: "POST", body: { ruta: "/private/x" } })).status));
});

test("solo el administrador consulta la bitácora, con filtros y paginación", async () => {
  for (const ruta of ["/api/bitacora", "/api/bitacora?resumen=1", "/api/bitacora?mapa=1", "/api/bitacora?opciones=1"])
    assert.equal((await u.pedir(ruta)).status, 403, ruta);
  assert.ok([401, 307, 308].includes((await anonimo.pedir("/api/bitacora")).status), "sin sesión no se consulta");

  const todo = await admin.pedir(`/api/bitacora?userId=${uid}&tamano=2`);
  assert.equal(todo.status, 200);
  assert.equal(todo.json.filas.length, 2);
  assert.ok(todo.json.total >= 4);
  const soloCrear = await admin.pedir(`/api/bitacora?userId=${uid}&evento=CREAR`);
  assert.ok(soloCrear.json.filas.length >= 1 && soloCrear.json.filas.every((f) => f.evento === "CREAR" && f.userId === uid));
  const futuro = await admin.pedir("/api/bitacora?desde=2999-01-01T00:00:00-06:00");
  assert.equal(futuro.json.total, 0);
});

test("resumen, mapa de calor y opciones tienen la forma esperada", async () => {
  const r = (await admin.pedir("/api/bitacora?resumen=1")).json;
  assert.ok(r.porEvento.LOGIN >= 2);
  assert.ok(r.activos.some((a) => a.userId === uid));
  const mapa = (await admin.pedir("/api/bitacora?mapa=1")).json;
  const dia = mapa.find((d) => d.dia === hoyHN());
  assert.ok(dia && dia.usuarios >= 2 && dia.eventos >= 2, "el mapa no muestra la actividad de hoy");
  const deUno = (await admin.pedir(`/api/bitacora?mapa=1&userId=${uid}`)).json;
  assert.equal(deUno.find((d) => d.dia === hoyHN())?.usuarios, 1);
  const o = (await admin.pedir("/api/bitacora?opciones=1")).json;
  assert.ok(o.usuarios.some((x) => x.userId === uid) && o.modulos.includes("cliente"));
});

test("la bitácora no guarda contraseñas ni hashes de lo que hicieron los usuarios de prueba", async () => {
  const todas = await filas({ userId: { in: [uid, adminId] } });
  assert.ok(todas.length > 0);
  assert.ok(!/\$2[aby]\$|userPassword/i.test(JSON.stringify(todas)), "hay un hash o una contraseña en la bitácora");
});
