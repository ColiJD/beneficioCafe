import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { NextResponse } from "next/server";
import {
  ErrorNegocio,
  esAnulado,
  moverInventario,
  movimientoOriginal,
  noAnulado,
  redondear,
  respuestaError,
} from "@/lib/inventarioMov";

export async function DELETE(request, { params }) {
  const sessionOrResponse = await checkRole(request, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const depositoID = Number((await params).id);
    if (!depositoID) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const registro = await tx.deposito.findUnique({ where: { depositoID } });
      if (!registro) throw new ErrorNegocio("Depósito no encontrado", 404);
      if (esAnulado(registro.depositoMovimiento) || esAnulado(registro.estado)) {
        throw new ErrorNegocio("El depósito ya está anulado");
      }

      const liquidacionesActivas = await tx.detalleliqdeposito.findMany({
        where: { depositoID, ...noAnulado("movimiento") },
        select: { id: true, liqID: true },
      });
      if (liquidacionesActivas.length > 0) {
        const lista = liquidacionesActivas.map((l) => `#${l.liqID}`).join(", ");
        throw new ErrorNegocio(
          `No se puede eliminar el depósito porque está asociado a la liquidación ${lista}.`,
        );
      }

      const movimiento = await movimientoOriginal(tx, [`Deposito #${depositoID}`]);
      if (!movimiento) throw new ErrorNegocio("Movimiento de inventario no encontrado", 404);

      // Las modificaciones del depósito dejaron movimientos "Ajuste": se anulan junto al original
      const ajustes = await tx.movimientoinventario.findMany({
        where: { referenciaTipo: `Depósito #${depositoID}`, tipoMovimiento: "Ajuste" },
      });
      const total = redondear(
        Number(movimiento.cantidadQQ) + ajustes.reduce((a, m) => a + Number(m.cantidadQQ), 0),
      );

      await moverInventario(tx, registro.depositoTipoCafe, -total, -Number(movimiento.cantidadSacos || 0));

      await tx.movimientoinventario.updateMany({
        where: { movimientoID: { in: [movimiento.movimientoID, ...ajustes.map((a) => a.movimientoID)] } },
        data: { tipoMovimiento: "Anulado", nota: `Depósito anulado #${depositoID}` },
      });
      await tx.deposito.update({
        where: { depositoID },
        data: { depositoMovimiento: "Anulado", estado: "Anulado" },
      });
    });

    return NextResponse.json({ message: "Depósito anulado correctamente" });
  } catch (error) {
    return respuestaError(error, "Error interno al anular el depósito");
  }
}

export async function PUT(request, { params }) {
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const depositoID = Number((await params).id);
    if (!depositoID) {
      return Response.json({ error: "ID de depósito inválido" }, { status: 400 });
    }

    // ✅ Usar los nombres que envía el front
    const { cantidadQQ, observaciones } = await request.json();

    if (cantidadQQ === undefined || observaciones === undefined) {
      return Response.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    const cantidad = parseFloat(cantidadQQ);
    if (isNaN(cantidad) || cantidad <= 0) {
      return Response.json(
        { error: "La cantidad en QQ debe ser un número mayor que cero" },
        { status: 400 },
      );
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const depositoOriginal = await tx.deposito.findUnique({ where: { depositoID } });
      if (!depositoOriginal) throw new ErrorNegocio("No se encontró el depósito a modificar", 404);
      if (esAnulado(depositoOriginal.depositoMovimiento) || esAnulado(depositoOriginal.estado)) {
        throw new ErrorNegocio("No se puede modificar un depósito anulado");
      }

      // Con liquidaciones activas no se puede modificar
      const registroLiq = await tx.detalleliqdeposito.findFirst({
        where: { depositoID, ...noAnulado("movimiento") },
        include: { liqdeposito: true },
      });
      if (registroLiq) {
        const numero = registroLiq.liqdeposito?.liqID || "desconocida";
        throw new ErrorNegocio(
          `No se puede modificar el depósito porque ya tiene registros de liquidación asociados (Liquidación #${numero})`,
          403,
        );
      }

      const depositoActualizado = await tx.deposito.update({
        where: { depositoID },
        data: {
          depositoCantidadQQ: cantidad,
          depositoDescripcion: observaciones || "",
          depositoRetencionQQ: cantidad * 0.96,
          depositoFecha: new Date(),
        },
      });

      const diferenciaQQ = redondear(cantidad - Number(depositoOriginal.depositoCantidadQQ));
      const inventarioGlobal = await moverInventario(tx, depositoOriginal.depositoTipoCafe, diferenciaQQ);

      if (diferenciaQQ !== 0) {
        await tx.movimientoinventario.create({
          data: {
            inventarioClienteID: inventarioGlobal.inventarioClienteID,
            tipoMovimiento: "Ajuste",
            referenciaTipo: `Depósito #${depositoID}`,
            referenciaID: depositoID,
            cantidadQQ: diferenciaQQ,
            nota: "Ajuste por modificación de depósito",
          },
        });
      }

      return { message: "Depósito actualizado correctamente", depositoActualizado };
    });

    return Response.json(resultado);
  } catch (error) {
    return respuestaError(error, "Error al actualizar depósito");
  }
}

export async function GET(request, context) {
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { id } = await context.params;

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const deposito = await prisma.deposito.findUnique({
      where: { depositoID: parseInt(id) },
      include: {
        cliente: {
          select: {
            clienteID: true,
            clienteNombre: true,
            clienteApellido: true,
          },
        },
        producto: {
          select: {
            productID: true,
            productName: true,
          },
        },
      },
    });

    if (!deposito) {
      return NextResponse.json(
        { error: "Depósito no encontrado" },
        { status: 404 },
      );
    }

    const data = {
      depositoID: deposito.depositoID,
      depositoCantidadQQ: deposito.depositoCantidadQQ,
      depositoRetencionQQ: deposito.depositoRetencionQQ,
      depositoDescripcion: deposito.depositoDescripcion,
      depositoFecha: deposito.depositoFecha,
      cliente: deposito.cliente,
      producto: deposito.producto,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error en GET /api/deposito/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
