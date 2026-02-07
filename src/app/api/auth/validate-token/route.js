import prisma from "@/lib/prisma";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const record = await prisma.password_resets.findFirst({
      where: { token },
    });

    const now = new Date(); // Hora actual del servidor

    // Comparación segura UTC
    if (!record || new Date(record.expiresAt).getTime() < now.getTime()) {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ valid: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ valid: false, error: "Error interno" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
