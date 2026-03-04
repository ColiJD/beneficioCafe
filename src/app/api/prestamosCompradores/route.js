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
    const { compradorID, monto, tasa_interes, fecha, observacion } = body;

    if (!compradorID || !monto || isNaN(monto)) {
      return NextResponse.json(
        { error: "Datos incompletos o monto inválido" },
        { status: 400 },
      );
    }

    const nuevoPrestamo = await prisma.prestamos_compradores.create({
      data: {
        compradorId: compradorID,
        monto: parseFloat(monto),
        tasa_interes: parseFloat(tasa_interes || 0),
        fecha: fecha ? new Date(fecha) : new Date(),
        observacion: observacion || "",
        estado: "ACTIVO",
      },
      include: {
        movimientos_prestamo: true,
      },
    });

    return NextResponse.json({ ok: true, prestamo: nuevoPrestamo });
  } catch (error) {
    console.error("Error al crear préstamo de comprador:", error);
    return NextResponse.json(
      { error: "Error al crear préstamo" },
      { status: 500 },
    );
  }
}
