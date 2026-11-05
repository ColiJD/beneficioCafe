// FUNCIONALES y REGRESIÓN por HTTP contra el servidor de desarrollo (base beneficioCafe_copia).
// Cada transacción de prueba se crea, se modifica y se anula; al final se borran sus filas y se
// comprueba que el inventario quedó exactamente igual que antes.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, conciliacionInventario } from "../setup/db.mjs";
import { usuarioConPermisos, borrarUsuariosDePrueba, borrarCompras, saldo } from "./helpers.mjs";

let op, cli, comp, prodA, prodB, saldosAntes, ultimoMov;
const comprasCreadas = [];

before(async () => {
  op = await usuarioConPermisos("OPERADOR", [
    ["compras", "crear,editar"], ["reg-compras", "eliminar"],
    ["Venta", "crear,editar"], ["reg-ventas", "eliminar"],
    ["transferencias", "crear"], ["inventario", "ver"], ["informe-general", "ver"],
  ]);
  cli = await prisma.cliente.findFirst({ select: { clienteID: true } });
  comp = await prisma.compradores.findFirst({ select: { compradorId: true } });
  const invs = await prisma.inventariocliente.findMany({ orderBy: { cantidadQQ: "desc" } });
  prodA = invs[0].productoID; // el de más saldo
  prodB = invs.find((i) => i.productoID !== prodA).productoID;
  saldosAntes = Object.fromEntries(invs.map((i) => [i.productoID, Number(i.cantidadQQ)]));
  ultimoMov = (await prisma.movimientoinventario.aggregate({ _max: { movimientoID: true } }))._max.movimientoID;
});

after(async () => {
  await borrarCompras(comprasCreadas);
  await prisma.movimientoinventario.deleteMany({
    where: { movimientoID: { gt: ultimoMov }, referenciaTipo: { startsWith: "Transferencia" } },
  });
  // Si alguna prueba falló a medias, se deja el saldo como estaba.
  for (const [productoID, cantidadQQ] of Object.entries(saldosAntes))
    await prisma.inventariocliente.update({ where: { productoID: Number(productoID) }, data: { cantidadQQ } });
  await borrarUsuariosDePrueba();
  await prisma.$disconnect();
});

const compra = (qq) => ({
  clienteID: cli.clienteID, compraTipoDocumento: "Factura", compraTipoCafe: prodA,
  compraPrecioQQ: 100, compraCantidadQQ: qq, compraTotal: qq * 100, compraTotalSacos: 1,
  compraRetencio: 0, compraEn: "Compra Directa", compraDescripcion: "QA prueba automática",
});
const venta = (qq) => ({
  compradorID: comp.compradorId, compraTipoCafe: prodA, compraCantidadQQ: qq, compraTotalSacos: 0,
  compraPrecioQQ: 100, compraTotal: qq * 100, compraDescripcion: "QA prueba automática", compraMovimiento: "Salida",
});

test("FUNCIONAL: el inicio de sesión entrega los permisos del usuario", async () => {
  const r = await op.pedir("/api/auth/permisos");
  assert.equal(r.status, 200);
  assert.equal(r.json.permisos.compras.crear, true);
  assert.equal(r.json.permisos["reg-compras"].eliminar, true);
});

test("FUNCIONAL: compra directa suma al inventario; editar ajusta; anular revierte", async () => {
  const s0 = await saldo(prodA);
  const r = await op.pedir("/api/compras", { method: "POST", body: compra(2) });
  assert.equal(r.status, 201, `POST /api/compras → ${r.status} ${r.texto.slice(0, 200)}`);
  comprasCreadas.push(r.json.compraId);
  assert.equal(await saldo(prodA), +(s0 + 2).toFixed(2));

  const e = await op.pedir(`/api/compras/${r.json.compraId}`, { method: "PUT", body: compra(3) });
  assert.equal(e.status, 200, e.texto.slice(0, 200));
  assert.equal(await saldo(prodA), +(s0 + 3).toFixed(2));

  const d = await op.pedir(`/api/compras/${r.json.compraId}`, { method: "DELETE" });
  assert.equal(d.status, 200, d.texto.slice(0, 200));
  assert.equal(await saldo(prodA), s0);
});

test("FUNCIONAL: venta directa resta; editar ajusta; anular devuelve", async () => {
  const s0 = await saldo(prodA);
  const r = await op.pedir("/api/Venta", { method: "POST", body: venta(1) });
  assert.equal(r.status, 201, r.texto.slice(0, 200));
  const id = r.json.compraId ?? r.json.venta?.compraId ?? r.json.registro?.compraId;
  assert.ok(id, `respuesta sin compraId: ${r.texto.slice(0, 200)}`);
  comprasCreadas.push(id);
  assert.equal(await saldo(prodA), +(s0 - 1).toFixed(2));

  const e = await op.pedir(`/api/Venta/${id}`, { method: "PUT", body: venta(1.5) });
  assert.equal(e.status, 200, e.texto.slice(0, 200));
  assert.equal(await saldo(prodA), +(s0 - 1.5).toFixed(2));

  const d = await op.pedir(`/api/compras/${id}`, { method: "DELETE" });
  assert.equal(d.status, 200, d.texto.slice(0, 200));
  assert.equal(await saldo(prodA), s0);
});

test("FUNCIONAL: transferencia entre productos y regreso", async () => {
  const a0 = await saldo(prodA), b0 = await saldo(prodB);
  const ida = await op.pedir("/api/inventario/transferir", {
    method: "POST", body: { fromProductID: prodA, toProductID: prodB, cantidadQQ: 0.5, nota: "QA prueba automática" },
  });
  assert.equal(ida.status, 200, ida.texto.slice(0, 200));
  assert.equal(await saldo(prodA), +(a0 - 0.5).toFixed(2));
  assert.equal(await saldo(prodB), +(b0 + 0.5).toFixed(2));
  const vuelta = await op.pedir("/api/inventario/transferir", {
    method: "POST", body: { fromProductID: prodB, toProductID: prodA, cantidadQQ: 0.5, nota: "QA prueba automática" },
  });
  assert.equal(vuelta.status, 200);
  assert.equal(await saldo(prodA), a0);
  assert.equal(await saldo(prodB), b0);
});

test("FUNCIONAL: el informe general responde con datos de inventario", async () => {
  const r = await op.pedir("/api/reportes");
  assert.equal(r.status, 200, r.texto.slice(0, 200));
  assert.ok(r.json && typeof r.json === "object");
});

test("REGRESIÓN: no se puede anular dos veces la misma compra", async () => {
  const r = await op.pedir("/api/compras", { method: "POST", body: compra(1) });
  assert.equal(r.status, 201);
  comprasCreadas.push(r.json.compraId);
  assert.equal((await op.pedir(`/api/compras/${r.json.compraId}`, { method: "DELETE" })).status, 200);
  const s = await saldo(prodA);
  const otra = await op.pedir(`/api/compras/${r.json.compraId}`, { method: "DELETE" });
  assert.equal(otra.status, 400);
  assert.equal(await saldo(prodA), s, "la segunda anulación no debe mover inventario");
});

test("REGRESIÓN: una compra anulada no se puede editar", async () => {
  const id = comprasCreadas.at(-1);
  const r = await op.pedir(`/api/compras/${id}`, { method: "PUT", body: compra(5) });
  assert.equal(r.status, 400);
});

test("REGRESIÓN: no se vende ni se transfiere más de lo que hay", async () => {
  const s = await saldo(prodA);
  const v = await op.pedir("/api/Venta", { method: "POST", body: venta(s + 1000) });
  assert.equal(v.status, 400);
  const t = await op.pedir("/api/inventario/transferir", {
    method: "POST", body: { fromProductID: prodA, toProductID: prodB, cantidadQQ: s + 1000 },
  });
  assert.equal(t.status, 400);
  const mismo = await op.pedir("/api/inventario/transferir", {
    method: "POST", body: { fromProductID: prodA, toProductID: prodA, cantidadQQ: 1 },
  });
  assert.equal(mismo.status, 400);
  assert.equal(await saldo(prodA), s);
});

test("REGRESIÓN: la transferencia guarda movimientos Salida/Entrada (los que suman el inventario)", async () => {
  const movs = await prisma.movimientoinventario.findMany({
    where: { movimientoID: { gt: ultimoMov }, referenciaTipo: { startsWith: "Transferencia" } },
  });
  assert.ok(movs.length >= 4);
  for (const m of movs) assert.ok(["Salida", "Entrada"].includes(m.tipoMovimiento), m.tipoMovimiento);
});

test("REGRESIÓN: después de todo el flujo, el inventario cuadra con su historial", async () => {
  const filas = await conciliacionInventario();
  const descuadres = filas.filter((f) => Math.abs(Number(f.saldo) - Number(f.historial)) > 0.005);
  assert.deepEqual(descuadres, []);
});
