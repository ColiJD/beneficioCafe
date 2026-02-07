import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
export async function POST(req) {
  try {
    const body = await req.json();
    const { compradorID, cantidadLiquidar, descripcion } = body;

    const compradorIdNum = Number(compradorID);
    const cantidadSolicitada = Number(cantidadLiquidar);

    if (
      isNaN(compradorIdNum) ||
      isNaN(cantidadSolicitada) ||
      cantidadSolicitada <= 0
    ) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios o inválidos" },
        { status: 400 }
      );
    }

    const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    const resultado = await prisma.$transaction(async (tx) => {
      let cantidad = roundToTwo(cantidadSolicitada);

      // ----------------------------
      // ✔ Verificar inventario global disponible
      // ----------------------------
      const totalInventario = await tx.inventariocliente.aggregate({
        _sum: { cantidadQQ: true },
      });

      const inventarioDisponible = roundToTwo(
        Number(totalInventario._sum?.cantidadQQ ?? 0)
      );

      if (inventarioDisponible < cantidad) {
        throw new Error(
          `Inventario insuficiente. Disponible: ${inventarioDisponible.toFixed(
            2
          )} QQ, Solicitado: ${cantidad.toFixed(2)} QQ`
        );
      }

      // ----------------------------
      // ✔ Obtener salidas válidas (NO ANULADAS)
      // ✔ No filtrar detalles en SQL (evita convertir LEFT JOIN en INNER)
      // ----------------------------
      const salidas = await tx.salida.findMany({
        where: {
          compradorID: compradorIdNum,
          salidaMovimiento: { notIn: ["ANULADO", "Anulado", "anulado"] },
        },
        orderBy: { salidaFecha: "asc" },
        include: {
          detalleliqsalida: {
            select: { cantidadQQ: true, movimiento: true },
            // ❌ NO usar notIn aquí, se filtra manualmente
          },
        },
      });

      // ----------------------------
      // ✔ Calcular pendientes con filtro correcto:
      //   d.movimiento IS NULL OR d.movimiento NOT IN (...)
      // ----------------------------
      const pendientes = salidas
        .map((s) => {
          const totalLiquidado = s.detalleliqsalida
            .filter(
              (d) =>
                d.movimiento === null ||
                !["ANULADO", "Anulado", "anulado"].includes(d.movimiento)
            )
            .reduce((acc, d) => acc + Number(d.cantidadQQ || 0), 0);

          const totalLiquidadoRounded = roundToTwo(totalLiquidado);
          const pendiente = roundToTwo(
            Number(s.salidaCantidadQQ) - totalLiquidadoRounded
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
          compradores: { connect: { compradorId: compradorIdNum } }, // Relación correcta
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
      // ✔ Reducir inventario global (FIFO)
      // ----------------------------
      const inventarios = await tx.inventariocliente.findMany({
        orderBy: { inventarioClienteID: "asc" },
      });

      let restanteQQ = roundToTwo(cantidadSolicitada);
      const movimientosACrear = [];

      for (const inv of inventarios) {
        if (restanteQQ <= 0) break;

        const cantidadDisponible = roundToTwo(Number(inv.cantidadQQ));
        if (cantidadDisponible <= 0) continue;

        const descontarQQ = roundToTwo(
          Math.min(restanteQQ, cantidadDisponible)
        );

        // Actualizar inventario
        await tx.inventariocliente.update({
          where: { inventarioClienteID: inv.inventarioClienteID },
          data: {
            cantidadQQ: { decrement: descontarQQ },
          },
        });

        // Preparar movimiento para crear en lote
        movimientosACrear.push({
          inventarioClienteID: inv.inventarioClienteID,
          tipoMovimiento: "Salida",
          referenciaTipo: "Liquidación Salida",
          referenciaID: liqSalida.liqSalidaID,
          cantidadQQ: descontarQQ,
          nota: `Liquidación de salida #${liqSalida.liqSalidaID} - Comprador ID: ${compradorIdNum}`,
        });

        restanteQQ = roundToTwo(restanteQQ - descontarQQ);
      }

      // Crear todos los movimientos en una sola operación
      if (movimientosACrear.length > 0) {
        await tx.movimientoinventario.createMany({
          data: movimientosACrear,
        });
      }

      // Verificación final (margen por decimales)
      if (restanteQQ > 0) {
        // Mayor a 0 exacto porque roundToTwo ya maneja precisión
        // Ojo: si roundToTwo funcionó perfecto, esto debería ser 0 exácto.
        // Pero por seguridad podemos dejar un margen minúsculo o confiar en el redondeo
      }

      if (restanteQQ > 0.009) {
        throw new Error(
          `Error interno: No se pudo descontar todo el inventario. Faltan ${restanteQQ.toFixed(
            2
          )} QQ`
        );
      }

      return liqSalida;
    });

    return NextResponse.json(
      { liqSalidaID: resultado.liqSalidaID },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error FIFO transacción:", error);

    if (error.message === "NO_PENDIENTES") {
      return NextResponse.json(
        { error: "No hay salidas pendientes para este comprador" },
        { status: 400 }
      );
    }

    // Manejar error de inventario insuficiente
    if (error.message && error.message.includes("Inventario insuficiente")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Error interno" }, { status: 500 });
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
      { status: 500 }
    );
  }
}
