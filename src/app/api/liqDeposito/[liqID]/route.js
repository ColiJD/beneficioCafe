import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { NextResponse } from "next/server";

export async function DELETE(request, context) {
  // ✅ Verificar permisos
  const sessionOrResponse = await checkRole(request, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { liqID } = await context.params;
    const id = Number(liqID);

    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // ✅ Buscar el registro principal en liqdeposito
    const registro = await prisma.liqdeposito.findUnique({
      where: { liqID: id },
    });

    if (!registro) {
      return NextResponse.json(
        { error: "Registro no encontrado" },
        { status: 404 },
      );
    }

    // ✅ Transacción para anular la liquidación, sus detalles y revertir depósitos
    await prisma.$transaction(async (tx) => {
      // 🔹 1. Obtener los depósitos afectados ANTES de anular detalles
      const detalles = await tx.detalleliqdeposito.findMany({
        where: { liqID: id, movimiento: { not: "Anulado" } },
        select: { depositoID: true },
      });

      const depositoIDs = [...new Set(detalles.map((d) => d.depositoID))];

      // 🔹 2. Anular la cabecera
      await tx.liqdeposito.update({
        where: { liqID: id },
        data: { liqMovimiento: "Anulado" },
      });

      // 🔹 3. Anular todos los detalles vinculados
      await tx.detalleliqdeposito.updateMany({
        where: { liqID: id },
        data: { movimiento: "Anulado" },
      });

      // 🔹 4. Revertir el estado de los depósitos a 'Pendiente'
      if (depositoIDs.length > 0) {
        await tx.deposito.updateMany({
          where: { depositoID: { in: depositoIDs } },
          data: { estado: "Pendiente" },
        });
      }
    });

    return NextResponse.json(
      {
        message: "Liquidación y estados de depósitos revertidos correctamente",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Error al anular registro de liqdeposito:", error);
    return NextResponse.json(
      { error: "Error interno al anular el registro" },
      { status: 500 },
    );
  }
}
