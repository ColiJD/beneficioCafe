import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // 🔹 Rutas públicas que no requieren login
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/empresa") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  // 🔹 Si no hay token, redirige al login
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 🔹 Roles permitidos para rutas dentro de /private
  // Aquí puedes ajustar según quieras acceso global o por subruta
  const globalRoles = ["ADMIN", "GERENCIA", "OPERARIOS", "AUDITORES"];

  // Si quieres control por subcarpeta específica, usa este mapa:
  const roleMap = {
    "/private/": ["ADMIN", "GERENCIA", "OPERARIOS", "AUDITORES"],
    // "/private/transacciones": ["ADMIN"],
    // "/private/informe": ["ADMIN", "GERENCIA"],
    // "/private/evento": ["ADMIN", "GERENCIA", "AUDITORES"],
  };

  // 🔹 Primero verifica si la ruta está en roleMap
  for (const path in roleMap) {
    if (pathname.startsWith(path) && !roleMap[path].includes(token.role)) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // 🔹 Si es cualquier otra ruta bajo /private y no está en el mapa, permite acceso global
  if (pathname.startsWith("/private") && !globalRoles.includes(token.role)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|static|favicon.ico|login|api/auth|api/empresa|public).*)"],
};
