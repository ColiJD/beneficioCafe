import prisma from "@/lib/prisma";

export async function GET(req, { params }) {
  const compradorID = Number(params.compradorID);

  if (isNaN(compradorID) || compradorID <= 0) {
    return new Response(
      JSON.stringify({
        error: "compradorID es obligatorio y debe ser un número válido",
      }),
      { status: 400 }
    );
  }

  try {
    // Obtener todas las salidas del comprador (NO ANULADAS)
    const salidas = await prisma.salida.findMany({
      where: {
        compradorID,
        salidaMovimiento: {
          notIn: ["ANULADO", "Anulado", "anulado"],
        },
      },
      select: {
        salidaID: true,
        salidaCantidadQQ: true,
        salidaDescripcion: true,

        // LEFT JOIN detalles
        detalleliqsalida: {
          select: { cantidadQQ: true, movimiento: true },

          // NO usar notIn directo porque elimina el registro completo
          // Filtraremos manualmente después
        },
      },
    });

    // PROCESAR SUMAS (aplicando IS NULL + NOT IN para detalle)
    const pendientes = salidas
      .map((s) => {
        const entregado = s.detalleliqsalida
          // Aplicar NOT IN y permitir movimiento null
          .filter(
            (d) =>
              d.movimiento === null ||
              !["ANULADO", "Anulado", "anulado"].includes(d.movimiento)
          )
          .reduce((acc, d) => acc + Number(d.cantidadQQ || 0), 0);

        return {
          salidaID: s.salidaID,
          cantidadPendiente: Number(s.salidaCantidadQQ) - entregado,
          detalles: s.salidaDescripcion,
        };
      })
      .filter((s) => s.cantidadPendiente > 0);

    // TOTAL GENERAL
    const cantidadPendiente = pendientes.reduce(
      (acc, s) => acc + s.cantidadPendiente,
      0
    );

    return new Response(
      JSON.stringify({
        cantidadPendiente,
        detalles: pendientes,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: "Error obteniendo salidas pendientes" }),
      { status: 500 }
    );
  }
}
