// src/app/api/liqDeposito/clienteConDeposito/route.js
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { checkRole } from "@/lib/checkRole";

export async function GET(req) {
  // 🔹 Validación de roles
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

    if (clienteID) {
      // 🔹 Si se pasa clienteID: calcular depósitos pendientes por cliente
      const depositos = await prisma.deposito.findMany({
        where: {
          clienteID: Number(clienteID),
          depositoMovimiento: { not: "ANULADO" }, // ignorar depósitos anulados
        },
        include: {
          cliente: { select: { clienteNombre: true, clienteApellido: true } },
        },
      });

      if (depositos.length === 0) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const depositoIds = depositos.map((d) => d.depositoID);

      const totales = await prisma.$queryRaw(
        Prisma.sql`
    SELECT
      dl.depositoID,
      COALESCE(SUM(
        CASE WHEN dl.movimiento != 'ANULADO' AND lq.liqMovimiento != 'ANULADO'
        THEN dl.cantidadQQ ELSE 0 END
      ), 0) AS cantidadEntregada,
      COALESCE(SUM(
        CASE WHEN dl.movimiento != 'ANULADO' AND lq.liqMovimiento != 'ANULADO'
        THEN dl.totalLps ELSE 0 END
      ), 0) AS totalLiquidado
    FROM detalleliqdeposito dl
    JOIN liqdeposito lq ON lq.liqID = dl.liqID
    WHERE dl.depositoID IN (${Prisma.join(depositoIds)})
    GROUP BY dl.depositoID
  `
      );

      const totalesMap = new Map(
        totales.map((t) => [
          t.depositoID,
          {
            cantidadEntregada: Number(t.cantidadEntregada),
            totalLiquidado: Number(t.totalLiquidado),
          },
        ])
      );

      const resultado = depositos
        .map((d) => {
          const totalesDeposito = totalesMap.get(d.depositoID) || {
            cantidadEntregada: 0,
            totalLiquidado: 0,
          };
          const cantidadTotal = Number(d.depositoCantidadQQ || 0);
          const totalLps = Number(d.depositoTotalSacos || 0);
          const cantidadEntregada = totalesDeposito.cantidadEntregada;
          const cantidadFaltante = cantidadTotal - cantidadEntregada;
          const totalLiquidado = totalesDeposito.totalLiquidado;
          const faltanteLps = totalLps - totalLiquidado;

          const completado =
            cantidadEntregada >= cantidadTotal && totalLiquidado >= totalLps;

          return {
            depositoID: d.depositoID,
            clienteNombreCompleto: `${d.cliente?.clienteNombre || ""} ${
              d.cliente?.clienteApellido || ""
            }`.trim(),
            cantidadTotal,
            cantidadEntregada,
            cantidadFaltante,
            totalLps,
            totalLiquidado,
            faltanteLps,
            completado,
          };
        })
        .filter((d) => !d.completado);

      return new Response(JSON.stringify(resultado), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 🟡 Si NO se pasa clienteID: devolver todos los clientes con depósitos pendientes
    const clientesPendientes = await prisma.$queryRaw`
      SELECT 
        cl.clienteID,
        cl.clienteNombre,
        cl.clienteApellido
      FROM cliente cl
      LEFT JOIN (
        SELECT
          d.clienteID,
          SUM(d.depositoCantidadQQ) AS cantidadTotal,
          SUM(d.depositoTotalSacos) AS totalLps
        FROM deposito d
        WHERE d.depositoMovimiento != 'ANULADO'
        GROUP BY d.clienteID
      ) dep ON dep.clienteID = cl.clienteID
     LEFT JOIN (
  SELECT
    dp.clienteID,
    SUM(CASE WHEN dl.movimiento != 'ANULADO' THEN dl.cantidadQQ ELSE 0 END) AS cantidadEntregada,
    SUM(CASE WHEN dl.movimiento != 'ANULADO' THEN dl.totalLps ELSE 0 END) AS totalLiquidado
  FROM deposito dp
  JOIN detalleliqdeposito dl
    ON dl.depositoID = dp.depositoID
  JOIN liqdeposito lq
    ON lq.liqID = dl.liqID
    AND lq.liqMovimiento != 'ANULADO'
  WHERE dp.depositoMovimiento != 'ANULADO'
  GROUP BY dp.clienteID
) liq ON liq.clienteID = cl.clienteID

      WHERE (COALESCE(dep.cantidadTotal, 0) - COALESCE(liq.cantidadEntregada, 0)) > 0
         OR (COALESCE(dep.totalLps, 0) - COALESCE(liq.totalLiquidado, 0)) > 0;
    `;

    const resultado = clientesPendientes.map((c) => ({
      clienteID: c.clienteID,
      clienteNombreCompleto: `${c.clienteNombre || ""} ${
        c.clienteApellido || ""
      }`.trim(),
    }));

    return new Response(JSON.stringify(resultado), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error al obtener depósitos pendientes:", error);
    return new Response(
      JSON.stringify({ error: "No se pudieron cargar los depósitos." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
