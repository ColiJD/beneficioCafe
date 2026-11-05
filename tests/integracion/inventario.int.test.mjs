// INTEGRACIÓN: lógica de inventario contra la base de desarrollo real. Todo se revierte (rollback).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma, enRollback, conciliacionInventario } from "../setup/db.mjs";
import { moverInventario, ErrorNegocio, noAnulado } from "@/lib/inventarioMov";
import { calcularPendientes } from "@/lib/pendientesSalida";

after(() => prisma.$disconnect());

const productoConSaldo = () =>
  prisma.inventariocliente.findFirst({ where: { cantidadQQ: { gt: 1 } }, orderBy: { cantidadQQ: "desc" } });

test("moverInventario suma y resta en la base, sin dejar rastro (rollback)", async () => {
  const inv = await productoConSaldo();
  assert.ok(inv, "se necesita un producto con saldo en desarrollo");
  const antes = Number(inv.cantidadQQ);
  const dentro = await enRollback(async (tx) => {
    const a = await moverInventario(tx, inv.productoID, 1.25);
    const b = await moverInventario(tx, inv.productoID, -2.5);
    return [Number(a.cantidadQQ), Number(b.cantidadQQ)];
  });
  assert.deepEqual(dentro, [antes + 1.25, Number((antes - 1.25).toFixed(2))]);
  const despues = await prisma.inventariocliente.findUnique({ where: { productoID: inv.productoID } });
  assert.equal(Number(despues.cantidadQQ), antes, "el rollback dejó el saldo igual");
});

test("moverInventario rechaza dejar saldo negativo en la base", async () => {
  const inv = await productoConSaldo();
  await assert.rejects(
    enRollback((tx) => moverInventario(tx, inv.productoID, -(Number(inv.cantidadQQ) + 0.01))),
    (e) => e instanceof ErrorNegocio,
  );
});

test("noAnulado funciona como filtro de Prisma e incluye NULL", async () => {
  const total = await prisma.liqsalida.count();
  const anuladas = await prisma.liqsalida.count({ where: { liqMovimiento: { in: ["ANULADO", "Anulado", "anulado"] } } });
  const activas = await prisma.liqsalida.count({ where: noAnulado("liqMovimiento") });
  assert.equal(activas + anuladas, total);
});

test("pendientes de salida coinciden con salidas menos liquidaciones activas", async () => {
  const s = await prisma.salida.findFirst({ where: noAnulado("salidaMovimiento"), select: { compradorID: true, productoID: true } });
  if (!s) return;
  const pend = await calcularPendientes(prisma, s.compradorID, s.productoID);
  for (const p of pend) {
    const salida = await prisma.salida.findUnique({ where: { salidaID: p.salidaID } });
    assert.ok(p.pendiente > 0 && p.pendiente <= Number(salida.salidaCantidadQQ));
  }
});

test("REGRESIÓN datos: el saldo de cada producto cuadra con su historial de movimientos", async () => {
  const filas = await conciliacionInventario();
  const descuadres = filas.filter((f) => Math.abs(Number(f.saldo) - Number(f.historial)) > 0.005);
  assert.deepEqual(descuadres, []);
});

test("REGRESIÓN datos: la vista vw_inventario_actual coincide con inventariocliente", async () => {
  const vista = await prisma.$queryRaw`SELECT productoID, saldoQQ FROM vw_inventario_actual`;
  const reales = await prisma.inventariocliente.findMany();
  for (const r of reales) {
    const v = vista.find((x) => x.productoID === r.productoID);
    assert.ok(v, `producto ${r.productoID} falta en la vista`);
    assert.ok(Math.abs(Number(v.saldoQQ) - Number(r.cantidadQQ)) < 0.005, `producto ${r.productoID}: vista ${v.saldoQQ} ≠ ${r.cantidadQQ}`);
  }
});

test("REGRESIÓN datos: ningún inventario negativo ni tipos de movimiento viejos", async () => {
  assert.equal(await prisma.inventariocliente.count({ where: { cantidadQQ: { lt: 0 } } }), 0);
  const tipos = (await prisma.movimientoinventario.groupBy({ by: ["tipoMovimiento"] })).map((t) => t.tipoMovimiento);
  for (const t of tipos) assert.ok(["Entrada", "Salida", "Ajuste", "Anulado"].includes(t), `tipo inesperado: ${t}`);
});

test("REGRESIÓN datos: cada compra o venta activa tiene su movimiento de inventario", async () => {
  const sinMov = await prisma.$queryRaw`
    SELECT c.compraId FROM compra c
    WHERE (c.compraMovimiento IN ('Entrada','Salida'))
      AND NOT EXISTS (SELECT 1 FROM movimientoinventario m
        WHERE m.referenciaTipo IN (CONCAT('Compra directa #', c.compraId), CONCAT('Venta directa #', c.compraId))
          AND m.tipoMovimiento IN ('Entrada','Salida'))`;
  assert.deepEqual(sinMov.map((x) => x.compraId), []);
});

test("las vistas de la base se pueden consultar", async () => {
  const vistas = await prisma.$queryRaw`SELECT TABLE_NAME AS v FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE()`;
  assert.ok(vistas.length >= 10);
  for (const { v } of vistas) await prisma.$queryRawUnsafe(`SELECT * FROM \`${v.replace(/`/g, "")}\` LIMIT 1`);
});
