import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { NextResponse } from "next/server";

export async function DELETE(req, { params }) {
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const depositoID = Number(params.id);
    if (!depositoID) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    // 🔹 Buscar el depósito
    const registro = await prisma.deposito.findUnique({
      where: { depositoID },
    });
    if (!registro) {
      return new Response(JSON.stringify({ error: "Depósito no encontrado" }), {
        status: 404,
      });
    }

    // 🔹 Buscar liquidaciones activas (para obtener IDs)
    // 🔹 Buscar liquidaciones activas del depósito
    const liquidacionesActivas = await prisma.detalleliqdeposito.findMany({
      where: {
        depositoID,
        movimiento: { not: "Anulado" }, // activas
      },
      select: {
        id: true, // id del detalle
        liqID: true, // id de la liquidación
      },
    });

    if (liquidacionesActivas.length > 0) {
      const listaLiquidaciones = liquidacionesActivas
        .map((l) => `#${l.liqID}`)
        .join(", ");

      return new Response(
        JSON.stringify({
          error: `No se puede eliminar el depósito porque está asociado a la liquidación ${listaLiquidaciones}.`,
          detalles: liquidacionesActivas,
        }),
        { status: 400 }
      );
    }

    // 🔹 Buscar el movimiento asociado
    const movimiento = await prisma.movimientoinventario.findFirst({
      where: {
        referenciaTipo: { contains: `Deposito #${depositoID}` },
        tipoMovimiento: "Entrada",
        NOT: { tipoMovimiento: "Anulado" },
      },
    });

    if (!movimiento) {
      return new Response(
        JSON.stringify({ error: "Movimiento de inventario no encontrado" }),
        { status: 404 }
      );
    }

    const esEntrada = movimiento.tipoMovimiento === "Entrada";

    // 🔹 Ejecutar la transacción
    await prisma.$transaction([
      prisma.movimientoinventario.update({
        where: { movimientoID: movimiento.movimientoID },
        data: {
          tipoMovimiento: "Anulado",
          nota: `Depósito anulado #${depositoID}`,
        },
      }),

      prisma.inventariocliente.update({
        where: { inventarioClienteID: movimiento.inventarioClienteID },
        data: esEntrada
          ? {
              cantidadQQ: { decrement: movimiento.cantidadQQ },
              cantidadSacos: { decrement: movimiento.cantidadSacos },
            }
          : {
              cantidadQQ: { increment: movimiento.cantidadQQ },
              cantidadSacos: { increment: movimiento.cantidadSacos },
            },
      }),

      prisma.deposito.update({
        where: { depositoID },
        data: { depositoMovimiento: "Anulado", estado: "Anulado" },
      }),
    ]);

    return new Response(
      JSON.stringify({
        message: `${esEntrada ? "Compra" : "Venta"} anulada correctamente`,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error al anular depósito:", error);
    return new Response(
      JSON.stringify({ error: "Error interno al anular el depósito" }),
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const depositoID = Number(params.id);
    if (!depositoID) {
      return Response.json(
        { error: "ID de depósito inválido" },
        { status: 400 }
      );
    }

    // ✅ Usar los nombres que envía el front
    const { cantidadQQ, observaciones } = await request.json();

    if (cantidadQQ === undefined || observaciones === undefined) {
      return Response.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 }
      );
    }

    const cantidad = parseFloat(cantidadQQ);

    if (isNaN(cantidad) || cantidad <= 0) {
      return Response.json(
        { error: "La cantidad en QQ debe ser un número mayor que cero" },
        { status: 400 }
      );
    }

    // 1️⃣ Obtener depósito original
    const depositoOriginal = await prisma.deposito.findUnique({
      where: { depositoID },
    });
    if (!depositoOriginal) {
      return Response.json(
        { error: "No se encontró el depósito a modificar" },
        { status: 404 }
      );
    }

    // Cliente y producto del depósito original
    const clienteID = depositoOriginal.clienteID;
    const depositoTipoCafe = depositoOriginal.depositoTipoCafe;

    // Verificar si existen registros en detalleliqdeposito no anulados
    const registroLiq = await prisma.detalleliqdeposito.findFirst({
      where: {
        depositoID,
        movimiento: { notIn: ["ANULADO", "anulado", "Anulado"] }, // Ignorar anulados
      },
      include: { liqdeposito: true },
    });

    if (registroLiq) {
      const numeroLiquidacion = registroLiq.liqdeposito?.liqID || "desconocida";
      return Response.json(
        {
          error: `No se puede modificar el depósito porque ya tiene registros de liquidación asociados (Liquidación #${numeroLiquidacion})`,
        },
        { status: 403 }
      );
    }

    // 3️⃣ Transacción para actualizar depósito e inventario
    const resultado = await prisma.$transaction(async (tx) => {
      // a) Actualizar depósito
      const depositoActualizado = await tx.deposito.update({
        where: { depositoID },
        data: {
          depositoCantidadQQ: cantidad,
          depositoDescripcion: observaciones || "",
          depositoRetencionQQ: cantidad * 0.96,
          depositoFecha: new Date(),
        },
      });

      // b) Ajustar inventario
      const diferenciaQQ =
        cantidad - Number(depositoOriginal.depositoCantidadQQ);

      const inventarioCliente = await tx.inventariocliente.upsert({
        where: {
          clienteID_productoID: {
            clienteID: Number(clienteID),
            productoID: Number(depositoTipoCafe),
          },
        },
        update: { cantidadQQ: { increment: diferenciaQQ } },
        create: {
          clienteID: Number(clienteID),
          productoID: Number(depositoTipoCafe),
          cantidadQQ: cantidad,
          cantidadSacos: depositoOriginal.depositoTotalSacos || 0,
        },
      });

      // c) Registrar movimiento de inventario
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: inventarioCliente.inventarioClienteID,
          tipoMovimiento: "Ajuste",
          referenciaTipo: `Depósito #${depositoID}`,
          referenciaID: depositoID,
          cantidadQQ: diferenciaQQ,
          nota: "Ajuste por modificación de depósito",
        },
      });

      return {
        message: "Depósito actualizado correctamente",
        depositoActualizado,
      };
    });

    return Response.json(resultado, { status: 200 });
  } catch (error) {
    console.error("Error al actualizar depósito:", error);
    return Response.json(
      { error: error?.message || "Error al actualizar depósito" },
      { status: 500 }
    );
  }
}

export async function GET(req, context) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { id } = context.params;

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
        { status: 404 }
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
      { status: 500 }
    );
  }
}
