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
          { status: 500 },
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

    // 🔹 Ejecución en paralelo de todas las consultas
    const [salidas, comprasSalida, contratos, prestamos, anticipos] =
      await Promise.all([
        // 1. ConfirmacionVenta (Salidas)
        prisma.salida.findMany({
          where: {
            compradorID: Number(compradorID),
            salidaFecha: { gte: startDate, lte: endDate },
            salidaMovimiento: { not: "Anulado" },
          },
          include: {
            detalleliqsalida: {
              where: { movimiento: { not: "Anulado" } },
            },
            producto: { select: { productName: true } },
          },
          orderBy: { salidaFecha: "asc" },
        }),

        // 2. Compras (Tipo movimiento "Salida")
        prisma.compra.findMany({
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
        }),

        // 3. Contratos de Salida
        prisma.contratoSalida.findMany({
          where: {
            compradorID: Number(compradorID),
            contratoMovimiento: "Salida",
            contratoFecha: { gte: startDate, lte: endDate },
            estado: { not: "Anulado" },
          },
          select: {
            contratoID: true,
            contratoFecha: true,
            contratoCantidadQQ: true,
            contratoPrecio: true,
            contratoDescripcion: true,
            detalleContratoSalida: {
              where: { tipoMovimiento: { not: "Anulado" } },
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
        }),

        // 4. Préstamos de Compradores
        prisma.prestamos_compradores.findMany({
          where: {
            compradorId: Number(compradorID),
            fecha: { gte: startDate, lte: endDate },
            estado: { not: "ANULADO" },
          },
          include: {
            movimientos_prestamo: {
              where: { tipo_movimiento: { not: "ANULADO" } },
            },
          },
          orderBy: { fecha: "asc" },
        }),

        // 5. Anticipos de Compradores
        prisma.anticipo_compradores.findMany({
          where: {
            compradorId: Number(compradorID),
            fecha: { gte: startDate, lte: endDate },
            estado: { not: "ANULADO" },
          },
          include: {
            movimientos_anticipos: {
              where: { tipo_movimiento: { not: "ANULADO" } },
            },
          },
          orderBy: { fecha: "asc" },
        }),
      ]);

    /** -------- PROCESAMIENTO CONFIRMACION DE VENTA (SALIDAS) -------- */
    let detallesSalidas = [];
    let totalsSalidas = { totalQQ: 0, totalLps: 0, promedioPrecio: 0 };

    try {
      detallesSalidas = salidas.map((s) => {
        const cantidadQQ = Number(s.salidaCantidadQQ) || 0;
        const precioQQ = Number(s.salidaPrecio) || 0;
        const producto = s.producto?.productName || "Desconocido";

        const totalQQEntregado = s.detalleliqsalida.reduce(
          (sum, d) => sum + Number(d.cantidadQQ || 0),
          0,
        );

        const totalQQPorLiquidar = cantidadQQ - totalQQEntregado;

        return {
          id: s.salidaID,
          fecha: s.salidaFecha,
          descripcion: s.salidaDescripcion || "Confirmación de Venta",
          producto,
          cantidadQQ, // Inicial QQ
          totalQQ: totalQQEntregado, // Entregado según liquidaciones
          totalQQPorLiquidar, // Pendiente real
          precioQQ,
          totalLps: cantidadQQ * precioQQ, // Calculado con INICIAL
          liquidado: totalQQPorLiquidar <= 0 ? "Sí" : "No",
        };
      });

      const totalQQSalidas = detallesSalidas.reduce(
        (sum, s) => sum + s.cantidadQQ,
        0,
      );
      const totalLpsSalidas = detallesSalidas.reduce(
        (sum, s) => sum + s.totalLps,
        0,
      );
      const promedioPrecioSalidas =
        totalQQSalidas > 0 ? totalLpsSalidas / totalQQSalidas : 0;

      totalsSalidas = {
        totalQQ: totalQQSalidas,
        totalLps: totalLpsSalidas,
        promedioPrecio: promedioPrecioSalidas,
      };
    } catch (error) {
      console.error("Error processing Salidas:", error);
    }

    /** -------- PROCESAMIENTO COMPRAS (VENTA) -------- */
    let detallesComprasSalida = [];
    let totalsCompras = { totalQQ: 0, totalLps: 0, promedioPrecio: 0 };

    try {
      detallesComprasSalida = comprasSalida.map((c) => {
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
        0,
      );
      const totalLpsCompras = detallesComprasSalida.reduce(
        (sum, c) => sum + c.totalLps,
        0,
      );
      const promedioPrecioCompras =
        totalQQCompras > 0 ? totalLpsCompras / totalQQCompras : 0;
      totalsCompras = {
        totalQQ: totalQQCompras,
        totalLps: totalLpsCompras,
        promedioPrecio: promedioPrecioCompras,
      };
    } catch (error) {
      console.error("Error processing Compras:", error);
    }

    /** -------- PROCESAMIENTO CONTRATOS -------- */
    let detallesContratos = [];
    let totalsContratos = { totalQQ: 0, totalLps: 0, promedioPrecio: 0 };

    try {
      detallesContratos = contratos.map((c) => {
        const detalles = c.detalleContratoSalida.map((d) => {
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
          0,
        );
        const totalLpsEntregado = detalles.reduce(
          (sum, d) => sum + d.totalLps,
          0,
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
        0,
      );
      const totalLpsContratos = detallesContratos.reduce(
        (sum, c) => sum + c.totalLps,
        0,
      );

      totalsContratos = {
        totalQQ: totalQQContratos,
        totalLps: totalLpsContratos,
        promedioPrecio:
          totalQQContratos > 0 ? totalLpsContratos / totalQQContratos : 0,
      };
    } catch (error) {
      console.error("Error processing Contratos:", error);
    }

    /** -------- PROCESAMIENTO PRESTAMOS -------- */
    const processedPrestamos = (prestamos || []).map((p) => {
      const movimientos = (p.movimientos_prestamo || []).map((m) => ({
        movimientoId: m.MovimientoId,
        fecha: m.fecha,
        tipo: m.tipo_movimiento,
        monto: Number(m.monto) || 0,
        interes: Number(m.interes) || 0,
        descripcion: m.descripcion || "-",
      }));

      const montoTotal =
        Number(p.monto || 0) +
        movimientos
          .filter((m) => ["PRESTAMO", "Int-Cargo"].includes(m.tipo))
          .reduce((sum, m) => sum + m.monto, 0);

      const abonado = movimientos
        .filter((m) =>
          ["ABONO", "PAGO_INTERES", "ABONO_INTERES"].includes(m.tipo),
        )
        .reduce((sum, m) => sum + m.monto, 0);

      return {
        prestamoId: p.prestamoId,
        fecha: p.fecha,
        monto: montoTotal,
        abonado,
        total: montoTotal - abonado,
        tipo: "PRESTAMO",
        estado: p.estado,
        tasaInteres: Number(p.tasa_interes) || 0,
        observacion: p.observacion || "-",
        movimientos,
      };
    });

    /** -------- PROCESAMIENTO ANTICIPOS -------- */
    const processedAnticipos = (anticipos || []).map((a) => {
      const movimientos = (a.movimientos_anticipos || []).map((m) => ({
        movimientoId: m.MovimientoId,
        fecha: m.fecha,
        tipo: m.tipo_movimiento,
        monto: Number(m.monto) || 0,
        interes: Number(m.interes) || 0,
        descripcion: m.descripcion || "-",
      }));

      const montoTotal =
        Number(a.monto || 0) +
        movimientos
          .filter((m) => ["ANTICIPO", "CARGO_ANTICIPO"].includes(m.tipo))
          .reduce((sum, m) => sum + m.monto, 0);

      const abonado = movimientos
        .filter((m) => ["ABONO_ANTICIPO", "INTERES_ANTICIPO"].includes(m.tipo))
        .reduce((sum, m) => sum + m.monto, 0);

      return {
        anticipoId: a.anticipoId,
        fecha: a.fecha,
        monto: montoTotal,
        abonado,
        total: montoTotal - abonado,
        tipo: "ANTICIPO",
        estado: a.estado,
        tasaInteres: Number(a.tasa_interes) || 0,
        observacion: a.observacion || "-",
        movimientos,
      };
    });

    const Totales = {
      ConfirmacionVenta: totalsSalidas,
      Venta: totalsCompras,
      Contratos: totalsContratos,
    };

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

    return new Response(
      JSON.stringify({
        movimientos: {
          ConfirmacionVenta: detallesSalidas,
          Ventas: detallesComprasSalida,
          Contratos: detallesContratos,
          Prestamos: processedPrestamos,
          Anticipos: processedAnticipos,
        },
        Totales,
        filas: [filaConfirmacionVenta, filaComprasSalida, filaContratos],
      }),
      { status: 200 },
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Error al obtener movimientos del comprador" }),
      { status: 500 },
    );
  }
}
