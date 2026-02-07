import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 🟡 Actualizar movimiento
export async function PUT(request, { params }) {
  try {
    const id = parseInt(params.id);
    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const data = await request.json();
    const { descripcion, monto, tipo, usuarioId } = data;

    const updated = await prisma.caja_chica.update({
      where: { id },
      data: {
        descripcion,
        monto,
        tipo,
        usuarioId: usuarioId ? parseInt(usuarioId) : null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating caja chica movement:", error);
    return NextResponse.json(
      { error: "Error updating movement" },
      { status: 500 }
    );
  }
}

// 🔴 Eliminar movimiento
export async function DELETE(request, { params }) {
  try {
    const id = parseInt(params.id);
    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    await prisma.caja_chica.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Movimiento eliminado" });
  } catch (error) {
    console.error("Error deleting caja chica movement:", error);
    return NextResponse.json(
      { error: "Error deleting movement" },
      { status: 500 }
    );
  }
}
