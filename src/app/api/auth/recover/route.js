import prisma from "@/lib/prisma";
import crypto from "crypto";
import nodemailer from "nodemailer";

export async function POST(req) {
  const { email } = await req.json();

  const user = await prisma.users.findUnique({ where: { userEmail: email } });

  if (!user) {
    return new Response(
      JSON.stringify({ message: "Si el correo existe, se enviará un enlace" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 3600 * 1000); // 1 hora

  await prisma.password_resets.create({
    data: {
      userId: user.userId,
      token,
      expiresAt: expires,
    },
  });

  const resetLink = `${process.env.NEXT_PUBLIC_URL}/login/reset-password?token=${token}`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Cafe Henola" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Recuperación de contraseña",
    html: `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #1677ff;">Recuperación de contraseña</h2>
      <p>Hola,</p>
      <p>Haz solicitado restablecer tu contraseña. Haz click en el botón de abajo para crear una nueva contraseña. Este enlace expirará en 1 hora.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" 
           style="background-color: #1677ff; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
          Restablecer contraseña
        </a>
      </div>

      <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">Soporte Frijoles - Si tienes dudas, responde a este correo.</p>
    </div>
  `,
  });

  return new Response(
    JSON.stringify({ message: "Si el correo existe, se enviará un enlace" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
