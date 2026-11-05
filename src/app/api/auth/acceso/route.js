import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { MODULOS, getPermisos, limpiarPermisos, requireAdmin } from "@/lib/permisos";

// GET ?userId= → ficha: permisos efectivos (con origen), roles extra y permisos directos
export async function GET(req) {
  const s = await requireAdmin();
  if (s instanceof Response) return s;
  const userId = Number(new URL(req.url).searchParams.get("userId"));
  const user = await prisma.users.findUnique({
    where: { userId },
    select: {
      userId: true, userEmail: true, userName: true, createdAt: true,
      roleId: true, roles: true,
      user_roles: { select: { roleId: true } },
      user_permissions: true,
    },
  });
  if (!user) return NextResponse.json({ error: "No existe" }, { status: 404 });
  return NextResponse.json({
    user,
    efectivo: await getPermisos(userId),
    modulos: MODULOS,
  });
}

// PUT { userId, roleIds: [], permisos: [{modulo, puedeVer, puedeCrear, puedeEditar, puedeEliminar}] } → roles extra + permisos directos
export async function PUT(req) {
  const s = await requireAdmin();
  if (s instanceof Response) return s;
  const { userId, roleIds = [], permisos = [] } = await req.json();
  await prisma.$transaction([
    prisma.user_roles.deleteMany({ where: { userId } }),
    prisma.user_roles.createMany({
      data: [...new Set(roleIds.map(Number))].map((roleId) => ({ userId, roleId })),
    }),
    prisma.user_permissions.deleteMany({ where: { userId } }),
    prisma.user_permissions.createMany({
      data: limpiarPermisos(permisos).map((p) => ({ ...p, userId })),
    }),
  ]);
  return NextResponse.json({ ok: true });
}
