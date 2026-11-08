import { test } from "node:test";
import assert from "node:assert/strict";
import { limpiar, detalleSeguro } from "../../src/lib/bitacoraCtx.js";

test("limpiar oculta contraseñas, tokens e imágenes y acota textos y listas", () => {
  const r = limpiar({ userPassword: "x", token: "t", logoDatos: Buffer.from("a"), nombre: "a".repeat(300), lista: Array(50).fill(1), anidado: { refreshToken: "z", ok: 1 } });
  assert.equal(r.userPassword, "[oculto]");
  assert.equal(r.token, "[oculto]");
  assert.equal(r.logoDatos, "[oculto]");
  assert.equal(r.anidado.refreshToken, "[oculto]");
  assert.equal(r.anidado.ok, 1);
  assert.equal(r.nombre.length, 201);
  assert.equal(limpiar({ datos: { a: 1 } }).datos.a, 1, "la clave datos no se oculta");
  assert.equal(r.lista.length, 20);
});

test("detalleSeguro no pasa de ~4 KB: guarda solo los nombres de los campos", () => {
  const grande = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`campo${i}`, "x".repeat(150)]));
  const r = detalleSeguro(grande);
  assert.equal(r._truncado, true);
  assert.equal(r.campos.length, 60);
});
