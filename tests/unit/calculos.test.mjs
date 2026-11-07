// UNITARIAS: cálculos de café y validaciones de formularios.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  truncarDosDecimalesSinRedondear,
  calcularCafeDesdeProducto,
  calcularPesoBrutoDesdeOro,
  calcularPesoSecado,
} from "@/lib/calculoCafe";
import {
  capitalizarNombre,
  validarCedula,
  validarRTN,
  validarTelefono,
  validarEmail,
  validarEnteroPositivo,
  validarFloatPositivo,
  validarRequerido,
  validarDatosGenerico,
} from "@/lib/validacionesBackend";

const producto = { data: { tara: 2, descuento: 0, factorOro: 1 } };

test("truncar a dos decimales no redondea", () => {
  assert.equal(truncarDosDecimalesSinRedondear(1.239), 1.23);
  assert.equal(truncarDosDecimalesSinRedondear(1.2), 1.2);
  assert.equal(truncarDosDecimalesSinRedondear(0.29), 0.29); // error de coma flotante cubierto
});

test("café desde producto: peso neto = bruto − tara × sacos, y oro = neto / factor", () => {
  const r = calcularCafeDesdeProducto(102, 1, producto, 10);
  assert.equal(r.oro, 100);
  assert.equal(r.total, 1000);
});

test("café desde producto: descuento y factor oro", () => {
  const r = calcularCafeDesdeProducto(100, 0, { data: { tara: 0, descuento: 0.1, factorOro: 1.5 } }, 0);
  assert.equal(Number(r.oro.toFixed(4)), 60);
});

test("café desde producto: sin producto o con negativos devuelve cero", () => {
  assert.deepEqual(calcularCafeDesdeProducto(100, 1, null, 10), { oro: "0.00", total: "0.00", retencion: "0.00" });
  assert.equal(calcularCafeDesdeProducto(-5, -1, producto, -3).oro, 0);
});

test("peso bruto desde oro es la operación inversa", () => {
  const p = { data: { tara: 1.5, descuento: 0.05, factorOro: 1.25 } };
  const { pesoBruto } = calcularPesoBrutoDesdeOro(40, 3, p);
  const r = calcularCafeDesdeProducto(pesoBruto, 3, p, 0);
  assert.ok(Math.abs(r.oro - 40) < 0.01, `oro recalculado ${r.oro}`);
});

test("peso de secado por cambio de humedad", () => {
  assert.equal(calcularPesoSecado(100, 45, 12), "62.50");
  assert.equal(calcularPesoSecado("abc", 45, 12), "0.00");
  assert.equal(calcularPesoSecado(100, 45, 100), "0.00");
});

test("validaciones de cédula, RTN, teléfono y correo", () => {
  assert.equal(validarCedula("0703-2001-00798"), null);
  assert.ok(validarCedula("0703200100798"));
  assert.ok(validarCedula(""));
  assert.equal(validarRTN(""), null);
  assert.equal(validarRTN("0703-2001-007981"), null);
  assert.ok(validarRTN("0703-2001-0079"));
  assert.equal(validarTelefono("+50499998888"), null);
  assert.ok(validarTelefono("9999-888"));
  assert.ok(validarTelefono("1234567"));
  assert.equal(validarEmail("a@b.hn"), null);
  assert.ok(validarEmail("a@b"));
});

test("validaciones numéricas y de requerido", () => {
  assert.equal(validarEnteroPositivo("3"), null);
  assert.ok(validarEnteroPositivo("0"));
  assert.ok(validarEnteroPositivo("1.5"));
  assert.equal(validarFloatPositivo("10.25"), null);
  assert.ok(validarFloatPositivo("10.255"));
  assert.ok(validarFloatPositivo("-1"));
  assert.ok(validarRequerido("   ", "Nombre"));
  assert.equal(validarRequerido(0, "Cantidad"), null);
});

test("validación genérica junta el primer error por campo", () => {
  const r = validarDatosGenerico({ email: "x", ced: "" }, { email: [validarEmail], ced: [validarCedula] });
  assert.equal(r.valido, false);
  assert.deepEqual(Object.keys(r.errores).sort(), ["ced", "email"]);
  assert.equal(capitalizarNombre("  juan   PÉREZ "), "Juan Pérez");
});
