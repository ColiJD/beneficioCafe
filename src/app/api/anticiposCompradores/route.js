import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function POST(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const body = await req.json();
    const {
      compradorID,
      monto,
      tasa_interes,
      fecha,
      observacion,
      tipo,
      tipo_movimiento,
    } = body;
    const tipoFinal = tipo || tipo_movimiento || "ANTICIPO";

    if (!compradorID || !monto || isNaN(monto)) {
      return NextResponse.json(
        { error: "Datos incompletos o monto inválido" },
        { status: 400 },
      );
    }

    const nuevoRegistro = await prisma.anticipo_compradores.create({
      data: {
        compradorId: Number(compradorID),
        monto: parseFloat(monto),
        tasa_interes: parseFloat(tasa_interes || 0),
        fecha: fecha ? new Date(fecha) : new Date(),
        observacion: observacion || "",
        estado: "ACTIVO",
        tipo: tipoFinal,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `${
        tipoFinal === "ANTICIPO" ? "Anticipo" : "Préstamo"
      } registrado correctamente`,
      anticipo: nuevoRegistro,
    });
  } catch (error) {
    console.error("Error al crear préstamo o anticipo para comprador:", error);
    return NextResponse.json(
      { error: "Error al crear préstamo o anticipo" },
      { status: 500 },
    );
  }
}
