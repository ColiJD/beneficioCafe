import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function DELETE(req, props) {
  const params = await props.params;
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const anticipoId = Number(params.id);

    if (!anticipoId || isNaN(anticipoId)) {
      return NextResponse.json(
        { error: "ID de anticipo inválido" },
        { status: 400 },
      );
    }

    const anticipoExistente = await prisma.anticipo_compradores.findUnique({
      where: { anticipoId },
    });

    if (!anticipoExistente) {
      return NextResponse.json(
        { error: "Anticipo no encontrado" },
        { status: 404 },
      );
    }

    await prisma.anticipo_compradores.update({
      where: { anticipoId },
      data: { estado: "ANULADO" },
    });

    return NextResponse.json({
      ok: true,
      message: "Anticipo anulado correctamente",
    });
  } catch (error) {
    console.error("Error al anular anticipo de comprador:", error);
    return NextResponse.json(
      { error: "Error interno al anular el anticipo" },
      { status: 500 },
    );
  }
}
