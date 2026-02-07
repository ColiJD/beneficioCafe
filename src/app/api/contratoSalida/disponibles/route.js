// src/app/api/clientes/pendientes/route.js
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { checkRole } from "@/lib/checkRole";

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { searchParams } = new URL(req.url);
    const compradorID = searchParams.get("clienteID");

    // ====================================================
    // 🟢 1) SI HAY compradorID → DEVOLVER CONTRATOS PENDIENTES DEL COMPRADOR
    // ====================================================
    if (compradorID) {
      const contratos = await prisma.contratoSalida.findMany({
        where: {
          compradorID: Number(compradorID),
          contratoMovimiento: {
            notIn: ["ANULADO", "Anulado", "anulado"],
          },
          estado: {
            not: "Anulado", // Allow "Liquidado" to re-check balance
          },
        },
        include: {
          compradores: { select: { compradorNombre: true } },
          detalleContratoSalida: {
            where: { tipoMovimiento: { not: "Anulado" } },
            select: { cantidadQQ: true },
          },
        },
      });

      const resultado = contratos
        .map((c) => {
          const cantidadEntregada = c.detalleContratoSalida.reduce(
            (sum, d) => sum + Number(d.cantidadQQ || 0),
            0
          );
          const cantidadInicial = Number(c.contratoCantidadQQ || 0);
          const saldoInicial = Number(c.contratoTotalLps || 0);
          const cantidadFaltante = cantidadInicial - cantidadEntregada;
          const completado = cantidadEntregada >= cantidadInicial;

          return {
            contratoID: c.contratoID,
            clienteNombreCompleto: c.compradores?.compradorNombre || "",
            saldoInicial,
            cantidadInicial,
            cantidadEntregada,
            cantidadFaltante,
            completado,
          };
        })
        .filter((c) => !c.completado); // Only return truly pending

      return Response.json(resultado);
    }

    // ====================================================
    // 🟡 2) SI NO HAY compradorID → LISTADO DE COMPRADORES PENDIENTES
    // ====================================================

    // Fetch all contracts that are NOT Anulado (check Liquidado too)
    const contratos = await prisma.contratoSalida.findMany({
      where: {
        contratoMovimiento: { notIn: ["ANULADO", "Anulado", "anulado"] },
        estado: { not: "Anulado" },
      },
      select: {
        contratoID: true,
        compradorID: true,
        contratoCantidadQQ: true,
        compradores: {
          select: { compradorNombre: true },
        },
        detalleContratoSalida: {
          where: { tipoMovimiento: { not: "Anulado" } },
          select: { cantidadQQ: true },
        },
      },
    });

    // Filter buyers who have at least one pending contract
    const compradoresMap = new Map();

    for (const c of contratos) {
      const entregado = c.detalleContratoSalida.reduce(
        (sum, d) => sum + Number(d.cantidadQQ || 0),
        0
      );
      const pactado = Number(c.contratoCantidadQQ || 0);

      if (entregado < pactado) {
        if (!compradoresMap.has(c.compradorID)) {
          compradoresMap.set(c.compradorID, {
            clienteID: c.compradorID,
            clienteNombreCompleto:
              c.compradores?.compradorNombre || "Sin Nombre",
          });
        }
      }
    }

    const resultado = Array.from(compradoresMap.values());

    return Response.json(resultado);
  } catch (error) {
    console.error("❌ Error al obtener contratos pendientes:", error);
    return new Response(
      JSON.stringify({ error: "No se pudieron cargar los contratos." }),
      { status: 500 }
    );
  }
}
