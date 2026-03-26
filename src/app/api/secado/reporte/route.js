import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secadoraId = searchParams.get("secadoraId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const estado = searchParams.get("estado") || "all";

  try {
    const where = {};

    if (estado === "all") {
      where.estado = { not: "Anulado" };
    } else {
      where.estado = estado;
    }

    if (secadoraId && secadoraId !== "all") {
      where.secadoraId = parseInt(secadoraId);
    }

    if (startDate && endDate) {
      where.fechaInicio = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.fechaInicio = {
        gte: new Date(startDate),
      };
    } else if (endDate) {
      where.fechaInicio = {
        lte: new Date(endDate),
      };
    }

    const reportData = await prisma.secado.findMany({
      where,
      include: {
        secadora: true,
        producto: true,
        productoDestino: true,
      },
      orderBy: {
        fechaInicio: "desc",
      },
    });

    return NextResponse.json(reportData);
  } catch (error) {
    console.error("Error fetching report data:", error);
    return NextResponse.json(
      { error: "Error al generar el reporte" },
      { status: 500 },
    );
  }
}
