// 2. authOptions.js - Configuración corregida
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = await prisma.users.findUnique({
          where: { userEmail: credentials.email },
          include: { roles: true },
        });

        const errorMsg = "Usuario o contraseña incorrecta";
        if (!user) throw new Error(errorMsg);

        const isValid = await bcrypt.compare(
          credentials.password,
          user.userPassword
        );

        if (!isValid) throw new Error(errorMsg);

        // Crear refresh token
        const refreshToken = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 día

        // Limpiar tokens anteriores del usuario
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
      session.user.refreshToken = token.refreshToken;
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
