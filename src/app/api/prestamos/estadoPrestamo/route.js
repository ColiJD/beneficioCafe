// src/app/api/prestamos/pendientes/route.js
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
      // 🔹 Si se pasa clienteID: calcular préstamos pendientes por cliente
      const prestamos = await prisma.prestamos.findMany({
        where: {
          clienteId: Number(clienteID),
          estado: { not: "ANULADO" }, // ignorar préstamos anulados
          monto: { gt: 0 }, // solo préstamos con monto mayor a 0
        },
        include: {
          cliente: { select: { clienteNombre: true, clienteApellido: true } },
          movimientos_prestamo: {
            where: { tipo_movimiento: { not: "ANULADO" } },
          },
        },
      });

      if (prestamos.length === 0) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const resultado = prestamos.map((p) => {
        let totalAbono = 0;
        let totalPagoInteres = 0;
        let totalIntCargo = 0;

        for (const mov of p.movimientos_prestamo) {
          const monto = Number(mov.monto || 0);
          if (mov.tipo_movimiento === "ABONO") totalAbono += monto;
          else if (mov.tipo_movimiento === "PAGO_INTERES")
            totalPagoInteres += monto;
          else if (mov.tipo_movimiento === "Int-Cargo") totalIntCargo += monto;
        }

        const saldoInicial = Number(p.monto || 0);
        const saldoActual =
          Math.round(
            (saldoInicial + totalIntCargo - totalAbono - totalPagoInteres) * 100
          ) / 100;

        const completado = saldoActual <= 0;

        return {
          prestamoID: p.prestamoId,
          clienteNombreCompleto: `${p.cliente?.clienteNombre || ""} ${
            p.cliente?.clienteApellido || ""
          }`.trim(),
          saldoInicial,
          totalAbono,
          totalPagoInteres,
          totalIntCargo,
          saldoPendiente: saldoActual, // mantén valor real para filtrado
          completado,
        };
      });

      const pendientes = resultado.filter((p) => p.saldoPendiente > 0);

      return new Response(JSON.stringify(pendientes), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error al obtener contratos pendientes:", error);
    return new Response(
      JSON.stringify({ error: "No se pudieron cargar los contratos." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
