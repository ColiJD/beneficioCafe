// SERVICIO DE SECADO: recibir → terminar → cobrar (caja chica) o comprar parte del café (compra + inventario).
// Usa un cliente y un producto existentes; borra por ID exacto todo lo que crea (servicios, caja chica, compra, movimiento).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../setup/db.mjs";
import { usuarioConPermisos, borrarUsuariosDePrueba, borrarCompras, saldo } from "./helpers.mjs";

let u, lector, clienteID, producto, tarifa;
const creados = { servicios: [], caja: [], compras: [], inventario: [] }; // inventario: [productoID, qq, sacos] que la compra sumó
const api = (id) => `/api/servicio-secado${id ? "/" + id : ""}`;

before(async () => {
  u = await usuarioConPermisos("SERVSEC", [["servicio-secado", "crear,editar"]]);
  lector = await usuarioConPermisos("SERVSECLECTOR", [["servicio-secado", "ver"]]);
  clienteID = (await prisma.cliente.findFirst({ select: { clienteID: true } })).clienteID;
  producto = await prisma.producto.findFirst({ where: { productName: "Cafe Humedo" } });
  tarifa = Number((await prisma.cosecha.findFirst({ where: { estado: "Abierta" } })).tarifaSecadoQQ);
});
after(async () => {
  await borrarCompras(creados.compras);
  // borrarCompras quita la compra y su movimiento; el saldo que sumó al inventario se devuelve aquí
  for (const [productoID, qq, sacos] of creados.inventario)
    await prisma.inventariocliente.updateMany({ where: { productoID }, data: { cantidadQQ: { decrement: qq }, cantidadSacos: { decrement: sacos } } });
  if (creados.caja.length) await prisma.caja_chica.deleteMany({ where: { id: { in: creados.caja } } });
  if (creados.servicios.length) await prisma.servicio_secado.deleteMany({ where: { servicioID: { in: creados.servicios } } });
  await borrarUsuariosDePrueba();
  await prisma.$disconnect();
});

const recibir = async (extra = {}) => {
  const r = await u.pedir(api(), { method: "POST", body: { clienteID, productoID: producto.productID, pesoBruto: 1000, sacos: 10, humedadInicial: 40, ...extra } });
  if (r.status === 201) creados.servicios.push(r.json.servicioID);
  return r;
};
const terminar = (id) => u.pedir(api(id), { method: "PUT", body: { accion: "terminar", pesoBruto: 500, sacos: 10 } });

test("recibir calcula el cobro sobre los QQ oro que entran, con la tarifa de la cosecha", async () => {
  const r = await recibir();
  assert.equal(r.status, 201, r.texto);
  assert.equal(r.json.estado, "Recibido");
  assert.ok(Number(r.json.oroEntrada) > 0);
  assert.equal(Number(r.json.tarifaQQ), tarifa);
  assert.equal(Number(r.json.cobro), Math.round(Number(r.json.oroEntrada) * tarifa * 100) / 100);
});

test("solo servicio: terminar y cobrar; el pago entra a la caja chica y no toca el inventario", async () => {
  const antes = await saldo(producto.productID);
  const { json: s } = await recibir();
  const t = await terminar(s.servicioID);
  assert.equal(t.status, 200, t.texto);
  assert.equal(t.json.estado, "Seco");
  assert.ok(Number(t.json.oroSalida) > 0);
  assert.equal((await u.pedir(api(s.servicioID), { method: "PUT", body: { accion: "cobrar" } })).status, 400, "hay que elegir la forma de pago");
  const c = await u.pedir(api(s.servicioID), { method: "PUT", body: { accion: "cobrar", formaPago: "Efectivo" } });
  assert.equal(c.status, 200, c.texto);
  assert.equal(c.json.estado, "Pagado");
  creados.caja.push(c.json.cajaChicaId);
  const caja = await prisma.caja_chica.findUnique({ where: { id: c.json.cajaChicaId } });
  assert.equal(caja.tipo, "Entrada");
  assert.equal(Number(caja.monto), Number(s.cobro));
  assert.equal(await saldo(producto.productID), antes, "el inventario no debe cambiar");
  assert.equal((await u.pedir(api(s.servicioID), { method: "PUT", body: { accion: "cobrar", formaPago: "Efectivo" } })).status, 409, "no se cobra dos veces");
});

test("cobro mixto: solo la parte en efectivo entra a la caja chica", async () => {
  const { json: s } = await recibir();
  await terminar(s.servicioID);
  const cobro = Number(s.cobro);
  assert.equal((await u.pedir(api(s.servicioID), { method: "PUT", body: { accion: "cobrar", pagos: { efectivo: 1, transferencia: 1 } } })).status, 400, "los pagos deben sumar el cobro");
  const c = await u.pedir(api(s.servicioID), { method: "PUT", body: { accion: "cobrar", pagos: { efectivo: cobro - 500, cheque: 500 } } });
  assert.equal(c.status, 200, c.texto);
  assert.equal(c.json.formaPago, "Mixto");
  creados.caja.push(c.json.cajaChicaId);
  const caja = await prisma.caja_chica.findUnique({ where: { id: c.json.cajaChicaId } });
  assert.equal(caja.tipo, "Entrada");
  assert.equal(Number(caja.monto), cobro - 500);
});

test("pagado por transferencia o cheque: queda cobrado pero no entra a la caja chica", async () => {
  const { json: s } = await recibir();
  await terminar(s.servicioID);
  const c = await u.pedir(api(s.servicioID), { method: "PUT", body: { accion: "cobrar", formaPago: "Transferencia" } });
  assert.equal(c.status, 200, c.texto);
  assert.equal(c.json.estado, "Pagado");
  assert.equal(c.json.formaPago, "Transferencia");
  assert.equal(c.json.cajaChicaId, null);
});

test("vender: compra solo los QQ que se decidan, entra al inventario y se descuenta el cobro", async () => {
  const { json: s } = await recibir();
  const { json: seco } = await terminar(s.servicioID);
  const cafeSeco = await prisma.producto.findFirst({ where: { productName: "Cafe Seco" } });
  const antes = await saldo(cafeSeco.productID);
  const qq = Math.round(Number(seco.oroSalida) * 50) / 100; // la mitad
  assert.equal((await u.pedir(api(s.servicioID), { method: "PUT", body: { accion: "vender", qq: Number(seco.oroSalida) + 1, precioQQ: 4000 } })).status, 400, "no se compra más de lo secado");
  const neto = Math.round((qq * 4000 - Number(s.cobro)) * 100) / 100;
  assert.equal((await u.pedir(api(s.servicioID), { method: "PUT", body: { accion: "vender", qq, precioQQ: 4000 } })).status, 400, "hay que indicar cómo se paga");
  assert.equal((await u.pedir(api(s.servicioID), { method: "PUT", body: { accion: "vender", qq, precioQQ: 4000, pagos: { efectivo: neto + 1 } } })).status, 400, "los pagos deben sumar el neto");
  // Pago mixto: 1,000 por transferencia y el resto en efectivo
  const v = await u.pedir(api(s.servicioID), { method: "PUT", body: { accion: "vender", qq, precioQQ: 4000, pagos: { efectivo: Math.round((neto - 1000) * 100) / 100, transferencia: 1000, cheque: 0 } } });
  assert.equal(v.status, 200, v.texto);
  assert.equal(v.json.servicio.formaPago, "Mixto");
  assert.equal(Number(v.json.servicio.pagoTransferencia), 1000);
  creados.caja.push(v.json.servicio.cajaChicaId);
  const salida = await prisma.caja_chica.findUnique({ where: { id: v.json.servicio.cajaChicaId } });
  assert.equal(salida.tipo, "Salida", "el efectivo que se paga al cliente sale de la caja chica");
  assert.equal(Number(salida.monto), Math.round((neto - 1000) * 100) / 100);
  creados.compras.push(v.json.compra.compraId);
  creados.inventario.push([cafeSeco.productID, Number(v.json.compra.compraCantidadQQ), Number(v.json.compra.compraTotalSacos)]);
  assert.equal(v.json.servicio.estado, "Vendido");
  assert.equal(Number(v.json.compra.compraCantidadQQ), qq);
  assert.equal(v.json.neto, Math.round((qq * 4000 - Number(s.cobro)) * 100) / 100);
  assert.equal(Math.round((await saldo(cafeSeco.productID)) * 100), Math.round((antes + qq) * 100), "entran al inventario solo los QQ comprados");
});

test("anular solo antes de cobrar o vender; el lector no puede modificar", async () => {
  const { json: s } = await recibir();
  assert.equal((await lector.pedir(api(s.servicioID), { method: "PUT", body: { accion: "anular" } })).status, 403);
  assert.equal((await lector.pedir(api())).status, 200);
  const a = await u.pedir(api(s.servicioID), { method: "PUT", body: { accion: "anular" } });
  assert.equal(a.json.estado, "Anulado");
  assert.equal((await u.pedir(api(s.servicioID), { method: "PUT", body: { accion: "terminar", pesoBruto: 1 } })).status, 409);
});

test("datos inválidos se rechazan", async () => {
  assert.equal((await u.pedir(api(), { method: "POST", body: { clienteID, productoID: producto.productID, pesoBruto: -5 } })).status, 400);
  assert.equal((await u.pedir(api(), { method: "POST", body: { productoID: producto.productID, pesoBruto: 100 } })).status, 400);
  assert.equal((await u.pedir(api(1), { method: "PUT", body: { accion: "borrar" } })).status, 400);
});

test("ver los registros exige permiso y los filtros por estado, cliente, fecha y texto funcionan", async () => {
  const sinPermiso = await usuarioConPermisos("SERVSECNADA", []);
  assert.equal((await sinPermiso.pedir(api())).status, 403, "sin permiso no se ve ni la lista");
  assert.equal((await sinPermiso.pedir(api() + "?tarifa=1")).status, 403);

  const { json: s } = await recibir();
  const lista = async (q) => (await lector.pedir(api() + "?" + q)).json;
  assert.ok((await lista(`estado=Recibido&clienteID=${clienteID}`)).some((f) => f.servicioID === s.servicioID));
  assert.ok((await lista("estado=Pagado,Vendido")).every((f) => ["Pagado", "Vendido"].includes(f.estado)));
  assert.ok((await lista(`q=${s.servicioID}`)).some((f) => f.servicioID === s.servicioID), "busca por número de servicio");
  assert.ok((await lista("desde=2999-01-01T00:00:00-06:00")).length === 0, "fecha futura sin resultados");
  assert.ok((await lista(`desde=2000-01-01T00:00:00-06:00&hasta=2999-01-01T00:00:00-06:00&clienteID=${clienteID}`)).length >= 1);
  assert.ok((await lista("clienteID=0&estado=Inexistente")).length === 0);
});

test("cada estado exige su permiso: Activos con el del módulo; Pagado, Vendido y Anulado con el suyo", async () => {
  const soloPagados = await usuarioConPermisos("SERVSECPAGADOS", [["reg-servicio-pagado", "ver"]]);
  const { json: a } = await recibir(); // Recibido: lo ve quien tiene el permiso principal, no quien solo ve pagados
  const { json: b } = await recibir();
  await terminar(b.servicioID);
  await u.pedir(api(b.servicioID), { method: "PUT", body: { accion: "cobrar", formaPago: "Transferencia" } });

  // Solo con el permiso de pagados: entra a la pantalla, ve los Pagado y nada más; no puede operar
  const lista = await soloPagados.pedir(api());
  assert.equal(lista.status, 200);
  assert.ok(lista.json.length > 0 && lista.json.every((f) => f.estado === "Pagado"));
  assert.ok(lista.json.some((f) => f.servicioID === b.servicioID));
  assert.ok(!lista.json.some((f) => f.servicioID === a.servicioID));
  assert.deepEqual((await soloPagados.pedir(api() + "?estado=Recibido,Seco,Vendido,Anulado")).json, [], "pedir otros estados no los muestra");
  assert.equal((await soloPagados.pedir(api(), { method: "POST", body: { clienteID, productoID: producto.productID, pesoBruto: 100 } })).status, 403);
  assert.equal((await soloPagados.pedir(api(a.servicioID), { method: "PUT", body: { accion: "anular" } })).status, 403);

  // Con el permiso principal se ven los Activos pero no los Pagado
  const principal = (await lector.pedir(api())).json;
  assert.ok(principal.some((f) => f.servicioID === a.servicioID));
  assert.ok(principal.every((f) => ["Recibido", "Seco"].includes(f.estado)));
  assert.ok(Object.hasOwn(lista.json[0], "compra"), "el comprobante no depende del permiso de Compras");
});
