import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET → Listar roles
export async function GET() {
  const roles = await prisma.roles.findMany();
  return NextResponse.json(roles);
}
