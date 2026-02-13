import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
export async function POST(req) {
  try {
    const body = await req.json();
    const { compradorID, productoID, cantidadLiquidar, descripcion } = body;

    const compradorIdNum = Number(compradorID);
    const productoIdNum = Number(productoID);
    const cantidadSolicitada = Number(cantidadLiquidar);

    if (
      isNaN(compradorIdNum) ||
      isNaN(productoIdNum) ||
      isNaN(cantidadSolicitada) ||
      cantidadSolicitada <= 0
    ) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios o inválidos" },
        { status: 400 },
      );
    }

    const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    const resultado = await prisma.$transaction(async (tx) => {
      let cantidad = roundToTwo(cantidadSolicitada);

      // ----------------------------
      // ✔ Verificar inventario específico disponible
      // ----------------------------
      const inventarioExistente = await tx.inventariocliente.findUnique({
        where: { productoID: productoIdNum },
      });

      const inventarioDisponible = roundToTwo(
        Number(inventarioExistente?.cantidadQQ ?? 0),
      );

      if (inventarioDisponible < cantidad) {
        throw new Error(
          `Inventario insuficiente para el producto. Disponible: ${inventarioDisponible.toFixed(
            2,
          )} QQ, Solicitado: ${cantidad.toFixed(2)} QQ`,
        );
      }

      // ----------------------------
      // ✔ Obtener salidas válidas (NO ANULADAS) para el producto específico
      // ----------------------------
      const salidas = await tx.salida.findMany({
        where: {
          compradorID: compradorIdNum,
          productoID: productoIdNum,
          salidaMovimiento: { notIn: ["ANULADO", "Anulado", "anulado"] },
        },
        orderBy: { salidaFecha: "asc" },
        include: {
          detalleliqsalida: {
            select: { cantidadQQ: true, movimiento: true },
          },
        },
      });

      // ----------------------------
      // ✔ Calcular pendientes
      // ----------------------------
      const pendientes = salidas
        .map((s) => {
          const totalLiquidado = s.detalleliqsalida
            .filter(
              (d) =>
                d.movimiento === null ||
                !["ANULADO", "Anulado", "anulado"].includes(d.movimiento),
            )
            .reduce((acc, d) => acc + Number(d.cantidadQQ || 0), 0);

          const totalLiquidadoRounded = roundToTwo(totalLiquidado);
          const pendiente = roundToTwo(
            Number(s.salidaCantidadQQ) - totalLiquidadoRounded,
          );

          return { salidaID: s.salidaID, pendiente };
        })
        .filter((s) => s.pendiente > 0);

      if (pendientes.length === 0) {
        throw new Error("NO_PENDIENTES");
      }

      // ----------------------------
      // ✔ Crear cabecera de liquidación
      // ----------------------------
      const liqSalida = await tx.liqsalida.create({
        data: {
          liqFecha: new Date(),
          liqMovimiento: "Salida",
          liqCantidadQQ: cantidad,
          liqDescripcion: descripcion || "",
          compradorID: compradorIdNum, // Relación directa ahora
          productoID: productoIdNum,
        },
      });

      // ----------------------------
      // ✔ FIFO automático para detalles de liquidación
      // ----------------------------
      for (const s of pendientes) {
        if (cantidad <= 0) break;

        const descontar = roundToTwo(Math.min(s.pendiente, cantidad));

        await tx.detalleliqsalida.create({
          data: {
            liqSalidaID: liqSalida.liqSalidaID,
            salidaID: s.salidaID,
            cantidadQQ: descontar,
            movimiento: "Salida",
          },
        });

        cantidad = roundToTwo(cantidad - descontar);
      }

      // ----------------------------
      // ✔ Reducir inventario específico
      // ----------------------------
      await tx.inventariocliente.update({
        where: { inventarioClienteID: inventarioExistente.inventarioClienteID },
        data: {
          cantidadQQ: { decrement: cantidadSolicitada },
        },
      });

      // Registrar movimiento
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: inventarioExistente.inventarioClienteID,
          tipoMovimiento: "Salida",
          referenciaTipo: "Liquidación Salida",
          referenciaID: liqSalida.liqSalidaID,
          cantidadQQ: cantidadSolicitada,
          nota: `Liquidación de salida #${liqSalida.liqSalidaID} - Comprador ID: ${compradorIdNum}`,
        },
      });

      return liqSalida;
    });

    return NextResponse.json(
      { liqSalidaID: resultado.liqSalidaID },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error FIFO transacción:", error);

    if (error.message === "NO_PENDIENTES") {
      return NextResponse.json(
        {
          error:
            "No hay salidas pendientes de este producto para este comprador",
        },
        { status: 400 },
      );
    }

    if (error.message && error.message.includes("Inventario insuficiente")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Error interno: " + error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  // Validar roles
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { searchParams } = new URL(req.url);
    const fechaInicio =
      searchParams.get("desde") || searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("hasta") || searchParams.get("fechaFin");

    const inicio = fechaInicio ? new Date(fechaInicio) : new Date();
    const fin = fechaFin ? new Date(fechaFin) : new Date();

    const registros = await prisma.liqsalida.findMany({
      where: {
        liqFecha: { gte: inicio, lte: fin },
        NOT: { liqMovimiento: "Anulado" },
      },
      select: {
        liqSalidaID: true,
        liqFecha: true,
        liqMovimiento: true,
        liqCantidadQQ: true,
        liqDescripcion: true,
        compradores: {
          select: {
            compradorId: true,
            compradorNombre: true,
          },
        },
        producto: {
          select: {
            productID: true,
            productName: true,
          },
        },
      },
      orderBy: { liqFecha: "desc" },
    });

    return new Response(JSON.stringify(registros), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error en reporte de liquidaciones de salida:", error);
    return new Response(
      JSON.stringify({ error: "Error al obtener liquidaciones de salida" }),
      { status: 500 },
    );
  }
}
