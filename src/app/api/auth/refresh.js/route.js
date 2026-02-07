import prisma from "@/lib/prisma";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { refreshToken, userId } = req.body;

  if (!refreshToken || !userId) {
    return res.status(400).json({ error: "Token y userId requeridos" });
  }

  try {
    // Buscar el refresh token válido
    const record = await prisma.password_resets.findFirst({
      where: {
        token: refreshToken,
        userId: parseInt(userId),
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: { roles: true },
        },
      },
    });

    if (!record) {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }

    // Generar nuevo refresh token
    const newRefreshToken = crypto.randomBytes(32).toString("hex");
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 día

    // Actualizar el refresh token en la base de datos
    await prisma.password_resets.update({
      where: { id: record.id },
      data: {
        token: newRefreshToken,
        expiresAt: newExpiresAt,
      },
    });

    // Calcular nueva expiración de sesión (5 minutos desde ahora)
    const sessionExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    res.status(200).json({
      success: true,
      refreshToken: newRefreshToken,
      expires: sessionExpires,
      user: {
        id: record.user.userId,
        email: record.user.userEmail,
        name: record.user.userName,
        role: record.user.roles.roleName,
      },
    });
  } catch (error) {
    console.error("Error en refresh:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
