// 2. authOptions.js - Configuración corregida
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prismaSafe } from "@/lib/prismaSafe";
import { registrar } from "@/lib/bitacora";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const ip = String(req?.headers?.["x-forwarded-for"] ?? "").split(",")[0].trim();
        // Envolvemos la consulta en prismaSafe para manejar errores de conexión
        const user = await prismaSafe(async () => {
          return prisma.users.findUnique({
            where: { userEmail: credentials.email },
            include: { roles: true },
          });
        });

        const errorMsg = "Usuario o contraseña incorrecta";
        if (!user) {
          await registrar({ evento: "LOGIN_FALLIDO", modulo: "sesion", ip, detalle: { correo: credentials.email, motivo: "el usuario no existe" } });
          throw new Error(errorMsg);
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.userPassword,
        );

        if (!isValid) {
          await registrar({ evento: "LOGIN_FALLIDO", modulo: "sesion", ip, usuario: { userId: user.userId, usuario: user.userName, rol: user.roles.roleName }, detalle: { correo: credentials.email, motivo: "contraseña incorrecta" } });
          throw new Error(errorMsg);
        }

        // Crear refresh token
        const refreshToken = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 día

        // Limpiar tokens anteriores y crear nuevo token de manera segura
        await prismaSafe(async () => {
          await prisma.password_resets.deleteMany({
            where: { userId: user.userId },
          });

          await prisma.password_resets.create({
            data: {
              userId: user.userId,
              token: refreshToken,
              expiresAt,
            },
          });
        });

        await registrar({ evento: "LOGIN", modulo: "sesion", ip, usuario: { userId: user.userId, usuario: user.userName, rol: user.roles.roleName } });

        return {
          id: user.userId,
          email: user.userEmail,
          name: user.userName,
          role: user.roles.roleName,
          refreshToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.refreshToken = user.refreshToken;
      }

      // Manejar actualizaciones de sesión
      if (trigger === "update" && session) {
        return { ...token, ...session };
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      // refreshToken no se expone al navegador: vive en password_resets y serviría para cambiar la contraseña.
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 20 * 60, // 5 minutos
    updateAge: 60, // intentar renovar cada 1 minuto si hay actividad
  },
  jwt: {
    maxAge: 20 * 60, // 5 minutos
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
};
