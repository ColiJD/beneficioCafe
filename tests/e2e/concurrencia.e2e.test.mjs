// REGRESIÓN de concurrencia: dos transacciones simultáneas que juntas superan el saldo → solo pasa una
// y el inventario nunca queda negativo. Usa un contrato y una secadora de prueba; al final borra todo
// lo creado y deja el saldo como estaba.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, conciliacionInventario } from "../setup/db.mjs";
import { usuarioConPermisos, borrarUsuariosDePrueba, saldo } from "./helpers.mjs";

const SUFIJO = Date.now();
let op, prod, saldosAntes, ultimoMov, contrato, secadora, contratoChico, contratoEntrada;

before(async () => {
  op = await usuarioConPermisos("CONCURRENCIA", [
    ["entregaContratoSalida", "crear"], ["reg-entregaContratoSalida", "editar"],
    ["entregaContratos", "crear"], ["reg-entregaContratos", "editar"], ["secado", "crear"],
  ]);
  const invs = await prisma.inventariocliente.findMany({ orderBy: { cantidadQQ: "desc" } });
  prod = invs[0].productoID;
  saldosAntes = Object.fromEntries(invs.map((i) => [i.productoID, Number(i.cantidadQQ)]));
  ultimoMov = (await prisma.movimientoinventario.aggregate({ _max: { movimientoID: true } }))._max.movimientoID;
  const comprador = await prisma.compradores.findFirst({ select: { compradorId: true } });
  contrato = await prisma.contratoSalida.create({
    data: {
      compradorID: comprador.compradorId, contratoTipoCafe: prod, contratoFecha: new Date(),
      contratoCantidadQQ: 100000, contratoPrecio: 1, contratoTotalLps: 100000,
      contratoMovimiento: "Salida", contratoDescripcion: "QA prueba automática", estado: "Pendiente",
    },
  });
  secadora = await prisma.secadora.create({ data: { nombre: `QA_SECADORA_${SUFIJO}` } });
  // Contratos de 1 QQ: el inventario alcanza de sobra, lo que limita es lo pactado en el contrato.
  contratoChico = await prisma.contratoSalida.create({
    data: {
      compradorID: comprador.compradorId, contratoTipoCafe: prod, contratoFecha: new Date(),
      contratoCantidadQQ: 1, contratoPrecio: 1, contratoTotalLps: 1,
      contratoMovimiento: "Salida", contratoDescripcion: "QA prueba automática", estado: "Pendiente",
    },
  });
  const cliente = await prisma.cliente.findFirst({ select: { clienteID: true } });
  contratoEntrada = await prisma.contrato.create({
    data: {
      contratoclienteID: cliente.clienteID, contratoTipoCafe: prod, contratoFecha: new Date(),
      contratoCantidadQQ: 1, contratoPrecio: 1, contratoTotalLps: 1,
      contratoMovimiento: "Entrada", contratoDescripcion: "QA prueba automática", estado: "Pendiente",
    },
  });
});

after(async () => {
  const salidas = [contrato.contratoID, contratoChico.contratoID];
  const detEntrada = await prisma.detallecontrato.findMany({ where: { contratoID: contratoEntrada.contratoID }, select: { detalleID: true } });
  await prisma.movimientoinventario.deleteMany({
    where: {
      movimientoID: { gt: ultimoMov },
      OR: [
        { referenciaTipo: { in: ["Entrega Contrato Salida", "Edición Entrega Contrato (Inc)", "Edición Entrega Contrato (Dec)"] }, referenciaID: { in: salidas } },
        { referenciaTipo: { in: detEntrada.map((d) => `EntregaContrato #${d.detalleID}`) } },
      ],
    },
  });
  await prisma.cierrecontrato.deleteMany({ where: { contratoID: contratoEntrada.contratoID } });
  await prisma.detallecontrato.deleteMany({ where: { contratoID: contratoEntrada.contratoID } });
  await prisma.contrato.delete({ where: { contratoID: contratoEntrada.contratoID } });
  await prisma.detalleContratoSalida.deleteMany({ where: { contratoID: { in: salidas } } });
  await prisma.contratoSalida.delete({ where: { contratoID: contratoChico.contratoID } });
  const secados = await prisma.secado.findMany({ where: { secadoraId: secadora.secadoraId }, select: { secadoId: true } });
  await prisma.movimientoinventario.deleteMany({
    where: {
      movimientoID: { gt: ultimoMov },
      OR: [
        { referenciaTipo: "Entrega Contrato Salida", referenciaID: contrato.contratoID },
        { referenciaTipo: { in: secados.map((s) => `Inicio de Secado #${s.secadoId}`) } },
      ],
    },
  });
  await prisma.secado.deleteMany({ where: { secadoraId: secadora.secadoraId } });
  await prisma.secadora.delete({ where: { secadoraId: secadora.secadoraId } });
  await prisma.contratoSalida.delete({ where: { contratoID: contrato.contratoID } });
  for (const [productoID, cantidadQQ] of Object.entries(saldosAntes))
    await prisma.inventariocliente.update({ where: { productoID: Number(productoID) }, data: { cantidadQQ } });
  await borrarUsuariosDePrueba();
  await prisma.$disconnect();
});

/** Lanza dos peticiones a la vez por el 60 % del saldo cada una. */
async function dosALaVez(ruta, cuerpo) {
  const s = await saldo(prod);
  const cada = +(s * 0.6).toFixed(2);
  const rs = await Promise.all([1, 2].map(() => op.pedir(ruta, { method: "POST", body: cuerpo(cada) })));
  return { s, cada, rs, estados: rs.map((r) => r.status).sort() };
}

test("REGRESIÓN: dos entregas de contrato de salida simultáneas: solo pasa una", async () => {
  const { s, cada, rs, estados } = await dosALaVez("/api/contratoSalida/entregar", (qq) => ({
    contratoID: contrato.contratoID, tipoCafe: prod, cantidadQQ: qq, precioQQ: 1, descripcion: "QA prueba automática",
  }));
  assert.deepEqual(estados, [201, 400], rs.map((r) => r.texto.slice(0, 150)).join(" | "));
  assert.match(rs.find((r) => r.status === 400).json.error, /insuficiente/i);
  assert.equal(await saldo(prod), +(s - cada).toFixed(2));
});

test("REGRESIÓN: dos inicios de secado simultáneos: solo pasa uno", async () => {
  const { s, cada, rs, estados } = await dosALaVez("/api/secado", (qq) => ({
    secadoraId: secadora.secadoraId, productoId: prod, cantidadEntradaQQ: qq, observaciones: "QA prueba automática",
  }));
  assert.deepEqual(estados, [201, 400], rs.map((r) => r.texto.slice(0, 150)).join(" | "));
  assert.equal(await saldo(prod), +(s - cada).toFixed(2));
  assert.equal(await prisma.secado.count({ where: { secadoraId: secadora.secadoraId } }), 1, "el secado rechazado no debe quedar guardado");
});

/** Dos peticiones idénticas a la vez. */
const dos = (ruta, method, body) => Promise.all([1, 2].map(() => op.pedir(ruta, { method, body })));

test("REGRESIÓN: dos entregas simultáneas no superan lo pactado en el contrato de salida", async () => {
  const rs = await dos("/api/contratoSalida/entregar", "POST", {
    contratoID: contratoChico.contratoID, tipoCafe: prod, cantidadQQ: 0.6, precioQQ: 1, descripcion: "QA prueba automática",
  });
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 400], rs.map((r) => r.texto.slice(0, 150)).join(" | "));
  assert.match(rs.find((r) => r.status === 400).json.error, /saldo disponible/);
  const entregado = await prisma.detalleContratoSalida.aggregate({ _sum: { cantidadQQ: true }, where: { contratoID: contratoChico.contratoID } });
  assert.equal(Number(entregado._sum.cantidadQQ), 0.6);
});

test("REGRESIÓN: dos ediciones simultáneas de la misma entrega de salida ajustan el inventario una sola vez", async () => {
  const entrega = await prisma.detalleContratoSalida.findFirst({ where: { contratoID: contratoChico.contratoID } });
  const s0 = await saldo(prod);
  const rs = await dos(`/api/contratoSalida/detallecontrato/${entrega.detalleID}`, "PUT", {
    contratoID: contratoChico.contratoID, cantidadQQ: 0.9, observaciones: "QA prueba automática",
  });
  assert.deepEqual(rs.map((r) => r.status), [200, 200], rs.map((r) => r.texto.slice(0, 150)).join(" | "));
  assert.equal(await saldo(prod), +(s0 - 0.3).toFixed(2), "el inventario debe bajar solo 0.3 (de 0.6 a 0.9)");
  assert.equal(Number((await prisma.detalleContratoSalida.findUnique({ where: { detalleID: entrega.detalleID } })).cantidadQQ), 0.9);
});

test("REGRESIÓN: dos entregas simultáneas no superan lo pactado en el contrato de entrada", async () => {
  const rs = await dos("/api/contratos/entregar", "POST", {
    contratoID: contratoEntrada.contratoID, tipoCafe: prod, cantidadQQ: 0.6, precioQQ: 1, totalSacos: 0, descripcion: "QA prueba automática",
  });
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 400], rs.map((r) => r.texto.slice(0, 150)).join(" | "));
  assert.match(rs.find((r) => r.status === 400).json.error, /saldo disponible/);
});

test("REGRESIÓN: dos ediciones simultáneas de la misma entrega de entrada ajustan el inventario una sola vez", async () => {
  const entrega = await prisma.detallecontrato.findFirst({ where: { contratoID: contratoEntrada.contratoID } });
  const s0 = await saldo(prod);
  const rs = await dos(`/api/contratos/detallecontrato/${entrega.detalleID}`, "PUT", {
    contratoID: contratoEntrada.contratoID, cantidadQQ: 0.9, observaciones: "QA prueba automática",
  });
  assert.deepEqual(rs.map((r) => r.status), [200, 200], rs.map((r) => r.texto.slice(0, 150)).join(" | "));
  assert.equal(await saldo(prod), +(s0 + 0.3).toFixed(2), "el inventario debe subir solo 0.3 (de 0.6 a 0.9)");
});

test("REGRESIÓN: ningún inventario quedó negativo y todo cuadra con el historial", async () => {
  assert.equal(await prisma.inventariocliente.count({ where: { cantidadQQ: { lt: 0 } } }), 0);
  const descuadres = (await conciliacionInventario()).filter((f) => Math.abs(Number(f.saldo) - Number(f.historial)) > 0.005);
  assert.deepEqual(descuadres, []);
});
