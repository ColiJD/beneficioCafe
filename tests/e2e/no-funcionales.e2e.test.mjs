// NO FUNCIONALES: seguridad (autenticación, autorización, entradas maliciosas) y rendimiento.
// Solo lecturas e intentos que deben ser rechazados; no deja datos.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../setup/db.mjs";
import { cliente, usuarioConPermisos, borrarUsuariosDePrueba, percentil } from "./helpers.mjs";

let anonimo, sinPermisos, lector, admin;

before(async () => {
  anonimo = cliente();
  sinPermisos = await usuarioConPermisos("SINPERMISOS", []);
  lector = await usuarioConPermisos("LECTOR", [["reg-compras", "ver"], ["informe-general", "ver"], ["clientes", "ver"]]);
  admin = await usuarioConPermisos("ADMIN", [], { conAdmin: true });
});
after(async () => {
  await borrarUsuariosDePrueba();
  await prisma.$disconnect();
});

const negado = (r) => [401, 403, 307, 308].includes(r.status) || (r.status === 302 && /login/.test(r.location ?? ""));

test("SEGURIDAD: sin sesión no se accede a la API de negocio", async () => {
  for (const ruta of ["/api/compras", "/api/reportes", "/api/inventario/transferir", "/api/clientes"])
    assert.ok(negado(await anonimo.pedir(ruta)), ruta);
});

test("SEGURIDAD: sin sesión no se listan, crean ni borran usuarios (/api/auth/login)", async () => {
  const r = await anonimo.pedir("/api/auth/login");
  assert.ok(negado(r), `GET /api/auth/login sin sesión respondió ${r.status} y ${Array.isArray(r.json) ? r.json.length + " usuarios" : "datos"}`);
  assert.ok(!/userPassword|\$2[aby]\$/.test(r.texto), "la respuesta expone hashes de contraseña");
  const p = await anonimo.pedir("/api/auth/login", { method: "POST", body: { userEmail: "x@x.test", userPassword: "x", roleId: 1 } });
  assert.ok(negado(p), `POST /api/auth/login sin sesión respondió ${p.status}`);
});

test("SEGURIDAD: ADMIN lista usuarios sin ver hashes; un usuario normal no puede", async () => {
  const r = await admin.pedir("/api/auth/login");
  assert.equal(r.status, 200);
  assert.ok(r.json.length > 0);
  assert.ok(!/userPassword|\$2[aby]\$/.test(r.texto), "la respuesta expone hashes de contraseña");
  assert.equal((await lector.pedir("/api/auth/login")).status, 403);
});

test("SEGURIDAD: usuario sin permisos recibe 403 en todos los módulos", async () => {
  for (const ruta of ["/api/compras", "/api/reportes", "/api/clientes", "/api/secado", "/api/caja-chica", "/api/auth/roles"]) {
    const r = await sinPermisos.pedir(ruta);
    assert.equal(r.status, 403, `${ruta} → ${r.status}`);
  }
});

test("SEGURIDAD: los endpoints que antes no validaban permisos ahora rechazan a quien no tiene acceso", async () => {
  const cliente = await prisma.cliente.findFirst({ select: { clienteID: true } });
  const comprador = await prisma.compradores.findFirst({ select: { compradorId: true } });
  const rutas = [
    ["POST", "/api/fix-statuses"], ["GET", "/api/test_view"], ["GET", "/api/liqDeposito/RedDeLiquidacion"],
    ["GET", `/api/prestamos/${cliente.clienteID}`], ["GET", `/api/salidas/pendientes/${comprador.compradorId}`],
    ["GET", "/api/salidas/1"], ["GET", "/api/secado/1"], ["GET", "/api/secadoras/1"],
  ];
  for (const [method, ruta] of rutas) {
    const r = await sinPermisos.pedir(ruta, { method });
    assert.equal(r.status, 403, `${method} ${ruta} → ${r.status}`);
  }
  assert.equal((await admin.pedir("/api/test_view")).status, 200);
});

test("SEGURIDAD: los módulos que consultan esos datos siguen teniendo acceso", async () => {
  const cliente = await prisma.cliente.findFirst({ select: { clienteID: true } });
  const comprador = await prisma.compradores.findFirst({ select: { compradorId: true } });
  const anticipos = await usuarioConPermisos("ANTICIPOS", [["anticipos", "ver"]]);
  assert.equal((await anticipos.pedir(`/api/prestamos/${cliente.clienteID}`)).status, 200);
  const contratoSalida = await usuarioConPermisos("CONTRATOSALIDA", [["contratoSalida", "ver"]]);
  assert.equal((await contratoSalida.pedir(`/api/salidas/pendientes/${comprador.compradorId}`)).status, 200);
  const regLiq = await usuarioConPermisos("REGLIQ", [["reg-liqDepositos", "ver"]]);
  assert.equal((await regLiq.pedir("/api/liqDeposito/RedDeLiquidacion")).status, 200);
});

test("SEGURIDAD: con permiso de solo ver no se crea ni se anula", async () => {
  assert.equal((await lector.pedir("/api/compras")).status, 200);
  assert.equal((await lector.pedir("/api/compras", { method: "POST", body: {} })).status, 403);
  assert.equal((await lector.pedir("/api/compras/999999999", { method: "DELETE" })).status, 403);
  assert.equal((await lector.pedir("/api/inventario/transferir", { method: "POST", body: {} })).status, 403);
});

test("SEGURIDAD: ADMIN administra roles pero no entra a módulos sin permiso", async () => {
  assert.equal((await admin.pedir("/api/auth/roles")).status, 200);
  assert.equal((await admin.pedir("/api/compras")).status, 403);
  assert.equal((await lector.pedir("/api/auth/roles")).status, 403);
});

test("SEGURIDAD: entradas maliciosas no rompen ni filtran datos", async () => {
  const r = await lector.pedir("/api/compras?clienteID=" + encodeURIComponent("1 OR 1=1"));
  assert.ok([200, 400].includes(r.status), `status ${r.status}`);
  if (r.status === 200) assert.equal(r.json.length, 0, "la inyección devolvió filas");
  const e = await lector.pedir("/api/compras/abc'%20OR%201=1--");
  assert.ok(e.status < 500 || !/prisma|stack|at \w+ \(/i.test(e.texto), "el error expone detalles internos");
});

test("RENDIMIENTO: las consultas principales responden rápido (p95)", async () => {
  // Umbrales para el servidor de desarrollo (sin compilar para producción, base remota), con ~2× de margen
  // sobre lo medido el 2026-11-05 tras paralelizar el informe y cargar permisos en una consulta.
  const rutas = [["/api/compras", 2000], ["/api/reportes", 2500], ["/api/auth/permisos", 1500]];
  for (const [ruta] of rutas) await lector.pedir(ruta); // calentar (compilación en dev)
  for (const [ruta, limite] of rutas) {
    const tiempos = [];
    for (let i = 0; i < 8; i++) tiempos.push((await lector.pedir(ruta)).ms);
    const p95 = percentil(tiempos, 95);
    console.log(`  ${ruta}: p50 ${percentil(tiempos, 50).toFixed(0)} ms · p95 ${p95.toFixed(0)} ms`);
    assert.ok(p95 < limite, `${ruta} p95 ${p95.toFixed(0)} ms ≥ ${limite} ms`);
  }
});

test("RENDIMIENTO: 20 peticiones simultáneas responden todas bien", async () => {
  const t0 = performance.now();
  const rs = await Promise.all(Array.from({ length: 20 }, () => lector.pedir("/api/compras")));
  const total = performance.now() - t0;
  console.log(`  20 simultáneas en ${total.toFixed(0)} ms`);
  assert.deepEqual([...new Set(rs.map((r) => r.status))], [200]);
  assert.ok(total < 15000);
});
