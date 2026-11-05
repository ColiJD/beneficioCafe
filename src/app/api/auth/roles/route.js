import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { limpiarPermisos, requireAdmin } from "@/lib/permisos";

// GET → roles con sus permisos (+ lista de módulos disponibles)
export async function GET() {
  const s = await requireAdmin(); // solo lo usan las pantallas de Administración
  if (s instanceof Response) return s;
  const roles = await prisma.roles.findMany({
    include: { role_permissions: true },
  });
  return NextResponse.json(roles);
}

const guardar = (roleId, permisos = []) =>
  prisma.$transaction([
    prisma.role_permissions.deleteMany({ where: { roleId } }),
    prisma.role_permissions.createMany({
      data: limpiarPermisos(permisos).map((p) => ({ ...p, roleId })),
    }),
  ]);

// POST → crear rol { roleName, permisos: [{modulo, puedeVer, puedeCrear, puedeEditar, puedeEliminar}] }
export async function POST(req) {
  const s = await requireAdmin();
  if (s instanceof Response) return s;
  const { roleName, permisos } = await req.json();
  if (!roleName?.trim())
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  try {
    const rol = await prisma.roles.create({
      data: { roleName: roleName.trim().toUpperCase() },
    });
    await guardar(rol.roleId, permisos);
    return NextResponse.json(rol, { status: 201 });
  } catch {
    return NextResponse.json({ error: "El rol ya existe" }, { status: 409 });
  }
}

// PUT → editar rol { roleId, roleName, permisos }
export async function PUT(req) {
  const s = await requireAdmin();
  if (s instanceof Response) return s;
  const { roleId, roleName, permisos } = await req.json();
  const actual = await prisma.roles.findUnique({ where: { roleId } });
  if (!actual)
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  // ADMIN no se renombra, pero sí se le pueden asignar más módulos (Administración va siempre incluida)
  if (actual.roleName !== "ADMIN") {
    try {
      if (roleName?.trim())
        await prisma.roles.update({
          where: { roleId },
          data: { roleName: roleName.trim().toUpperCase() },
        });
    } catch {
      return NextResponse.json({ error: "El nombre ya existe" }, { status: 409 });
    }
  }
  await guardar(roleId, permisos);
  return NextResponse.json({ ok: true });
}

// DELETE → ?roleId=  (no ADMIN ni roles en uso como principal)
export async function DELETE(req) {
  const s = await requireAdmin();
  if (s instanceof Response) return s;
  const roleId = Number(new URL(req.url).searchParams.get("roleId"));
  const rol = await prisma.roles.findUnique({ where: { roleId } });
  if (!rol) return NextResponse.json({ error: "No existe" }, { status: 404 });
  if (rol.roleName === "ADMIN")
    return NextResponse.json({ error: "ADMIN no se puede borrar" }, { status: 400 });
  if (await prisma.users.count({ where: { roleId } }))
    return NextResponse.json(
      { error: "Hay usuarios con este rol como principal" },
      { status: 409 },
    );
  await prisma.roles.delete({ where: { roleId } });
  return NextResponse.json({ ok: true });
}
