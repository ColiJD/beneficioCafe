// EMPRESA: guardar los datos y las imágenes desde la pantalla de configuración. No cambia valores: guarda lo mismo que ya hay.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { verificarBaseDesarrollo } from "../setup/db.mjs";

let base, antes, guardarEmpresa, MODULOS, ErrorNegocio, datos;

before(async () => {
  await verificarBaseDesarrollo();
  process.env.DATABASE_URL += (process.env.DATABASE_URL.includes("?") ? "&" : "?") + "connection_limit=3";
  ({ guardarEmpresa } = await import("@/lib/empresa"));
  ({ MODULOS } = await import("@/lib/modulos"));
  ({ ErrorNegocio } = await import("@/lib/inventarioMov"));
  base = new PrismaClient();
  antes = await base.empresa.findFirst();
  assert.ok(antes, "la tabla empresa debe tener una fila");
  datos = { nombre: antes.nombre, propietario: antes.propietario, ciudad: antes.ciudad, pais: antes.pais, rtn: antes.rtn, telefono: antes.telefono };
});
after(async () => {
  await base.empresa.update({ where: { empresaID: antes.empresaID }, data: { funciones: antes.funciones ?? (await import("@prisma/client")).Prisma.DbNull } });
  await base.$disconnect();
});

const rechaza = (b, re) => assert.rejects(() => guardarEmpresa(b, MODULOS), (e) => e instanceof ErrorNegocio && re.test(e.message));

test("rechaza datos y archivos no válidos", async () => {
  await rechaza({ ...datos, nombre: " " }, /obligatorio/);
  await rechaza({ ...datos, logo: "data:application/pdf;base64,AAAA" }, /formato no admitido/);
  await rechaza({ ...datos, logo: "data:image/png;base64," + Buffer.alloc(1.6 * 1024 * 1024).toString("base64") }, /1\.5 MB/);
  await rechaza({ ...datos, funciones: ["noExiste"] }, /no existen/);
});

test("guarda datos, imagen y funciones; null deja todas las funciones", async () => {
  const dataUrl = `data:${antes.logoTipo};base64,${Buffer.from(antes.logoDatos).toString("base64")}`;
  const r = await guardarEmpresa({ ...datos, funciones: ["compras"], logo: dataUrl }, MODULOS);
  assert.deepEqual(r.funciones, ["compras"]);
  assert.equal((await guardarEmpresa({ ...datos, funciones: null }, MODULOS)).funciones, null);
  const despues = await base.empresa.findFirst();
  assert.equal(Buffer.compare(Buffer.from(despues.logoDatos), Buffer.from(antes.logoDatos)), 0, "la imagen no cambió");
});
