import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const body = await req.json();
    const { clienteID, monto, tasa_interes, fecha, observacion, tipo } = body; // 👈 Incluido tipo

    // 1️⃣ Validaciones básicas
    if (!clienteID || !monto || isNaN(monto)) {
      return NextResponse.json(
        { error: "Datos incompletos o monto inválido" },
        { status: 400 }
      );
    }

    // 2️⃣ Crear el nuevo préstamo o anticipo
    const nuevoRegistro = await prisma.anticipo.create({
      data: {
        clienteId: Number(clienteID),
        monto: parseFloat(monto),
        tasa_interes: parseFloat(tasa_interes || 0),
        fecha: fecha ? new Date(fecha) : new Date(),
        observacion: observacion || "",
        estado: "ACTIVO",
        tipo: tipo || "ANTICIPO", // 👈 Puede ser "PRESTAMO" o "ANTICIPO"
      },
    });

    // 3️⃣ Devolver respuesta limpia
    return NextResponse.json({
      ok: true,
      message: `${
        tipo === "ANTICIPO" ? "Anticipo" : "Préstamo"
      } registrado correctamente`,
      prestamo: nuevoRegistro,
    });
  } catch (error) {
    console.error("Error al crear préstamo o anticipo:", error);
    return NextResponse.json(
      { error: "Error al crear préstamo o anticipo" },
      { status: 500 }
    );
  }
}
