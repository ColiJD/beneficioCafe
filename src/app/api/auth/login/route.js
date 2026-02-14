import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// GET → Listar usuarios
export async function GET() {
  const users = await prisma.users.findMany({
    include: { roles: true },
  });
  return NextResponse.json(users);
}

// POST → Crear usuario
export async function POST(req) {
  const { userEmail, userPassword, userName, roleId } = await req.json();

  const hashedPassword = await bcrypt.hash(userPassword, 10);

  const user = await prisma.users.create({
    data: {
      userEmail,
      userPassword: hashedPassword,
      userName,
      roleId,
    },
  });

  return NextResponse.json(user);
}

// PUT → Actualizar usuario
export async function PUT(req) {
  try {
    const { userId, userEmail, userName, roleId, userPassword } =
      await req.json();

    const data = {
      userEmail,
      userName,
      roleId,
    };

    if (userPassword) {
      data.userPassword = await bcrypt.hash(userPassword, 10);
    }

    const updatedUser = await prisma.users.update({
      where: { userId: Number(userId) },
      data,
      include: { roles: true },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar usuario" },
      { status: 500 },
    );
  }
}

// DELETE → Eliminar usuario
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "ID de usuario requerido" },
        { status: 400 },
      );
    }

    await prisma.users.delete({
      where: { userId: Number(userId) },
    });

    return NextResponse.json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 },
    );
  }
}
