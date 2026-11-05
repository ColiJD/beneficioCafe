import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPermisos } from "@/lib/permisos";

// Permisos efectivos del usuario en sesión (para menú, ProtectedPage, ProtectedButton)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return Response.json({ error: "No autenticado" }, { status: 401 });
  return Response.json(await getPermisos(session.user.id));
}
