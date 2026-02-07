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
    const clienteID = searchParams.get("clienteID");

    // ====================================================
    // 🟢 1) SI HAY clienteID → DEVOLVER CONTRATOS PENDIENTES DEL CLIENTE
    // ====================================================
    if (clienteID) {
      const contratos = await prisma.contrato.findMany({
        where: {
          contratoclienteID: Number(clienteID),

          // ❌ ignorar contratos anulados (todas las variantes)
          contratoMovimiento: {
            notIn: ["ANULADO", "Anulado", "anulado"],
          },
        },
        include: {
          cliente: { select: { clienteNombre: true, clienteApellido: true } },
        },
      });

      if (contratos.length === 0) {
        return Response.json([]);
      }

      const contratoIds = contratos.map((c) => c.contratoID);

      // 🔥 Calcular totales reales SOLO con detalles válidos
      const totales = await prisma.$queryRaw(
        Prisma.sql`
          SELECT
            dc.contratoID,
            COALESCE(SUM(dc.cantidadQQ * dc.precioQQ), 0) AS totalDetalle,
            COALESCE(SUM(dc.cantidadQQ), 0) AS cantidadEntregada
          FROM detallecontrato dc
          WHERE dc.contratoID IN (${Prisma.join(contratoIds)})
            AND dc.tipoMovimiento NOT IN ('ANULADO', 'Anulado', 'anulado')
          GROUP BY dc.contratoID
        `
      );

      const totalesMap = new Map(
        totales.map((t) => [
          t.contratoID,
          {
            totalDetalle: Number(t.totalDetalle),
            cantidadEntregada: Number(t.cantidadEntregada),
          },
        ])
      );

      const resultado = contratos
        .map((c) => {
          const tot = totalesMap.get(c.contratoID) || {
            totalDetalle: 0,
            cantidadEntregada: 0,
          };

          const cantidadInicial = Number(c.contratoCantidadQQ || 0);
          const saldoInicial = Number(c.contratoTotalLps || 0);

          const cantidadFaltante = cantidadInicial - tot.cantidadEntregada;
          const faltanteSaldo = saldoInicial - tot.totalDetalle;

          const completado = tot.cantidadEntregada >= cantidadInicial;

          return {
            contratoID: c.contratoID,
            clienteNombreCompleto: `${c.cliente?.clienteNombre || ""} ${
              c.cliente?.clienteApellido || ""
            }`.trim(),

            saldoInicial,
            totalDetalle: tot.totalDetalle,
            faltante: faltanteSaldo,

            cantidadInicial,
            cantidadEntregada: tot.cantidadEntregada,
            cantidadFaltante,

            completado,
          };
        })
        .filter((c) => !c.completado); // 🔥 Solo contratos pendientes

      return Response.json(resultado);
    }

    // ====================================================
    // 🟡 2) SI NO HAY clienteID → LISTADO DE CLIENTES PENDIENTES
    // ====================================================
    const clientesPendientes = await prisma.$queryRaw`
      SELECT 
        cl.clienteID,
        cl.clienteNombre,
        cl.clienteApellido
      FROM cliente cl
      LEFT JOIN (
        -- Cantidad TOTAL inicial de contratos
        SELECT
          contratoclienteID,
          SUM(contratoCantidadQQ) AS cantidadInicialTotal
        FROM contrato
        WHERE contratoMovimiento NOT IN ('ANULADO', 'Anulado', 'anulado')
        GROUP BY contratoclienteID
      ) ctot ON ctot.contratoclienteID = cl.clienteID
      LEFT JOIN (
        -- Cantidad total ENTREGADA (solo detalles válidos)
        SELECT
          c.contratoclienteID,
          SUM(dc.cantidadQQ) AS cantidadEntregadaTotal
        FROM contrato c
        JOIN detallecontrato dc
          ON dc.contratoID = c.contratoID
         AND dc.tipoMovimiento NOT IN ('ANULADO', 'Anulado', 'anulado')
        WHERE c.contratoMovimiento NOT IN ('ANULADO', 'Anulado', 'anulado')
        GROUP BY c.contratoclienteID
      ) dent ON dent.contratoclienteID = cl.clienteID
      WHERE (COALESCE(ctot.cantidadInicialTotal, 0) - COALESCE(dent.cantidadEntregadaTotal, 0)) > 0
    `;

    const resultado = clientesPendientes.map((c) => ({
      clienteID: c.clienteID,
      clienteNombreCompleto: `${c.clienteNombre || ""} ${
        c.clienteApellido || ""
      }`.trim(),
    }));

    return Response.json(resultado);
  } catch (error) {
    console.error("❌ Error al obtener contratos pendientes:", error);
    return new Response(
      JSON.stringify({ error: "No se pudieron cargar los contratos." }),
      { status: 500 }
    );
  }
}
