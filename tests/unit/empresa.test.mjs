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
