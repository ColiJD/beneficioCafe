import { test } from "node:test";
import assert from "node:assert/strict";
import { funcionHabilitada } from "@/lib/empresa-cliente";

test("funcionHabilitada: null = todas las funciones", () => {
  assert.equal(funcionHabilitada(null, "anticiposCompradores"), true);
  assert.equal(funcionHabilitada(undefined, "compras"), true);
});
test("funcionHabilitada: con lista, solo las nombradas", () => {
  assert.equal(funcionHabilitada(["compras"], "compras"), true);
  assert.equal(funcionHabilitada(["compras"], "anticiposCompradores"), false);
  assert.equal(funcionHabilitada([], "compras"), false);
});

test("funcionHabilitada: el marcador * habilita todas, aun con opciones en la lista", async () => {
  const { TODAS, OPCION_DESCUENTO_PRIMERO } = await import("@/lib/empresa-cliente");
  assert.equal(funcionHabilitada([TODAS, OPCION_DESCUENTO_PRIMERO], "compras"), true);
  assert.equal(funcionHabilitada([TODAS], "cualquierModuloNuevo"), true);
});
test("opcionActiva: apagada por defecto (null, vacía o sin ella), aun con todas las funciones", async () => {
  const { opcionActiva, OPCION_DESCUENTO_PRIMERO: O, TODAS } = await import("@/lib/empresa-cliente");
  assert.equal(opcionActiva(null, O), false);
  assert.equal(opcionActiva(undefined, O), false);
  assert.equal(opcionActiva([], O), false);
  assert.equal(opcionActiva([TODAS], O), false);
  assert.equal(opcionActiva(["compras"], O), false);
  assert.equal(opcionActiva([TODAS, O], O), true);
  assert.equal(opcionActiva(["compras", O], O), true);
});
