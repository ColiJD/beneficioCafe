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
    const desde = searchParams.get("desde")
      ? new Date(searchParams.get("desde"))
      : new Date("2000-01-01");

    const hasta = searchParams.get("hasta")
      ? new Date(searchParams.get("hasta"))
      : new Date();

    // 1️⃣ Clientes
    const clientes = await prisma.cliente.findMany({
      select: { clienteID: true, clienteNombre: true, clienteApellido: true },
      orderBy: { clienteNombre: "asc" },
    });

    // 2️⃣ Obtener datos de Préstamos
    const prestamos = await prisma.prestamos.findMany({
      where: {
        OR: [
          { estado: "ACTIVO" },
          {
            movimientos_prestamo: {
              some: { fecha: { gte: desde, lte: hasta } },
            },
          },
        ],
      },
      include: {
        movimientos_prestamo: true,
      },
    });

    // 3️⃣ Obtener datos de Anticipos
    const anticipos = await prisma.anticipo.findMany({
      where: {
        OR: [
          { estado: "ACTIVO" },
          {
            movimientos_anticipos: {
              some: { fecha: { gte: desde, lte: hasta } },
            },
          },
        ],
      },
      include: {
        movimientos_anticipos: true,
      },
    });

    // 4️⃣ Procesar datos en memoria
    const clientesMap = new Map();

    // Inicializar mapa de clientes
    clientes.forEach((c) => {
      clientesMap.set(c.clienteID, {
        clienteID: c.clienteID,
        nombre: `${c.clienteNombre || ""} ${c.clienteApellido || ""}`.trim(),
        activoPrestamo: 0,
        abonoPrestamo: 0,
        saldoPrestamo: 0,
        activoAnticipo: 0,
        abonoAnticipo: 0,
        saldoAnticipo: 0,
      });
    });

    const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    // --- Procesar Préstamos ---
    prestamos.forEach((p) => {
      if (!p.clienteId || !clientesMap.has(p.clienteId)) return;
      const data = clientesMap.get(p.clienteId);

      const capital = Number(p.monto || 0);

      // Filtrar movimientos DENTRO del rango para el reporte de "Abonos del periodo"
      // PERO para el "Saldo", necesitamos el historial completo.
      // El reporte parece mostrar columnas: "Activo" (Monto + Interes), "Abono", "Saldo".
      // "Activo" suele ser la deuda total generada.
      // "Abono" lo pagado.
      // "Saldo" lo pendiente real.

      // Calcular totales históricos para el saldo real
      const totalCargoInt = p.movimientos_prestamo
        .filter((m) =>
          ["Int-Cargo", "CARGO_INTERES"].includes(m.tipo_movimiento),
        )
        .reduce((sum, m) => sum + Number(m.monto || 0), 0);

      const totalAbonos = p.movimientos_prestamo
        .filter((m) => ["ABONO", "PAGO_INTERES"].includes(m.tipo_movimiento))
        .reduce((sum, m) => sum + Number(m.monto || 0), 0);

      // Calcular montos específicos del periodo para mostrar en columnas de actividad (si se requiere)
      // O si el reporte es un "Estado de Cuenta Actual", mostrar acumulados.
      // Asumiremos Estado de Cuenta Actual (Saldos Reales).

      data.activoPrestamo += roundToTwo(capital + totalCargoInt);
      data.abonoPrestamo += roundToTwo(totalAbonos);
      // Saldo se calcula al final o incrementalmente
    });

    // --- Procesar Anticipos ---
    anticipos.forEach((a) => {
      if (!a.clienteId || !clientesMap.has(a.clienteId)) return;
      const data = clientesMap.get(a.clienteId);

      const capital = Number(a.monto || 0);

      const totalCargoInt = a.movimientos_anticipos.filter(
        (m) =>
          ["CARGO_ANTICIPO", "INTERES_ANTICIPO"].includes(m.tipo_movimiento) &&
          m.tipo_movimiento !== "INTERES_ANTICIPO",
      ); // Ojo: INTERES_ANTICIPO es un PAGO en la lógica de anticipos?
      // Revisando `anticipos/movimiento/route.js`:
      // CARGO_ANTICIPO -> Suma a la deuda (Interes Pendiente)
      // INTERES_ANTICIPO -> PAGO de intereses (Resta a Interes Pendiente)
      // ABONO_ANTICIPO -> PAGO de capital
      // ENTONCES: "Activo" debe sumar Capital + CARGOS. "Abono" debe sumar ABONOS + PAGOS DE INTERES.

      const cargosReales = a.movimientos_anticipos
        .filter((m) => m.tipo_movimiento === "CARGO_ANTICIPO")
        .reduce((sum, m) => sum + Number(m.monto || 0), 0);

      const pagosReales = a.movimientos_anticipos
        .filter((m) =>
          ["ABONO_ANTICIPO", "INTERES_ANTICIPO"].includes(m.tipo_movimiento),
        )
        .reduce((sum, m) => sum + Number(m.monto || 0), 0);

      data.activoAnticipo += roundToTwo(capital + cargosReales);
      data.abonoAnticipo += roundToTwo(pagosReales);
    });

    // Calcular saldos finales y filtrar
    const resultados = Array.from(clientesMap.values())
      .map((c) => {
        c.saldoPrestamo = roundToTwo(c.activoPrestamo - c.abonoPrestamo);
        c.saldoAnticipo = roundToTwo(c.activoAnticipo - c.abonoAnticipo);
        return c;
      })
      .filter(
        (c) =>
          c.activoPrestamo > 0 ||
          c.abonoPrestamo > 0 ||
          c.saldoPrestamo !== 0 ||
          c.activoAnticipo > 0 ||
          c.abonoAnticipo > 0 ||
          c.saldoAnticipo !== 0,
      );

    return Response.json({ ok: true, clientes: resultados });
  } catch (error) {
    console.error("ERROR REPORTE: ", error);
    return Response.json(
      { ok: false, error: "Error al obtener el reporte" },
      { status: 500 },
    );
  }
}
