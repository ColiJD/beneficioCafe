// INVENTARIO INICIAL: permisos por acción, validaciones, saldo, edición, anulación y cuadre del reporte.
// Usa un producto QA propio (no toca el inventario real) y borra por ID exacto todo lo que crea.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, conciliacionInventario } from "../setup/db.mjs";
import { usuarioConPermisos, borrarUsuariosDePrueba, saldo } from "./helpers.mjs";

const API = "/api/inventario/inicial";
let todo, soloVer, soloCrear, sinPermiso, lectorInforme, producto;

before(async () => {
  todo = await usuarioConPermisos("INI_TODO", [["inventario-inicial", "crear,editar,eliminar"]]);
  soloVer = await usuarioConPermisos("INI_VER", [["inventario-inicial", "ver"]]);
  soloCrear = await usuarioConPermisos("INI_CREAR", [["inventario-inicial", "crear"]]);
  sinPermiso = await usuarioConPermisos("INI_NADA", [["inventario", "ver"]]);
  lectorInforme = await usuarioConPermisos("INI_INFORME", [["informe-general", "ver"]]);
  producto = await prisma.producto.create({ data: { productName: `QA_INI_${Date.now()}` } });
});

after(async () => {
  if (producto) {
    const inv = await prisma.inventariocliente.findUnique({ where: { productoID: producto.productID } });
    if (inv) {
      await prisma.movimientoinventario.deleteMany({ where: { inventarioClienteID: inv.inventarioClienteID } });
      await prisma.inventariocliente.delete({ where: { productoID: producto.productID } });
    }
    await prisma.producto.delete({ where: { productID: producto.productID } });
  }
  await borrarUsuariosDePrueba();
  await prisma.$disconnect();
});

const crear = (cantidadQQ, extra = {}) =>
  todo.pedir(API, { method: "POST", body: { productoID: producto.productID, cantidadQQ, ...extra } });
const ultimaCarga = async () =>
  (await todo.pedir(API)).json.filter((c) => c.productoID === producto.productID).sort((a, b) => b.movimientoID - a.movimientoID)[0];
const inicialDelReporte = async () =>
  (await lectorInforme.pedir("/api/reportes?desde=2020-01-01&hasta=2030-12-31")).json.inventario.inicialQQ;

test("permisos: sin permiso nadie lista ni crea; ver solo lista; crear no edita ni anula", async () => {
  assert.equal((await sinPermiso.pedir(API)).status, 403);
  assert.equal((await sinPermiso.pedir(API, { method: "POST", body: { productoID: producto.productID, cantidadQQ: 1 } })).status, 403);
  assert.equal((await soloVer.pedir(API)).status, 200);
  assert.equal((await soloVer.pedir(API, { method: "POST", body: { productoID: producto.productID, cantidadQQ: 1 } })).status, 403);
  assert.equal((await soloCrear.pedir(`${API}/999999`, { method: "PUT", body: { cantidadQQ: 1 } })).status, 403);
  assert.equal((await soloCrear.pedir(`${API}/999999`, { method: "DELETE" })).status, 403);
  assert.equal(await saldo(producto.productID), 0, "ninguna petición rechazada debe tocar el inventario");
});

test("validaciones: producto, cantidad y producto inexistente", async () => {
  assert.equal((await crear(0)).status, 400);
  assert.equal((await crear(-5)).status, 400);
  assert.equal((await crear("abc")).status, 400);
  assert.equal((await todo.pedir(API, { method: "POST", body: { cantidadQQ: 5 } })).status, 400);
  assert.equal((await todo.pedir(API, { method: "POST", body: { productoID: 99999999, cantidadQQ: 5 } })).status, 404);
  assert.equal(await saldo(producto.productID), 0);
});

test("crear suma al saldo, deja una Entrada 'Inventario inicial' y no crea compra", async () => {
  const comprasAntes = await prisma.compra.count();
  const r = await crear(100, { nota: "conteo QA" });
  assert.equal(r.status, 201, r.texto);
  assert.equal(await saldo(producto.productID), 100);
  const c = await ultimaCarga();
  assert.equal(c.cantidadQQ, 100);
  assert.equal(c.nota, "conteo QA");
  const m = await prisma.movimientoinventario.findUnique({ where: { movimientoID: c.movimientoID } });
  assert.equal(m.tipoMovimiento, "Entrada");
  assert.equal(m.referenciaTipo, "Inventario inicial");
  assert.equal(await prisma.compra.count(), comprasAntes, "no debe crear ninguna compra");
});

test("el reporte general suma la carga como línea propia (no como entrada)", async () => {
  const antes = await inicialDelReporte();
  assert.equal((await crear(10)).status, 201);
  assert.equal(Number(((await inicialDelReporte()) - antes).toFixed(2)), 10);
});

test("editar ajusta solo la diferencia; el producto no cambia", async () => {
  const c = await ultimaCarga(); // 10 QQ
  const antes = await saldo(producto.productID);
  const sube = await todo.pedir(`${API}/${c.movimientoID}`, { method: "PUT", body: { cantidadQQ: 25.5 } });
  assert.equal(sube.status, 200, sube.texto);
  assert.equal(await saldo(producto.productID), antes + 15.5);
  const baja = await todo.pedir(`${API}/${c.movimientoID}`, { method: "PUT", body: { cantidadQQ: 4 } });
  assert.equal(baja.status, 200);
  assert.equal(await saldo(producto.productID), antes - 6);
  assert.equal((await todo.pedir(`${API}/${c.movimientoID}`, { method: "PUT", body: { cantidadQQ: 0 } })).status, 400);
  assert.equal((await todo.pedir(`${API}/99999999`, { method: "PUT", body: { cantidadQQ: 1 } })).status, 404);
  assert.equal((await ultimaCarga()).productoID, producto.productID);
});

test("no se puede bajar ni anular una carga si ese café ya se usó (saldo insuficiente)", async () => {
  const c = await ultimaCarga(); // 4 QQ
  const inv = await prisma.inventariocliente.findUnique({ where: { productoID: producto.productID } });
  // se simula un gasto: sale casi todo el saldo con su movimiento, como haría un secado o una venta
  const gasto = Number(inv.cantidadQQ) - 1;
  await prisma.inventariocliente.update({ where: { productoID: producto.productID }, data: { cantidadQQ: { decrement: gasto } } });
  await prisma.movimientoinventario.create({ data: { inventarioClienteID: inv.inventarioClienteID, tipoMovimiento: "Salida", referenciaTipo: "QA gasto", cantidadQQ: gasto } });
  try {
    const saldoAntes = await saldo(producto.productID);
    const baja = await todo.pedir(`${API}/${c.movimientoID}`, { method: "PUT", body: { cantidadQQ: 1 } });
    assert.equal(baja.status, 400, baja.texto);
    assert.match(baja.json.error, /insuficiente/i);
    const anula = await todo.pedir(`${API}/${c.movimientoID}`, { method: "DELETE" });
    assert.equal(anula.status, 400, anula.texto);
    assert.equal(await saldo(producto.productID), saldoAntes, "el rechazo no cambia el saldo");
    assert.equal((await ultimaCarga()).movimientoID, c.movimientoID, "la carga sigue vigente");
  } finally {
    // se devuelve el gasto para que las pruebas siguientes partan limpias
    await prisma.movimientoinventario.deleteMany({ where: { referenciaTipo: "QA gasto", inventarioClienteID: inv.inventarioClienteID } });
    await prisma.inventariocliente.update({ where: { productoID: producto.productID }, data: { cantidadQQ: { increment: gasto } } });
  }
});

test("anular resta del saldo, marca Anulado, sale de la lista y del reporte; no se anula dos veces", async () => {
  const c = await ultimaCarga();
  const antes = await saldo(producto.productID);
  const repAntes = await inicialDelReporte();
  const r = await todo.pedir(`${API}/${c.movimientoID}`, { method: "DELETE" });
  assert.equal(r.status, 200, r.texto);
  assert.equal(await saldo(producto.productID), antes - c.cantidadQQ);
  const m = await prisma.movimientoinventario.findUnique({ where: { movimientoID: c.movimientoID } });
  assert.equal(m.tipoMovimiento, "Anulado");
  assert.ok(!(await todo.pedir(API)).json.some((x) => x.movimientoID === c.movimientoID));
  assert.equal(Number((repAntes - (await inicialDelReporte())).toFixed(2)), c.cantidadQQ);
  assert.equal((await todo.pedir(`${API}/${c.movimientoID}`, { method: "DELETE" })).status, 404, "ya anulada");
  assert.equal((await todo.pedir(`${API}/${c.movimientoID}`, { method: "PUT", body: { cantidadQQ: 5 } })).status, 404, "ya anulada");
});

test("REGRESIÓN: el saldo del producto cuadra con su historial después de crear, editar y anular", async () => {
  const f = (await conciliacionInventario()).find((x) => x.productoID === producto.productID);
  assert.ok(f);
  assert.ok(Math.abs(Number(f.saldo) - Number(f.historial)) < 0.005, `saldo ${f.saldo} ≠ historial ${f.historial}`);
});
