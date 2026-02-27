import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req, props) {
  const params = await props.params;
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { compradorId } = params;

    const prestamos = await prisma.prestamos_compradores.findMany({
      where: { compradorId: parseInt(compradorId) },
      include: {
        movimientos_prestamo: true,
      },
      orderBy: { fecha: "desc" },
    });

    return NextResponse.json({ ok: true, prestamos });
  } catch (error) {
    console.error("Error al obtener préstamos de comprador:", error);
    return NextResponse.json(
      { error: "Error al obtener préstamos" },
      { status: 500 },
    );
  }
}

export async function DELETE(req, props) {
  const params = await props.params;
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { compradorId } = params; // Aquí recibimos el prestamoId según el frontend
    const prestamoId = Number(compradorId);

    if (!prestamoId || isNaN(prestamoId)) {
      return NextResponse.json(
        { error: "ID de préstamo inválido" },
        { status: 400 },
      );
    }

    const prestamoExistente = await prisma.prestamos_compradores.findUnique({
      where: { prestamoId },
    });

    if (!prestamoExistente) {
      return NextResponse.json(
        { error: "Préstamo no encontrado" },
        { status: 404 },
      );
    }

    // Anular el préstamo
    await prisma.prestamos_compradores.update({
      where: { prestamoId },
      data: { estado: "ANULADO" },
    });

    return NextResponse.json({
      ok: true,
      message: "Préstamo anulado correctamente",
    });
  } catch (error) {
    console.error("Error al anular préstamo de comprador:", error);
    return NextResponse.json(
      { error: "Error interno al anular el préstamo" },
      { status: 500 },
    );
  }
}
