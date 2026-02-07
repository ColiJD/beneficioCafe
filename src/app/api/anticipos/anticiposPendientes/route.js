// src/app/api/anticipo/pendientes/route.js
import prisma from "@/lib/prisma";
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
    if (clienteID) {
      // 🔹 Si se pasa clienteID: calcular anticipos pendientes por cliente
      const anticipos = await prisma.anticipo.findMany({
        where: {
          clienteId: Number(clienteID),
          estado: { not: "ANULADO" }, // ignorar anticipos anulados
          monto: { gt: 0 }, // solo anticipos con monto mayor a 0
        },
        include: {
          cliente: { select: { clienteNombre: true, clienteApellido: true } },
          movimientos_anticipos: {
            where: { tipo_movimiento: { not: "ANULADO" } },
          },
        },
      });

      if (anticipos.length === 0) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const resultado = anticipos.map((a) => {
        let totalAbono = 0;
        let totalPagoInteres = 0;
        let totalIntCargo = 0;

        for (const mov of a.movimientos_anticipos) {
          const monto = Number(mov.monto || 0);
          if (mov.tipo_movimiento === "ABONO_ANTICIPO") totalAbono += monto;
          else if (mov.tipo_movimiento === "INTERES_ANTICIPO")
            totalPagoInteres += monto;
          else if (mov.tipo_movimiento === "CARGO_ANTICIPO")
            totalIntCargo += monto;
        }

        const saldoInicial = Number(a.monto || 0);
        const saldoPendiente =
          Math.round(
            (saldoInicial + totalIntCargo - totalAbono - totalPagoInteres) * 100
          ) / 100;

        const completado = saldoPendiente <= 0;

        return {
          anticipoID: a.anticipoId,
          clienteNombreCompleto: `${a.cliente?.clienteNombre || ""} ${
            a.cliente?.clienteApellido || ""
          }`.trim(),
          saldoInicial,
          totalAbono,
          totalPagoInteres,
          totalIntCargo,
          saldoPendiente, // mantener el valor real para filtrado
          completado,
        };
      });

      const pendientes = resultado.filter((a) => a.saldoPendiente > 0);

      return new Response(JSON.stringify(pendientes), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error al obtener anticipos pendientes:", error);
    return new Response(
      JSON.stringify({ error: "No se pudieron cargar los anticipos." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
