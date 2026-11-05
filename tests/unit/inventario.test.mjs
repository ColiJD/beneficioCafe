// UNITARIAS: utilidades de inventario y de liquidación FIFO con una transacción simulada.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ErrorNegocio,
  redondear,
  esAnulado,
  noAnulado,
  moverInventario,
  respuestaError,
} from "@/lib/inventarioMov";
import { calcularPendientes, crearDetallesFIFO } from "@/lib/pendientesSalida";

/** tx falso con un solo producto en memoria. */
function txFalso(saldo) {
  const fila = { productoID: 1, cantidadQQ: saldo, cantidadSacos: 0 };
  return {
    fila,
    inventariocliente: {
      updateMany: async ({ where, data }) => {
        if (fila.cantidadQQ < where.cantidadQQ.gte) return { count: 0 };
        fila.cantidadQQ = redondear(fila.cantidadQQ + data.cantidadQQ.increment);
        return { count: 1 };
      },
      findUnique: async () => fila,
      upsert: async ({ update }) => {
        fila.cantidadQQ = redondear(fila.cantidadQQ + update.cantidadQQ.increment);
        return fila;
      },
    },
  };
}

test("redondear a 2 decimales sin error de coma flotante", () => {
  assert.equal(redondear(1.005), 1.01);
  assert.equal(redondear("2.345"), 2.35);
  assert.equal(redondear(0.1 + 0.2), 0.3);
});

test("esAnulado ignora mayúsculas y nulos", () => {
  assert.equal(esAnulado("Anulado"), true);
  assert.equal(esAnulado("ANULADO"), true);
  assert.equal(esAnulado(null), false);
  assert.equal(esAnulado("Entrada"), false);
});

test("noAnulado incluye los registros con estado NULL", () => {
  assert.deepEqual(noAnulado("x").OR[0], { x: null });
});

test("moverInventario suma y resta", async () => {
  const tx = txFalso(10);
  await moverInventario(tx, 1, 5);
  assert.equal(tx.fila.cantidadQQ, 15);
  await moverInventario(tx, 1, -15);
  assert.equal(tx.fila.cantidadQQ, 0);
});

test("moverInventario no deja el inventario en negativo", async () => {
  const tx = txFalso(3);
  await assert.rejects(moverInventario(tx, 1, -3.01), (e) => e instanceof ErrorNegocio && /insuficiente/.test(e.message));
  assert.equal(tx.fila.cantidadQQ, 3);
});

test("respuestaError: error de negocio → 400 con mensaje; otro → 500 genérico", async () => {
  const r1 = respuestaError(new ErrorNegocio("Ya anulado"), "x");
  assert.equal(r1.status, 400);
  assert.deepEqual(await r1.json(), { error: "Ya anulado" });
  const errorOriginal = console.error;
  console.error = () => {};
  const r2 = respuestaError(new Error("SQL roto"), "Error al anular");
  console.error = errorOriginal;
  assert.equal(r2.status, 500);
  assert.deepEqual(await r2.json(), { error: "Error al anular" }); // no expone el detalle interno
  const r3 = respuestaError(Object.assign(new Error("deadlock"), { code: "P2034" }), "x");
  assert.equal(r3.status, 409);
});

test("calcularPendientes descuenta lo liquidado, ignora anulados y la liquidación excluida", async () => {
  const tx = {
    salida: {
      findMany: async () => [
        { salidaID: 1, salidaCantidadQQ: 10, detalleliqsalida: [
          { cantidadQQ: 4, movimiento: "Salida", liqSalidaID: 7 },
          { cantidadQQ: 6, movimiento: "Anulado", liqSalidaID: 8 },
        ] },
        { salidaID: 2, salidaCantidadQQ: 5, detalleliqsalida: [{ cantidadQQ: 5, movimiento: "Salida", liqSalidaID: 9 }] },
      ],
    },
  };
  assert.deepEqual(await calcularPendientes(tx, 1, 1), [{ salidaID: 1, pendiente: 6 }]);
  assert.deepEqual(await calcularPendientes(tx, 1, 1, 9), [
    { salidaID: 1, pendiente: 6 },
    { salidaID: 2, pendiente: 5 },
  ]);
});

test("crearDetallesFIFO reparte en orden y no excede lo pedido", async () => {
  const creados = [];
  const tx = { detalleliqsalida: { create: async ({ data }) => creados.push(data) } };
  await crearDetallesFIFO(tx, 3, [{ salidaID: 1, pendiente: 2.5 }, { salidaID: 2, pendiente: 4 }, { salidaID: 3, pendiente: 9 }], 5);
  assert.deepEqual(creados.map((d) => [d.salidaID, d.cantidadQQ]), [[1, 2.5], [2, 2.5]]);
});
