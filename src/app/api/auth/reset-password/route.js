import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { excedeLimite, ipDe } from "@/lib/limiteIntentos";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const MIN_PASSWORD = 8;

export async function POST(req) {
  try {
    const { token, password } = await req.json().catch(() => ({}));

    if (typeof token !== "string" || typeof password !== "string" || !token || !password)
      return json({ success: false, message: "Datos incompletos" }, 400);
    if (password.length < MIN_PASSWORD)
      return json({ success: false, message: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres` }, 400);
    if (excedeLimite(`reset:ip:${ipDe(req)}`, 20, 15 * 60 * 1000))
      return json({ success: false, message: "Demasiados intentos. Intente de nuevo en 15 minutos." }, 429);

    const record = await prisma.password_resets.findFirst({ where: { token } });
    if (!record || new Date(record.expiresAt).getTime() < Date.now())
      return json({ success: false, message: "Token inválido o expirado" }, 400);

    const hashedPassword = await bcrypt.hash(password, 10);

    // Cambia la contraseña y borra todos los enlaces del usuario (el usado y cualquier otro vigente).
    await prisma.$transaction([
      prisma.users.update({ where: { userId: record.userId }, data: { userPassword: hashedPassword } }),
      prisma.password_resets.deleteMany({ where: { userId: record.userId } }),
    ]);

    return json({ success: true });
  } catch (error) {
    console.error(error);
    return json({ success: false, message: "Error interno" }, 500);
  }
}
