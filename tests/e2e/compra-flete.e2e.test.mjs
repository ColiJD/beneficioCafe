// COMPRA CON FLETE: el cobro por flete se guarda aparte y ya viene descontado del total a pagar.
// Borra por ID exacto las compras que crea y devuelve al inventario lo que sumaron.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../setup/db.mjs";
import { usuarioConPermisos, borrarUsuariosDePrueba, borrarCompras } from "./helpers.mjs";

let u, clienteID, uva;
const compras = [];

before(async () => {
  u = await usuarioConPermisos("FLETE", [["compras", "crear,editar"]]);
  clienteID = (await prisma.cliente.findFirst({ select: { clienteID: true } })).clienteID;
  uva = await prisma.producto.findFirst({ where: { productName: "Cafe Uva Maduro a 620" } }); // tiene inventario real: no se crea una fila nueva
});
after(async () => {
  await borrarCompras(compras); // quita la compra y su movimiento
  // cada compra de prueba sumó 2 QQ y 2 sacos al inventario del producto: se devuelven
  if (compras.length) await prisma.inventariocliente.updateMany({ where: { productoID: uva.productID }, data: { cantidadQQ: { decrement: 2 * compras.length }, cantidadSacos: { decrement: 2 * compras.length } } });
  await borrarUsuariosDePrueba();
  await prisma.$disconnect();
});

// 2 QQ oro a L 4,000 = 8,000; rebaja Uva de 100 por QQ = 200 → 7,800 antes del flete
const cuerpo = (extra = {}) => ({
  clienteID, compraTipoCafe: uva.productID, compraTipoDocumento: "Contado", compraPrecioQQ: 4000, compraCantidadQQ: 2,
  compraTotalSacos: 2, compraRetencio: 1.92, compraEn: "Compra Directa", compraDescripcion: "QA flete", compraTotal: 7800, ...extra,
});
const crear = async (extra) => {
  const r = await u.pedir("/api/compras", { method: "POST", body: cuerpo(extra) });
  if (r.status === 201) compras.push(r.json.compraId);
  return r;
};

test("una compra sin flete guarda 0", async () => {
  const r = await crear();
  assert.equal(r.status, 201, r.texto);
  assert.equal(Number(r.json.compraFlete), 0);
  assert.equal(Number(r.json.compraTotal), 7800);
});

test("el flete se guarda aparte y el total a pagar ya viene descontado", async () => {
  const r = await crear({ compraFlete: 300, compraTotal: 7500 });
  assert.equal(r.status, 201, r.texto);
  assert.equal(Number(r.json.compraFlete), 300);
  assert.equal(Number(r.json.compraTotal), 7500);
  const leida = await u.pedir(`/api/compras/${r.json.compraId}`);
  assert.equal(Number(leida.json.compraFlete), 300, "al editar se recupera el flete");
});

test("se puede cambiar el flete al editar la compra", async () => {
  const { json: c } = await crear({ compraFlete: 100, compraTotal: 7700 });
  const r = await u.pedir(`/api/compras/${c.compraId}`, { method: "PUT", body: cuerpo({ compraFlete: 250, compraTotal: 7550 }) });
  assert.equal(r.status, 200, r.texto);
  const leida = await u.pedir(`/api/compras/${c.compraId}`);
  assert.equal(Number(leida.json.compraFlete), 250);
  assert.equal(Number(leida.json.compraTotal), 7550);
});

test("flete negativo o mayor que el pago por el café se rechaza", async () => {
  assert.equal((await crear({ compraFlete: -50 })).status, 400, "negativo");
  assert.equal((await crear({ compraFlete: "abc" })).status, 400, "no numérico");
  assert.equal((await crear({ compraFlete: 9000, compraTotal: -1200 })).status, 400, "deja el pago en negativo");
});
