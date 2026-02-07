import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const compradorID = searchParams.get("compradorID");
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");

    if (!compradorID) {
      try {
        const compradores = await prisma.compradores.findMany();
        return new Response(JSON.stringify(compradores), { status: 200 });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Error cargando compradores" }),
          { status: 500 }
        );
      }
    }

    // Validar fechas
    const startDate = fechaInicio
      ? new Date(fechaInicio)
      : new Date("1970-01-01");
    // Ajustar fecha fin al final del día
    const endDate = fechaFin
      ? new Date(new Date(fechaFin).setHours(23, 59, 59, 999))
      : new Date();

    /** -------- COMPRAS (marcadas como Salida) -------- */
    // Segun reporteSalidas, existen compras con movimiento "Salida" vinculadas a compradorID

    // Initialize result containers
    let detallesSalidas = [];
    let totalsSalidas = { totalQQ: 0, totalLps: 0, promedioPrecio: 0 };
    let detallesComprasSalida = [];
    let totalsCompras = { totalQQ: 0, totalLps: 0, promedioPrecio: 0 };
    let detallesContratos = [];
    let totalsContratos = { totalQQ: 0, totalLps: 0, promedioPrecio: 0 };

    /** -------- CONFIRMACION DE VENTA (salida) -------- */
    try {
      const salidas = await prisma.salida.findMany({
        where: {
          compradorID: Number(compradorID),
          salidaFecha: { gte: startDate, lte: endDate },
          NOT: { salidaMovimiento: "Anulado" },
        },
        include: {
          detalleliqsalida: true, // Traemos las liquidaciones
        },
        orderBy: { salidaFecha: "asc" },
      });

      detallesSalidas = salidas.map((s) => {
        const cantidadQQ = Number(s.salidaCantidadQQ) || 0;
        const precioQQ = Number(s.salidaPrecio) || 0;

        // Filtrar liquidaciones anuladas
        const totalQQEntregado = s.detalleliqsalida
          .filter((d) => d.movimiento !== "Anulado")
          .reduce((sum, d) => sum + Number(d.cantidadQQ || 0), 0);

        const totalQQPorLiquidar = cantidadQQ - totalQQEntregado;

        return {
          id: s.salidaID,
          fecha: s.salidaFecha,
          descripcion: s.salidaDescripcion || "Confirmación de Venta",
          cantidadQQ, // Inicial QQ
          totalQQ: totalQQEntregado, // Entregado según liquidaciones
          totalQQPorLiquidar, // Pendiente real
          precioQQ,
          totalLps: cantidadQQ * precioQQ, // Calculado con INICIAL
          liquidado: totalQQPorLiquidar <= 0 ? "Sí" : "No",
        };
      });

      // Totales generales
      const totalQQSalidas = detallesSalidas.reduce(
        (sum, s) => sum + s.cantidadQQ, // SUMA DE INICIALES
        0
      );
      const totalLpsSalidas = detallesSalidas.reduce(
        (sum, s) => sum + s.totalLps,
        0
      );
      const promedioPrecioSalidas =
        totalQQSalidas > 0 ? totalLpsSalidas / totalQQSalidas : 0;

      totalsSalidas = {
        totalQQ: totalQQSalidas,
        totalLps: totalLpsSalidas,
        promedioPrecio: promedioPrecioSalidas,
      };
    } catch (error) {
      console.error("Error fetching ConfirmacionVenta:", error);
    }

    /** -------- COMPRAS (Venta) -------- */
    try {
      const comprasSalida = await prisma.compra.findMany({
        where: {
          compradorID: Number(compradorID),
          compraMovimiento: "Salida",
          compraFecha: { gte: startDate, lte: endDate },
        },
        select: {
          compraId: true,
          compraFecha: true,
          compraCantidadQQ: true,
          compraPrecioQQ: true,
          producto: { select: { productName: true } },
        },
        orderBy: { compraFecha: "asc" },
      });

      detallesComprasSalida = comprasSalida
        .filter((c) => c.tipoMovimiento !== "Anulado")
        .map((c) => {
          const cantidadQQ = Number(c.compraCantidadQQ) || 0;
          const precioQQ = Number(c.compraPrecioQQ) || 0;
          return {
            fecha: c.compraFecha,
            producto: c.producto?.productName,
            cantidadQQ,
            precioQQ,
            totalLps: cantidadQQ * precioQQ,
            compraId: c.compraId,
          };
        });

      const totalQQCompras = detallesComprasSalida.reduce(
        (sum, c) => sum + c.cantidadQQ,
        0
      );
      const totalLpsCompras = detallesComprasSalida.reduce(
        (sum, c) => sum + c.totalLps,
        0
      );
      const promedioPrecioCompras =
        totalQQCompras > 0
          ? detallesComprasSalida.reduce(
              (sum, c) => sum + c.precioQQ * c.cantidadQQ,
              0
            ) / totalQQCompras
          : 0;
      totalsCompras = {
        totalQQ: totalQQCompras,
        totalLps: totalLpsCompras,
        promedioPrecio: promedioPrecioCompras,
      };
    } catch (error) {
      console.error("Error fetching Ventas:", error);
    }

    /** -------- CONTRATOS DE SALIDA -------- */
    try {
      const contratos = await prisma.contratoSalida.findMany({
        where: {
          compradorID: Number(compradorID),
          contratoMovimiento: "Salida",
          contratoFecha: { gte: startDate, lte: endDate },
          NOT: { estado: "Anulado" }, // si usas estado para eliminar
        },
        select: {
          contratoID: true,
          contratoFecha: true,
          contratoCantidadQQ: true,
          contratoPrecio: true,
          contratoDescripcion: true,
          detalleContratoSalida: {
            select: {
              detalleID: true,
              fecha: true,
              cantidadQQ: true,
              precioQQ: true,
              tipoMovimiento: true,
            },
          },
        },
        orderBy: { contratoFecha: "asc" },
      });

      detallesContratos = contratos.map((c) => {
        // Filtrar detalles anulados si aplica
        const detalles = c.detalleContratoSalida
          .filter((d) => d.tipoMovimiento !== "Anulado")
          .map((d) => {
            const cantidadQQ = Number(d.cantidadQQ) || 0;
            const precioQQ = Number(d.precioQQ) || 0;

            return {
              id: d.detalleID,
              fecha: d.fecha,
              producto: c.contratoDescripcion,
              cantidadQQ,
              precioQQ,
              totalLps: cantidadQQ * precioQQ,
            };
          });

        const totalQQEntregado = detalles.reduce(
          (sum, d) => sum + d.cantidadQQ,
          0
        );
        const totalLpsEntregado = detalles.reduce(
          (sum, d) => sum + d.totalLps,
          0
        );

        const cantidadContrato = Number(c.contratoCantidadQQ) || 0;
        const totalQQPorLiquidar = cantidadContrato - totalQQEntregado;

        return {
          contratoID: c.contratoID,
          fecha: c.contratoFecha,
          descripcion: c.contratoDescripcion,
          cantidadContrato,
          totalQQ: totalQQEntregado,
          totalQQPorLiquidar,
          liquidado: totalQQPorLiquidar <= 0 ? "Sí" : "No",
          precioQQ: Number(c.contratoPrecio) || 0,
          totalLps: totalLpsEntregado,
          detalles,
        };
      });

      const totalQQContratos = detallesContratos.reduce(
        (sum, c) => sum + c.totalQQ,
        0
      );
      const totalLpsContratos = detallesContratos.reduce(
        (sum, c) => sum + c.totalLps,
        0
      );

      totalsContratos = {
        totalQQ: totalQQContratos,
        totalLps: totalLpsContratos,
        promedioPrecio:
          totalQQContratos > 0 ? totalLpsContratos / totalQQContratos : 0,
      };
    } catch (error) {
      console.error("Error fetching Contratos:", error);
    }

    const filaConfirmacionVenta = {
      tipo: "ConfirmacionVenta",
      ...totalsSalidas,
      detalles: detallesSalidas,
    };
    const filaComprasSalida = {
      tipo: "Venta",
      ...totalsCompras,
      detalles: detallesComprasSalida,
    };
    const filaContratos = {
      tipo: "Contrato",
      ...totalsContratos,
      detalles: detallesContratos,
    };

    const Totales = {
      ConfirmacionVenta: totalsSalidas,
      Venta: totalsCompras,
      Contratos: totalsContratos,
    };

    return new Response(
      JSON.stringify({
        movimientos: {
          ConfirmacionVenta: detallesSalidas,
          Ventas: detallesComprasSalida,
          Contratos: detallesContratos,
        },
        Totales,
        filas: [filaConfirmacionVenta, filaComprasSalida, filaContratos],
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Error al obtener movimientos del comprador" }),
      { status: 500 }
    );
  }
}
