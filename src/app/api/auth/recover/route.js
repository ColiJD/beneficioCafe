import prisma from "@/lib/prisma";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { excedeLimite, ipDe } from "@/lib/limiteIntentos";

const VENTANA = 15 * 60 * 1000;
const RESPUESTA = { message: "Si el correo existe, se enviará un enlace" };
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@") || email.length > 255)
    return json({ message: "Correo inválido" }, 400);

  // Límite antes de buscar el usuario: responde igual exista o no el correo.
  const correo = email.trim().toLowerCase();
  if (excedeLimite(`recover:correo:${correo}`, 3, VENTANA) || excedeLimite(`recover:ip:${ipDe(req)}`, 20, VENTANA))
    return json({ message: "Demasiadas solicitudes. Intente de nuevo en 15 minutos." }, 429);

  try {
    const user = await prisma.users.findUnique({ where: { userEmail: email.trim() } });
    if (!user) return json(RESPUESTA);

    const token = crypto.randomBytes(32).toString("hex");
    // Un solo enlace vigente por usuario: los anteriores dejan de servir.
    await prisma.$transaction([
      prisma.password_resets.deleteMany({ where: { userId: user.userId } }),
      prisma.password_resets.create({
        data: { userId: user.userId, token, expiresAt: new Date(Date.now() + 3600 * 1000) }, // 1 hora
      }),
    ]);

    // El enlace sale de NEXT_PUBLIC_URL; el Host de la petición lo controla quien la manda.
    const baseUrl = process.env.NEXT_PUBLIC_URL || `${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("host")}`;
    const resetLink = `${baseUrl}/login/reset-password?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"Belagos" <${process.env.SMTP_USER}>`,
      to: user.userEmail,
      subject: "Recuperación de contraseña",
      html: `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #1677ff;">Recuperación de contraseña</h2>
      <p>Hola,</p>
      <p>Solicitaste restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña. Este enlace expirará en 1 hora.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}"
           style="background-color: #1677ff; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
          Restablecer contraseña
        </a>
      </div>

      <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">Soporte Belagos - Si tienes dudas, responde a este correo.</p>
    </div>
  `,
    });
  } catch (error) {
    // Misma respuesta que si el correo no existiera: no revela qué cuentas hay.
    console.error("Error en recuperación de contraseña:", error.message);
  }
  return json(RESPUESTA);
}
