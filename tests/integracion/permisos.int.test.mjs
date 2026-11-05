// INTEGRACIÓN: permisos efectivos leídos de la base (roles + roles extra + permisos directos).
// Crea un rol y un usuario de prueba en desarrollo y los borra al terminar.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../setup/db.mjs";
import { getPermisos } from "@/lib/permisos";

const SUFIJO = Date.now();
let rolA, rolB, user, admin;

before(async () => {
  admin = await prisma.roles.findUnique({ where: { roleName: "ADMIN" } });
  rolA = await prisma.roles.create({ data: { roleName: `QA_A_${SUFIJO}` } });
  rolB = await prisma.roles.create({ data: { roleName: `QA_B_${SUFIJO}` } });
  await prisma.role_permissions.createMany({
    data: [
      { roleId: rolA.roleId, modulo: "compras", puedeVer: true, puedeCrear: true },
      { roleId: rolB.roleId, modulo: "compras", puedeVer: true, puedeEditar: true },
      { roleId: rolB.roleId, modulo: "secado", puedeVer: true },
    ],
  });
  user = await prisma.users.create({
    data: { userEmail: `qa_${SUFIJO}@pruebas.test`, userPassword: "x", userName: "QA", roleId: rolA.roleId },
  });
  await prisma.user_roles.create({ data: { userId: user.userId, roleId: rolB.roleId } });
  await prisma.user_permissions.create({ data: { userId: user.userId, modulo: "clientes", puedeVer: true, puedeEliminar: true } });
});

after(async () => {
  if (user) await prisma.users.delete({ where: { userId: user.userId } }); // cascada: user_roles, user_permissions
  for (const r of [rolA, rolB]) if (r) await prisma.roles.delete({ where: { roleId: r.roleId } });
  await prisma.$disconnect();
});

test("suma permisos del rol principal, del rol extra y directos", async () => {
  const p = await getPermisos(user.userId);
  assert.equal(p.admin, false);
  assert.deepEqual(p.roles.sort(), [rolA.roleName, rolB.roleName].sort());
  assert.equal(p.permisos.compras.crear, true);
  assert.equal(p.permisos.compras.editar, true);
  assert.equal(p.permisos.compras.eliminar, false);
  assert.equal(p.permisos.clientes.eliminar, true);
  assert.equal(p.permisos.clientes.ver, true);
  assert.ok(p.permisos.compras.origen.includes(rolA.roleName));
});

test("las dependencias dan acceso solo a datos, no a la pantalla", async () => {
  const p = await getPermisos(user.userId);
  assert.ok(p.permisos.productos.datosDe.includes("compras"));
  assert.equal(p.permisos.productos.ver, false);
  assert.ok(p.permisos.secadoras.datosDe.includes("secado"));
});

test("con el rol ADMIN extra, el usuario es admin pero no gana otros módulos", async () => {
  await prisma.user_roles.create({ data: { userId: user.userId, roleId: admin.roleId } });
  try {
    const p = await getPermisos(user.userId);
    assert.equal(p.admin, true);
    const propios = await prisma.role_permissions.count({ where: { roleId: admin.roleId, modulo: "caja-chica" } });
    if (!propios) assert.equal(p.permisos["caja-chica"], undefined);
  } finally {
    await prisma.user_roles.delete({ where: { userId_roleId: { userId: user.userId, roleId: admin.roleId } } });
  }
});

test("usuario inexistente devuelve null", async () => {
  assert.equal(await getPermisos(-1), null);
});
