import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return new Response(
        JSON.stringify({ success: false, message: "Datos incompletos" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const record = await prisma.password_resets.findFirst({
      where: { token },
    });

    const now = new Date();

    if (!record || new Date(record.expiresAt).getTime() < now.getTime()) {
      return new Response(
        JSON.stringify({ success: false, message: "Token inválido o expirado" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Actualizar contraseña del usuario
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.users.update({
      where: { userId: record.userId },
      data: { userPassword: hashedPassword },
    });

    // Eliminar token usado
    await prisma.password_resets.deleteMany({ where: { token } });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ success: false, message: "Error interno" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
