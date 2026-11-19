// COMPRA CON ABONO A DEUDA: el abono baja la deuda, se anula con la compra y NO cambia compraTotal.
// Usa cliente y producto QA propios; borra por ID exacto todo lo que crea.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../setup/db.mjs";
import { usuarioConPermisos, borrarUsuariosDePrueba, borrarCompras, saldo } from "./helpers.mjs";

let todo, soloCompra, clienteID, producto, prestamo, anticipo;
let cliente2ID, prestamoA, prestamoB; // cliente propio con dos préstamos: abono repartido y edición de compras
const compras = [];

before(async () => {
  todo = await usuarioConPermisos("ABO_TODO", [["compras", "crear,editar"], ["reg-compras", "eliminar"], ["prestamos", "crear,eliminar"], ["anticipos", "crear"]]);
  soloCompra = await usuarioConPermisos("ABO_COMPRA", [["compras", "crear"]]);
  clienteID = (await prisma.cliente.create({ data: { clienteNombre: `QA_ABO_${Date.now() % 1e9}` } })).clienteID;
  producto = await prisma.producto.create({ data: { productName: `QA_ABO_${Date.now()}` } });
  prestamo = await prisma.prestamos.create({ data: { clienteId: clienteID, fecha: new Date(), monto: 1000, tasa_interes: 0, tipo: "PRESTAMO", estado: "ACTIVO" } });
  // cliente 2: dos préstamos (A: 300, el más antiguo · B: 500); el abono se aplica primero a A
  cliente2ID = (await prisma.cliente.create({ data: { clienteNombre: `QA_ABO2_${Date.now() % 1e9}` } })).clienteID;
  const dia = 24 * 3600 * 1000;
  prestamoA = await prisma.prestamos.create({ data: { clienteId: cliente2ID, fecha: new Date(Date.now() - 2 * dia), monto: 300, tasa_interes: 0, tipo: "PRESTAMO", estado: "ACTIVO" } });
  prestamoB = await prisma.prestamos.create({ data: { clienteId: cliente2ID, fecha: new Date(Date.now() - 1 * dia), monto: 500, tasa_interes: 0, tipo: "PRESTAMO", estado: "ACTIVO" } });
  anticipo = await prisma.anticipo.create({ data: { clienteId: clienteID, fecha: new Date(), monto: 500, tasa_interes: 0, tipo: "ANTICIPO", estado: "ACTIVO" } });
});

after(async () => {
  await prisma.movimientos_prestamo.deleteMany({ where: { prestamo_id: { in: [prestamo.prestamoId, prestamoA.prestamoId, prestamoB.prestamoId] } } });
  await prisma.movimientos_anticipos.deleteMany({ where: { anticipoId: anticipo.anticipoId } });
  await borrarCompras(compras);
  await prisma.prestamos.delete({ where: { prestamoId: prestamo.prestamoId } });
  await prisma.anticipo.delete({ where: { anticipoId: anticipo.anticipoId } });
  await prisma.prestamos.deleteMany({ where: { prestamoId: { in: [prestamoA.prestamoId, prestamoB.prestamoId] } } });
  await prisma.cliente.delete({ where: { clienteID: cliente2ID } });
  const inv = await prisma.inventariocliente.findUnique({ where: { productoID: producto.productID } });
  if (inv) {
    await prisma.movimientoinventario.deleteMany({ where: { inventarioClienteID: inv.inventarioClienteID } });
    await prisma.inventariocliente.delete({ where: { productoID: producto.productID } });
  }
  await prisma.producto.delete({ where: { productID: producto.productID } });
  await prisma.cliente.delete({ where: { clienteID } });
  await borrarUsuariosDePrueba();
  await prisma.$disconnect();
});

const cuerpo = (extra = {}) => ({
  clienteID, compraTipoCafe: producto.productID, compraTipoDocumento: "Contado", compraPrecioQQ: 750, compraCantidadQQ: 2,
  compraTotalSacos: 2, compraRetencio: 1.92, compraEn: "Compra Directa", compraDescripcion: "QA abono", compraTotal: 1500, ...extra,
});
const crear = async (extra, quien = todo) => {
  const r = await quien.pedir("/api/compras", { method: "POST", body: cuerpo(extra) });
  if (r.status === 201) compras.push(r.json.compraId);
  return r;
};
const capital = async (tabla, fk, monto, tipoAbono, id) => {
  const movs = await prisma[tabla].findMany({ where: { [fk]: id, tipo_movimiento: tipoAbono } });
  return monto - movs.reduce((s, m) => s + Number(m.monto), 0);
};
const capPrestamo = () => capital("movimientos_prestamo", "prestamo_id", 1000, "ABONO", prestamo.prestamoId);
const capAnticipo = () => capital("movimientos_anticipos", "anticipoId", 500, "ABONO_ANTICIPO", anticipo.anticipoId);

test("sin abono la compra se guarda como siempre (abono 0)", async () => {
  const r = await crear();
  assert.equal(r.status, 201, r.texto);
  assert.equal(Number(r.json.compraAbono), 0);
  assert.equal(r.json.compraAbonoTipo, null);
  assert.equal(await capPrestamo(), 1000);
});

test("el endpoint de deuda devuelve el capital pendiente de cada tipo", async () => {
  const r = await todo.pedir(`/api/compras/deuda?clienteID=${clienteID}`);
  assert.equal(r.status, 200, r.texto);
  assert.equal(r.json.prestamo, 1000);
  assert.equal(r.json.anticipo, 500);
  const solo = await soloCompra.pedir(`/api/compras/deuda?clienteID=${clienteID}`);
  assert.deepEqual(solo.json, { prestamo: 0, anticipo: 0 }, "sin permiso de abonar no se muestra la deuda");
});

test("abono a préstamo: compraTotal NO cambia, la deuda baja y el movimiento queda ligado a la compra", async () => {
  const r = await crear({ compraAbono: 1000, compraAbonoTipo: "PRESTAMO" });
  assert.equal(r.status, 201, r.texto);
  assert.equal(Number(r.json.compraTotal), 1500, "el total del café no se toca");
  assert.equal(Number(r.json.compraAbono), 1000);
  assert.equal(r.json.compraAbonoTipo, "PRESTAMO");
  assert.equal(await capPrestamo(), 0);
  const m = await prisma.movimientos_prestamo.findFirst({ where: { compraId: r.json.compraId } });
  assert.equal(Number(m.monto), 1000);
  assert.equal(m.prestamo_id, prestamo.prestamoId, "el movimiento apunta a la compra por compraId");
  assert.equal(m.tipo_movimiento, "ABONO");
  const p = await prisma.prestamos.findUnique({ where: { prestamoId: prestamo.prestamoId } });
  assert.equal(p.estado, "COMPLETADO", "pagado del todo");
});

test("anular la compra anula el abono y la deuda vuelve a subir", async () => {
  const id = compras.at(-1);
  const r = await todo.pedir(`/api/compras/${id}`, { method: "DELETE" });
  assert.equal(r.status, 200, r.texto);
  assert.equal(await capPrestamo(), 1000);
  const m = await prisma.movimientos_prestamo.findFirst({ where: { prestamo_id: prestamo.prestamoId, tipo_movimiento: "ANULADO" } });
  assert.ok(m, "el movimiento quedó ANULADO");
  assert.equal((await prisma.prestamos.findUnique({ where: { prestamoId: prestamo.prestamoId } })).estado, "ACTIVO");
});

test("abono parcial a anticipo y el abono no puede exceder el total ni la deuda", async () => {
  const r = await crear({ compraAbono: 300, compraAbonoTipo: "ANTICIPO", compraTotal: 1500 });
  assert.equal(r.status, 201, r.texto);
  assert.equal(await capAnticipo(), 200);
  assert.equal((await crear({ compraAbono: 1600, compraAbonoTipo: "PRESTAMO" })).status, 400, "mayor que el total");
  assert.equal((await crear({ compraAbono: 600, compraAbonoTipo: "ANTICIPO" })).status, 400, "mayor que el capital pendiente");
  assert.equal((await crear({ compraAbono: -5, compraAbonoTipo: "PRESTAMO" })).status, 400);
  assert.equal((await crear({ compraAbono: 10, compraAbonoTipo: "OTRO" })).status, 400);
  assert.equal(await capAnticipo(), 200, "los rechazos no tocan la deuda");
});

test("un rechazo no deja la compra a medias (todo o nada)", async () => {
  const antes = await prisma.compra.count({ where: { clienteID } });
  const inv = await prisma.inventariocliente.findUnique({ where: { productoID: producto.productID } });
  const r = await crear({ compraAbono: 600, compraAbonoTipo: "ANTICIPO" });
  assert.equal(r.status, 400);
  assert.equal(await prisma.compra.count({ where: { clienteID } }), antes, "no se creó la compra");
  const despues = await prisma.inventariocliente.findUnique({ where: { productoID: producto.productID } });
  assert.equal(Number(despues.cantidadQQ), Number(inv.cantidadQQ), "no entró café al inventario");
});

test("sin permiso de abonar (préstamos/anticipos) no se puede abonar desde la compra", async () => {
  const r = await crear({ compraAbono: 100, compraAbonoTipo: "PRESTAMO" }, soloCompra);
  assert.equal(r.status, 403, r.texto);
  assert.equal(await capPrestamo(), 1000);
});

test("editar: el abono no se toca, pero el total no puede quedar menor que el abono aplicado", async () => {
  const { json: c } = await crear({ compraAbono: 400, compraAbonoTipo: "PRESTAMO" });
  const ok = await todo.pedir(`/api/compras/${c.compraId}`, { method: "PUT", body: cuerpo({ compraTotal: 1450, compraPrecioQQ: 725 }) });
  assert.equal(ok.status, 200, ok.texto);
  const { abono } = await prisma.movimientos_prestamo.aggregate({ where: { compraId: c.compraId, tipo_movimiento: "ABONO" }, _sum: { monto: true } }).then((x) => ({ abono: Number(x._sum.monto) }));
  assert.equal(abono, 400, "el abono sigue igual");
  const mal = await todo.pedir(`/api/compras/${c.compraId}`, { method: "PUT", body: cuerpo({ compraTotal: 300, compraPrecioQQ: 150 }) });
  assert.equal(mal.status, 400, mal.texto);
  assert.match(mal.json.error, /abono/i);
});

test("REGRESIÓN: compraTotal sigue siendo precio × QQ; el abono no lo reduce", async () => {
  const conAbono = (await prisma.movimientos_prestamo.findMany({ where: { compraId: { in: compras }, tipo_movimiento: "ABONO" }, select: { compraId: true } })).map((m) => m.compraId);
  const vigentes = await prisma.compra.findMany({ where: { compraId: { in: conAbono }, compraMovimiento: "Entrada" } });
  assert.ok(vigentes.length >= 1);
  for (const c of vigentes) assert.equal(Number(c.compraTotal), Number(c.compraPrecioQQ) * Number(c.compraCantidadQQ), `compra ${c.compraId}`);
});

test("el registro de compras trae flete y abono (suma de los movimientos enlazados)", async () => {
  const { json: c } = await crear({ compraAbono: 150, compraAbonoTipo: "PRESTAMO", compraFlete: 50, compraTotal: 1450 });
  const lista = await todo.pedir(`/api/compras?clienteID=${clienteID}`);
  assert.equal(lista.status, 200, lista.texto);
  const fila = lista.json.find((x) => x.compraId === c.compraId);
  assert.equal(Number(fila.compraAbono), 150);
  assert.equal(fila.compraAbonoTipo, "PRESTAMO");
  assert.equal(Number(fila.compraFlete), 50);
  assert.equal(Number(lista.json.find((x) => x.compraId === compras[0]).compraAbono), 0, "una compra sin abono muestra 0");
});

test("un abono nacido de una compra no se anula suelto desde Préstamos: hay que anular la compra", async () => {
  const m = await prisma.movimientos_prestamo.findFirst({ where: { compraId: compras.at(-1), tipo_movimiento: "ABONO" } });
  const antes = await capPrestamo();
  const r = await todo.pedir(`/api/prestamos/movimiento/${m.MovimientoId}`, { method: "DELETE" });
  assert.equal(r.status, 400, r.texto);
  assert.match(r.json.error, new RegExp(`compra #${compras.at(-1)}`));
  assert.equal(await capPrestamo(), antes, "el abono sigue vigente");
});

test("la FK protege el enlace: no se puede borrar una compra que tiene abonos enlazados", async () => {
  const m = await prisma.movimientos_prestamo.findFirst({ where: { compraId: compras.at(-1) } });
  await assert.rejects(prisma.compra.delete({ where: { compraId: m.compraId } }), /Foreign key|constraint/i);
});

// ───────── cliente 2: abono repartido entre dos préstamos y edición de compras con abono ─────────
const movsDe = (compraId) => prisma.movimientos_prestamo.findMany({ where: { compraId }, orderBy: { MovimientoId: "asc" } });
const estadoDe = async (p) => (await prisma.prestamos.findUnique({ where: { prestamoId: p.prestamoId } })).estado;
const capitalDe = async (p) => {
  const { _sum } = await prisma.movimientos_prestamo.aggregate({ where: { prestamo_id: p.prestamoId, tipo_movimiento: "ABONO" }, _sum: { monto: true } });
  return Number(p.monto) - Number(_sum.monto ?? 0);
};
const compra2 = (extra = {}) => crear({ clienteID: cliente2ID, ...extra });
let repartida; // compra con abono repartido; la usan las pruebas siguientes

test("ABONO REPARTIDO: un abono mayor que el primer préstamo se reparte del más antiguo al más nuevo, todo enlazado a la compra", async () => {
  const r = await compra2({ compraAbono: 600, compraAbonoTipo: "PRESTAMO" });
  assert.equal(r.status, 201, r.texto);
  repartida = r.json.compraId;
  const movs = await movsDe(repartida);
  assert.deepEqual(movs.map((m) => [m.prestamo_id, Number(m.monto), m.tipo_movimiento]), [
    [prestamoA.prestamoId, 300, "ABONO"],
    [prestamoB.prestamoId, 300, "ABONO"],
  ], "un movimiento por cada préstamo tocado");
  assert.ok(movs.every((m) => m.compraId === repartida), "todos apuntan a la misma compra por ID");
  assert.equal(await estadoDe(prestamoA), "COMPLETADO", "el más antiguo quedó pagado");
  assert.equal(await estadoDe(prestamoB), "ACTIVO");
  assert.equal(await capitalDe(prestamoB), 200);
  const lista = (await todo.pedir(`/api/compras?clienteID=${cliente2ID}`)).json;
  assert.equal(Number(lista.find((x) => x.compraId === repartida).compraAbono), 600, "el registro suma los dos movimientos");
});

test("EDITAR compra con abono repartido: cambiar cantidad, precio y flete mantiene el abono y ajusta el inventario", async () => {
  const antes = await saldo(producto.productID);
  const r = await todo.pedir(`/api/compras/${repartida}`, {
    method: "PUT",
    body: cuerpo({ clienteID: cliente2ID, compraCantidadQQ: 3, compraPrecioQQ: 750, compraFlete: 100, compraTotal: 2150 }),
  });
  assert.equal(r.status, 200, r.texto);
  assert.equal(Number(r.json.compraTotal), 2150);
  assert.equal(Number(r.json.compraFlete), 100);
  assert.equal(await saldo(producto.productID), antes + 1, "entró 1 QQ más");
  const movs = await movsDe(repartida);
  assert.equal(movs.reduce((s, m) => s + Number(m.monto), 0), 600, "el abono no cambió");
  assert.ok(movs.every((m) => m.tipo_movimiento === "ABONO"));
  assert.equal(await capitalDe(prestamoA), 0);
  assert.equal(await capitalDe(prestamoB), 200);
});

test("EDITAR compra con abono: cambiar de cliente se rechaza y nada cambia", async () => {
  const r = await todo.pedir(`/api/compras/${repartida}`, { method: "PUT", body: cuerpo({ clienteID, compraCantidadQQ: 3, compraPrecioQQ: 750, compraFlete: 100, compraTotal: 2150 }) });
  assert.equal(r.status, 400, r.texto);
  assert.match(r.json.error, /cambiar el cliente/i);
  const c = await prisma.compra.findUnique({ where: { compraId: repartida } });
  assert.equal(c.clienteID, cliente2ID, "la compra sigue con su cliente");
  assert.equal((await movsDe(repartida)).length, 2, "los abonos siguen en las deudas del cliente original");
  assert.equal(await capitalDe(prestamoB), 200);
});

test("EDITAR compra con abono: un total menor que el abono se rechaza; uno igual al abono se acepta", async () => {
  const mal = await todo.pedir(`/api/compras/${repartida}`, { method: "PUT", body: cuerpo({ clienteID: cliente2ID, compraTotal: 599, compraPrecioQQ: 300 }) });
  assert.equal(mal.status, 400, mal.texto);
  assert.match(mal.json.error, /abono/i);
  const justo = await todo.pedir(`/api/compras/${repartida}`, { method: "PUT", body: cuerpo({ clienteID: cliente2ID, compraTotal: 600, compraPrecioQQ: 300 }) });
  assert.equal(justo.status, 200, justo.texto);
  assert.equal((await movsDe(repartida)).reduce((s, m) => s + Number(m.monto), 0), 600);
});

test("ANULAR compra editada con abono repartido: se anulan los dos movimientos y las dos deudas se restablecen", async () => {
  const r = await todo.pedir(`/api/compras/${repartida}`, { method: "DELETE" });
  assert.equal(r.status, 200, r.texto);
  const movs = await movsDe(repartida);
  assert.equal(movs.length, 2);
  assert.ok(movs.every((m) => m.tipo_movimiento === "ANULADO"), "ambos movimientos anulados");
  assert.equal(await estadoDe(prestamoA), "ACTIVO", "el préstamo que estaba pagado vuelve a activo");
  assert.equal(await capitalDe(prestamoA), 300);
  assert.equal(await capitalDe(prestamoB), 500);
  assert.equal((await todo.pedir(`/api/compras/${repartida}`, { method: "PUT", body: cuerpo({ clienteID: cliente2ID }) })).status, 400, "una compra anulada no se edita");
});

test("EDITAR compra sin abono: sí puede cambiar de cliente (el bloqueo es solo con abono)", async () => {
  const { json: c } = await compra2();
  const r = await todo.pedir(`/api/compras/${c.compraId}`, { method: "PUT", body: cuerpo({ clienteID }) });
  assert.equal(r.status, 200, r.texto);
  assert.equal((await prisma.compra.findUnique({ where: { compraId: c.compraId } })).clienteID, clienteID);
});
