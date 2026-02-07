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
