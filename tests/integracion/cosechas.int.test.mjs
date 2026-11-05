// COSECHAS: ninguna transacción se fecha dentro de una cosecha cerrada, y el cierre/apertura guarda el periodo.
// Usa una cosecha cerrada temporal (QA_TEMPORAL) y, para el ciclo de cierre, cierra y reabre la actual; todo se restaura al final.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { verificarBaseDesarrollo } from "../setup/db.mjs";

let prisma, base, cosecha, inv, ErrorNegocio, original;
const hoy = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const manana = () => new Date(Date.now() - 6 * 3600 * 1000 + 86400000).toISOString().slice(0, 10);

before(async () => {
  await verificarBaseDesarrollo();
  process.env.DATABASE_URL += (process.env.DATABASE_URL.includes("?") ? "&" : "?") + "connection_limit=3";
  ({ default: prisma } = await import("@/lib/prisma"));
  cosecha = await import("@/lib/cosecha");
  ({ ErrorNegocio } = await import("@/lib/inventarioMov"));
  base = new PrismaClient();
  original = await base.cosecha.findFirst({ where: { estado: "Abierta" } });
  assert.ok(original, "la base de desarrollo debe tener una cosecha abierta");
  await base.cosecha.create({ data: { nombre: "QA_TEMPORAL", fechaInicio: new Date("2025-01-01"), fechaFin: new Date("2025-12-31"), estado: "Cerrada" } });
});
after(async () => {
  await base.cosecha.deleteMany({ where: { nombre: { in: ["QA_TEMPORAL", "QA_SIGUIENTE"] } } });
  await base.cosecha_inventario.deleteMany({ where: { cosechaID: original.cosechaID } });
  await base.cosecha.update({ where: { cosechaID: original.cosechaID }, data: { estado: "Abierta", fechaFin: null, notas: null, cerradaEn: null, cerradaPor: null } });
  await base.$disconnect();
});

const bloqueada = (fn, re) => assert.rejects(fn, (e) => e instanceof ErrorNegocio && re.test(e.message));

test("no se crea ni se mueve una transacción a una fecha de cosecha cerrada", async () => {
  await bloqueada(() => prisma.compra.create({ data: { compraFecha: new Date("2025-06-15") } }), /cosecha cerrada QA_TEMPORAL/);
  const c = await base.compra.findFirst({ select: { compraId: true, compraFecha: true } });
  await bloqueada(() => prisma.compra.update({ where: { compraId: c.compraId }, data: { compraFecha: new Date("2025-06-15") } }), /cosecha cerrada/);
  await bloqueada(() => prisma.$transaction((tx) => tx.compra.update({ where: { compraId: c.compraId }, data: { compraFecha: new Date("2025-03-01") } })), /cosecha cerrada/);
  await prisma.compra.update({ where: { compraId: c.compraId }, data: { compraFecha: c.compraFecha } }); // su fecha actual sí se permite
});

test("una cosecha cerrada queda congelada: no se modifica, anula ni elimina; el estado de un documento viejo sí se recalcula", async () => {
  // todo dentro de transacciones que se revierten: si la guarda fallara, no queda nada escrito
  class Revertir extends Error {}
  const resultado = async (fn) => {
    try { await prisma.$transaction(async (tx) => { await fn(tx); throw new Revertir(); }, { timeout: 20000 }); }
    catch (e) { return e instanceof Revertir ? "permitido" : e instanceof ErrorNegocio ? "bloqueado" : `error: ${e.message}`; }
  };
  await base.cosecha.update({ where: { nombre: "QA_TEMPORAL" }, data: { fechaInicio: new Date("2026-09-01"), fechaFin: new Date("2026-09-30") } });
  (await import("@/lib/cosechaGuard")).invalidarCosechas(); // el cambio se hizo directo en la base, no por cosecha.js
  const vieja = await base.compra.findFirst({ where: { compraFecha: { lt: new Date("2026-10-01") } }, select: { compraId: true } });
  const nueva = await base.compra.findFirst({ where: { compraFecha: { gte: new Date("2026-10-01") } }, select: { compraId: true, compraDescripcion: true } });
  const contrato = await base.contrato.findFirst({ where: { contratoFecha: { lt: new Date("2026-10-01") }, estado: { not: "Anulado" } }, select: { contratoID: true, estado: true } });
  assert.ok(vieja && nueva && contrato, "la base de desarrollo debe tener datos de septiembre y de octubre en adelante");
  assert.equal(await resultado((tx) => tx.compra.update({ where: { compraId: vieja.compraId }, data: { compraDescripcion: "x" } })), "bloqueado");
  assert.equal(await resultado((tx) => tx.compra.update({ where: { compraId: vieja.compraId }, data: { compraMovimiento: "Anulado" } })), "bloqueado");
  assert.equal(await resultado((tx) => tx.compra.delete({ where: { compraId: vieja.compraId } })), "bloqueado");
  assert.equal(await resultado((tx) => tx.compra.deleteMany({ where: { compraId: vieja.compraId } })), "bloqueado");
  assert.equal(await resultado((tx) => tx.compra.update({ where: { compraId: nueva.compraId }, data: { compraDescripcion: nueva.compraDescripcion } })), "permitido");
  assert.equal(await resultado((tx) => tx.contrato.update({ where: { contratoID: contrato.contratoID }, data: { estado: contrato.estado } })), "permitido");
  assert.equal(await resultado((tx) => tx.contrato.update({ where: { contratoID: contrato.contratoID }, data: { contratoPrecio: 1 } })), "bloqueado");
  assert.equal(await resultado((tx) => tx.contrato.update({ where: { contratoID: contrato.contratoID }, data: { estado: "Anulado" } })), "bloqueado");
});

test("abrir y cerrar cosechas: reglas, foto del inventario y periodos sin traslape", async () => {
  await bloqueada(() => cosecha.abrirCosecha({ nombre: "QA_SIGUIENTE", fechaInicio: manana() }), /Ya hay una cosecha abierta/);
  await bloqueada(() => cosecha.cerrarCosecha({ fechaFin: "2099-01-01" }, 1), /futura/);
  await bloqueada(() => cosecha.cerrarCosecha({ fechaFin: "2000-01-01" }, 1), /anterior al inicio/);
  const cerrada = await cosecha.cerrarCosecha({ fechaFin: hoy(), notas: "QA" }, 1);
  assert.equal(cerrada.estado, "Cerrada");
  const filas = await base.inventariocliente.count();
  assert.equal(await base.cosecha_inventario.count({ where: { cosechaID: original.cosechaID } }), filas, "una fila de la foto por producto");
  await bloqueada(() => cosecha.abrirCosecha({ nombre: "QA_SIGUIENTE", fechaInicio: hoy() }), /después del cierre/);
  const nueva = await cosecha.abrirCosecha({ nombre: "QA_SIGUIENTE", fechaInicio: manana() });
  assert.equal(nueva.estado, "Abierta");
});
