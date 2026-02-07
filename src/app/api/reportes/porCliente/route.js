import prisma from "@/lib/prisma";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const clienteID = searchParams.get("clienteID");
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");

    if (!clienteID) {
      return new Response(JSON.stringify({ error: "Se requiere clienteID" }), {
        status: 400,
      });
    }

    // Validar fechas
    const startDate = fechaInicio
      ? new Date(fechaInicio)
      : new Date("1970-01-01");
    const endDate = fechaFin ? new Date(fechaFin) : new Date();

    /** -------- COMPRAS -------- */
    const compras = await prisma.compra.findMany({
      where: {
        clienteID: Number(clienteID),
        compraFecha: { gte: startDate, lte: endDate },
        compraMovimiento: "Entrada",
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

    const detallesCompras = compras
      .filter((c) => c.tipoMovimiento !== "Anulado")
      .map((c) => {
        const cantidadQQ = Number(c.compraCantidadQQ) || 0;
        const precioQQ = Number(c.compraPrecioQQ) || 0;
        return {
          fecha: c.compraFecha,
          producto: c.producto?.productName || "-",
          cantidadQQ,
          precioQQ,
          totalLps: cantidadQQ * precioQQ,
          compraId: c.compraId,
        };
      });

    const totalQQCompras = detallesCompras.reduce(
      (sum, c) => sum + c.cantidadQQ,
      0
    );
    const totalLpsCompras = detallesCompras.reduce(
      (sum, c) => sum + c.totalLps,
      0
    );
    const promedioPrecioCompras =
      totalQQCompras > 0
        ? detallesCompras.reduce(
            (sum, c) => sum + c.precioQQ * c.cantidadQQ,
            0
          ) / totalQQCompras
        : 0;

    /** -------- CONTRATOS -------- */
    const contratos = await prisma.contrato.findMany({
      where: {
        contratoclienteID: Number(clienteID),
        contratoMovimiento: "Contrato",
      },
      select: {
        contratoID: true,
        contratoFecha: true,
        contratoDescripcion: true,
        producto: { select: { productName: true } },
        contratoCantidadQQ: true,
        detallecontrato: {
          where: { tipoMovimiento: "Entrada" }, // solo entradas
          select: {
            detalleID: true,
            cantidadQQ: true,
            precioQQ: true,
            fecha: true,
            observaciones: true,
          },
        },
      },
      orderBy: { contratoFecha: "asc" },
    });

    // Preparar detalles por contrato y calcular totales
    const detallesContratos = contratos
      .filter((d) => d.tipoMovimiento !== "Anulado")
      .map((contrato) => {
        const detalles = contrato.detallecontrato.map((d) => {
          const cantidadQQ = Number(d.cantidadQQ) || 0;
          const precioQQ = Number(d.precioQQ) || 0;
          return {
            detalleID: d.detalleID,
            fecha: d.fecha,
            producto: contrato.producto?.productName || "-",
            cantidadQQ,
            precioQQ,
            totalLps: cantidadQQ * precioQQ,
          };
        });

        const totalQQ = detalles.reduce((sum, d) => sum + d.cantidadQQ, 0);
        const totalLps = detalles.reduce((sum, d) => sum + d.totalLps, 0);
        const promedioPrecio =
          totalQQ > 0
            ? detalles.reduce((sum, d) => sum + d.precioQQ * d.cantidadQQ, 0) /
              totalQQ
            : 0;

        return {
          contratoID: contrato.contratoID,
          cantidadContrato: Number(contrato.contratoCantidadQQ),
          fecha: contrato.contratoFecha,
          descripcion: contrato.contratoDescripcion,
          producto: contrato.producto,
          totalQQ,
          totalLps,
          promedioPrecio,
          detalles,
        };
      });

    /** -------- DEPÓSITOS -------- */
    const depositos = await prisma.deposito.findMany({
      where: {
        clienteID: Number(clienteID),
        depositoFecha: { gte: startDate, lte: endDate },
        depositoMovimiento: "Deposito",
      },
      select: {
        depositoID: true,
        depositoFecha: true,
        depositoCantidadQQ: true,
        depositoDescripcion: true,
        producto: { select: { productName: true } },
        detalleliqdeposito: {
          where: {
            movimiento: "Entrada", // ignora 'Anulado'
          },
          select: { id: true, cantidadQQ: true, precio: true },
        },
      },
    });
    const detallesDepositos = depositos.map((d) => {
      const liquidaciones = (d.detalleliqdeposito || []).map((l) => ({
        detalleID: l.id,
        fecha: l.fecha,
        cantidadQQ: Number(l.cantidadQQ) || 0,
        precioQQ: Number(l.precio) || 0,
        totalLps: (Number(l.cantidadQQ) || 0) * (Number(l.precio) || 0),
      }));

      const totalQQLiquidado = liquidaciones.reduce(
        (sum, l) => sum + l.cantidadQQ,
        0
      );
      const totalLpsLiquidado = liquidaciones.reduce(
        (sum, l) => sum + l.totalLps,
        0
      );
      const promedioPrecio =
        totalQQLiquidado > 0
          ? liquidaciones.reduce(
              (sum, l) => sum + l.precioQQ * l.cantidadQQ,
              0
            ) / totalQQLiquidado
          : 0;

      return {
        depositoID: d.depositoID,
        producto: d.producto?.productName || "-",
        fecha: d.depositoFecha,
        cantidadQQ: Number(d.depositoCantidadQQ) || 0,
        totalQQLiquidado,
        totalLpsLiquidado,
        promedioPrecio,
        liqDeposito: liquidaciones,
      };
    });

    // Totales de depósitos
    const totalQQDeposito = detallesDepositos.reduce(
      (sum, d) => sum + d.cantidadQQ,
      0
    );
    const totalRetencion = detallesDepositos.reduce(
      (sum, d) => sum + d.retencion,
      0
    );
    const totalUsado = detallesDepositos.reduce(
      (sum, d) => sum + d.cantidadUsada,
      0
    );
    const totalDisponible = detallesDepositos.reduce(
      (sum, d) => sum + d.cantidadDisponible,
      0
    );

    /** -------- PRÉSTAMOS -------- */
    const prestamos = await prisma.prestamos.findMany({
      where: {
        clienteId: Number(clienteID),
        estado: {
          not: "ANULADO", // excluir préstamos borrados
        },
        monto: {
          gt: 0, // solo préstamos con monto mayor a 0
        },
      },
      include: {
        movimientos_prestamo: {
          where: {
            tipo_movimiento: {
              not: "ANULADO", // excluir movimientos anulados
            },
          },
        },
      },
      orderBy: { fecha: "asc" },
    });

    const detallesPrestamos = prestamos.map((p) => {
      const movimientos = (p.movimientos_prestamo || []).map((m) => ({
        movimientoId: m.MovimientoId,
        fecha: m.fecha,
        tipo: m.tipo_movimiento,
        monto: Number(m.monto) || 0,
        interes: Number(m.interes) || 0,
        dias: m.dias || 0,
        descripcion: m.descripcion || "-",
      }));

      const totalPrestamo = Number(p.monto) || 0;
      const totalMovimientos = movimientos.reduce((sum, m) => sum + m.monto, 0);

      return {
        prestamoId: p.prestamoId,
        fecha: p.fecha,
        monto: totalPrestamo,
        tasaInteres: Number(p.tasa_interes) || 0,
        tipo: p.tipo || "-",
        estado: p.estado || "-",
        observacion: p.observacion || "-",
        movimientos,
        totalMovimientos,
      };
    });

    /** -------- ANTICIPOS -------- */
    const anticipos = await prisma.anticipo.findMany({
      where: {
        clienteId: Number(clienteID),
        estado: { not: "ANULADO" },
        monto: { gt: 0 },
      },
      include: {
        movimientos_anticipos: {
          where: { tipo_movimiento: { not: "ANULADO" } },
        },
      },
      orderBy: { fecha: "asc" },
    });

    const detallesAnticipos = anticipos.map((a) => {
      const movimientos = (a.movimientos_anticipos || []).map((m) => ({
        movimientoId: m.MovimientoId,
        fecha: m.fecha,
        tipo: m.tipo_movimiento,
        monto: Number(m.monto) || 0,
        interes: Number(m.interes) || 0,
        dias: m.dias || 0,
        descripcion: m.descripcion || "-",
      }));

      const totalAnticipo = Number(a.monto) || 0;
      const totalMovimientos = movimientos.reduce((sum, m) => sum + m.monto, 0);

      return {
        anticipoId: a.anticipoId,
        fecha: a.fecha,
        monto: totalAnticipo,
        tasaInteres: Number(a.tasa_interes) || 0,
        tipo: a.tipo || "-",
        estado: a.estado || "-",
        observacion: a.observacion || "-",
        movimientos,
        totalMovimientos,
      };
    });

    /** -------- TOTALES GENERALES -------- */
    const totales = {
      Compras: {
        totalQQ: totalQQCompras,
        totalLps: totalLpsCompras,
        promedioPrecio: promedioPrecioCompras,
      },
      Contratos: {
        totalQQ: detallesContratos.reduce((sum, c) => sum + c.totalQQ, 0),
        totalLps: detallesContratos.reduce((sum, c) => sum + c.totalLps, 0),
        promedioPrecio: (() => {
          const totalQQ = detallesContratos.reduce(
            (sum, c) => sum + c.totalQQ,
            0
          );
          return totalQQ > 0
            ? detallesContratos.reduce(
                (sum, c) => sum + c.promedioPrecio * c.totalQQ,
                0
              ) / totalQQ
            : 0;
        })(),
      },
      Depositos: {
        totalQQ: totalQQDeposito,
        totalRetencion,
        totalUsado,
        totalDisponible,
      },
    };

    /** -------- RESPUESTA FINAL -------- */
    return new Response(
      JSON.stringify({
        movimientos: {
          Compras: detallesCompras,
          Contratos: detallesContratos,
          Depositos: detallesDepositos,
          Prestamos: detallesPrestamos,
          Anticipos: detallesAnticipos,
        },
        totales,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Error al obtener movimientos" }),
      { status: 500 }
    );
  }
}
