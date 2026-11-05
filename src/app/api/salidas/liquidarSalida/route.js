import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { calcularPendientes, crearDetallesFIFO, redondear } from "@/lib/pendientesSalida";
import { ErrorNegocio, respuestaError } from "@/lib/inventarioMov";
export async function POST(req) {
  const sessionOrResponse = await checkRole(req, ["ADMIN", "GERENCIA", "COLABORADORES"]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
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

    const roundToTwo = redondear;

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
      const pendientes = await calcularPendientes(tx, compradorIdNum, productoIdNum);

      if (pendientes.length === 0) {
        throw new Error("NO_PENDIENTES");
      }

      const totalPendiente = roundToTwo(pendientes.reduce((a, s) => a + s.pendiente, 0));
      if (cantidad > totalPendiente) {
        throw new Error(
          `Cantidad excede lo pendiente de liquidar. Pendiente: ${totalPendiente.toFixed(2)} QQ, Solicitado: ${cantidad.toFixed(2)} QQ`,
        );
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
      await crearDetallesFIFO(tx, liqSalida.liqSalidaID, pendientes, cantidad);

      // ----------------------------
      // ✔ Reducir inventario específico (condicionado al saldo, por si otro proceso lo bajó)
      // ----------------------------
      const bajado = await tx.inventariocliente.updateMany({
        where: {
          inventarioClienteID: inventarioExistente.inventarioClienteID,
          cantidadQQ: { gte: cantidad },
        },
        data: { cantidadQQ: { decrement: cantidad } },
      });
      if (bajado.count === 0) {
        throw new Error("Inventario insuficiente para el producto.");
      }

      // Registrar movimiento
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: inventarioExistente.inventarioClienteID,
          tipoMovimiento: "Salida",
          referenciaTipo: "Liquidación Salida",
          referenciaID: liqSalida.liqSalidaID,
          cantidadQQ: cantidad,
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
    if (error instanceof ErrorNegocio) return respuestaError(error);
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

    if (
      error.message &&
      (error.message.includes("Inventario insuficiente") ||
        error.message.includes("Cantidad excede"))
    ) {
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
    "COLABORADORES",
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
    if (error instanceof ErrorNegocio) return respuestaError(error);
    console.error("Error en reporte de liquidaciones de salida:", error);
    return new Response(
      JSON.stringify({ error: "Error al obtener liquidaciones de salida" }),
      { status: 500 },
    );
  }
}
