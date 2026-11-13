// UNITARIAS: mapa de módulos, rutas y permisos (sin base de datos).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODULOS,
  ACCIONES,
  DEPENDENCIAS,
  GRUPOS,
  aplica,
  col,
  modulosDeApi,
  modulosDeModulo,
  moduloDeRuta,
  puedeEnRuta,
  puedeEnModulo,
  necesitan,
} from "@/lib/modulos";
import { limpiarPermisos, limpiarDirectos } from "@/lib/permisos";

const acc = (permisos, admin = false) => ({ admin, permisos });

test("hay 46 módulos únicos y 4 acciones", () => {
  assert.equal(MODULOS.length, 46);
  assert.equal(new Set(MODULOS).size, MODULOS.length);
  assert.deepEqual(ACCIONES, ["ver", "crear", "editar", "eliminar"]);
  assert.equal(col("eliminar"), "puedeEliminar");
});

test("las dependencias solo apuntan a módulos existentes", () => {
  for (const [m, deps] of Object.entries(DEPENDENCIAS)) {
    assert.ok(MODULOS.includes(m), m);
    for (const d of deps) assert.ok(MODULOS.includes(d), `${m} → ${d}`);
  }
  assert.ok(necesitan("productos").includes("compras"));
});

test("formulario y registro: cada acción en un solo lugar", () => {
  assert.equal(aplica("compras", "crear"), true);
  assert.equal(aplica("compras", "eliminar"), false);
  assert.equal(aplica("reg-compras", "eliminar"), true);
  assert.equal(aplica("reg-compras", "crear"), false);
  assert.equal(aplica("reg-secado", "ver"), true);
  assert.equal(aplica("reg-secado", "editar"), false);
});

test("API → módulo según método", () => {
  assert.deepEqual(modulosDeApi("/api/compras", "GET"), ["compras", "reg-compras"]);
  assert.deepEqual(modulosDeApi("/api/compras", "POST"), ["compras"]);
  assert.deepEqual(modulosDeApi("/api/compras/5", "DELETE"), ["reg-compras"]);
  assert.deepEqual(modulosDeApi("/api/compras/5", "PUT"), ["compras"]);
  assert.deepEqual(modulosDeApi("/api/deposito/5", "PUT"), ["reg-depositos"]); // se edita en el registro
  assert.deepEqual(modulosDeApi("/api/inventario/transferir", "POST"), ["transferencias"]);
  assert.deepEqual(modulosDeApi("/api/reportes", "GET"), ["informe-general"]);
  assert.deepEqual(modulosDeApi("/api/reportes/porCliente", "GET"), ["informe-porCliente"]);
  assert.deepEqual(modulosDeApi("/api/secado/reporte", "GET"), ["reg-secado"]);
  assert.deepEqual(modulosDeApi("/api/salidas/liquidarSalida", "POST"), ["liqSalidas"]);
  assert.deepEqual(modulosDeApi("/api/contratos/entregar", "POST"), ["entregaContratos"]);
  assert.deepEqual(modulosDeApi("/api/compras/salidas", "GET"), ["Venta", "reg-ventas"]);
  assert.deepEqual(modulosDeModulo("Venta", "DELETE"), ["reg-ventas"]);
  assert.deepEqual(modulosDeApi("/api/prestamos/5", "GET"), ["prestamos", "anticipos"]);
  assert.deepEqual(modulosDeApi("/api/prestamos/5", "DELETE"), ["prestamos"]);
  assert.deepEqual(modulosDeApi("/api/salidas/pendientes/3", "GET"), ["salidas", "reg-salidas"]);
  assert.deepEqual(modulosDeApi("/api/liqDeposito/RedDeLiquidacion", "GET"), ["liqDeposito", "reg-liqDepositos"]);
});

test("rutas de pantalla → módulo", () => {
  assert.equal(moduloDeRuta("/private/page/transacciones/compra/vista"), "reg-compras");
  assert.equal(moduloDeRuta("/private/page/transacciones/compra"), "compras");
  assert.equal(moduloDeRuta("/private/page/secado/reporte"), "reg-secado");
  assert.equal(moduloDeRuta("/private/page/secado"), "secado");
  assert.equal(moduloDeRuta("/private/page/roles"), "ADMIN");
  assert.equal(moduloDeRuta("/private/page/desconocida"), null);
});

test("ADMIN solo entra a Administración; los demás módulos se asignan", () => {
  const admin = acc({}, true);
  assert.equal(puedeEnRuta(admin, "/private/page/user"), true);
  assert.equal(puedeEnRuta(admin, "/private/page/roles"), true);
  assert.equal(puedeEnRuta(admin, "/private/page/transacciones/compra"), false);
  assert.equal(puedeEnRuta(admin, "/private/page/registros"), false);
  const adminConCompras = acc({ compras: { ver: true } }, true);
  assert.equal(puedeEnRuta(adminConCompras, "/private/page/transacciones/compra"), true);
});

test("usuario normal: no entra a Administración ni a módulos sin permiso", () => {
  const u = acc({ "reg-ventas": { ver: true }, prestamos: { ver: true, crear: true } });
  assert.equal(puedeEnRuta(u, "/private/page/roles"), false);
  assert.equal(puedeEnRuta(u, "/private/page/registros"), true); // basta uno de los registros
  assert.equal(puedeEnRuta(u, "/private/page/transacciones/prestamos"), true);
  assert.equal(puedeEnRuta(u, "/private/page/transacciones/prestamos", "eliminar"), false);
  assert.equal(puedeEnRuta(u, "/private/page/transacciones/compra"), false);
  assert.equal(puedeEnRuta(null, "/private/page/registros"), false);
  assert.equal(puedeEnModulo(u, "prestamos", "crear"), true);
});

test("limpiarPermisos descarta módulos inválidos, acciones que no aplican y fuerza ver", () => {
  const r = limpiarPermisos([
    { modulo: "compras", puedeCrear: true, puedeEliminar: true },
    { modulo: "inexistente", puedeVer: true },
    { modulo: "clientes" },
    { modulo: "reg-secado", puedeEditar: true },
  ]);
  assert.deepEqual(r, [
    { modulo: "compras", puedeVer: true, puedeCrear: true, puedeEditar: false, puedeEliminar: false },
  ]);
});

test("limpiarDirectos conserva las filas sin acciones (quitar el módulo) y descarta inválidos", () => {
  const r = limpiarDirectos([
    { modulo: "compras" },
    { modulo: "clientes", puedeEliminar: true },
    { modulo: "inexistente", puedeVer: true },
  ]);
  assert.deepEqual(r, [
    { modulo: "compras", puedeVer: false, puedeCrear: false, puedeEditar: false, puedeEliminar: false },
    { modulo: "clientes", puedeVer: true, puedeCrear: false, puedeEditar: false, puedeEliminar: true },
  ]);
});

test("cada módulo pertenece a un grupo", () => {
  const enGrupos = GRUPOS.flatMap((g) => g.items.map(([k]) => k));
  assert.deepEqual(enGrupos, MODULOS);
});
