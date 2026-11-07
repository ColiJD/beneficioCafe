import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/permisos";

export async function GET() {
  const s = await requireAdmin(); // diagnóstico: solo ADMIN
  if (s instanceof Response) return s;
  try {
    const data = await prisma.$queryRaw`SELECT * FROM vw_movimientos_inventario LIMIT 1`;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
