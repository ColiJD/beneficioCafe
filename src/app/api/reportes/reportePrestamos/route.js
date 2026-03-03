import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
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

    // 4️⃣ Compradores
    const compradores = await prisma.compradores.findMany({
      select: { compradorId: true, compradorNombre: true },
      orderBy: { compradorNombre: "asc" },
    });

    // 5️⃣ Préstamos de Compradores
    const prestamosCompradores = await prisma.prestamos_compradores.findMany({
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

    // 6️⃣ Anticipos de Compradores
    const anticiposCompradores = await prisma.anticipo_compradores.findMany({
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

    // 7️⃣ Procesar datos en memoria
    const finalMap = new Map();

    // Inicializar mapa de clientes
    clientes.forEach((c) => {
      finalMap.set(`cliente-${c.clienteID}`, {
        id: c.clienteID,
        tipo: "CLIENTE",
        nombre: `${c.clienteNombre || ""} ${c.clienteApellido || ""}`.trim(),
        activoPrestamo: 0,
        abonoPrestamo: 0,
        saldoPrestamo: 0,
        activoAnticipo: 0,
        abonoAnticipo: 0,
        saldoAnticipo: 0,
      });
    });

    // Inicializar mapa de compradores
    compradores.forEach((c) => {
      finalMap.set(`comprador-${c.compradorId}`, {
        id: c.compradorId,
        tipo: "COMPRADOR",
        nombre: c.compradorNombre,
        activoPrestamo: 0,
        abonoPrestamo: 0,
        saldoPrestamo: 0,
        activoAnticipo: 0,
        abonoAnticipo: 0,
        saldoAnticipo: 0,
      });
    });

    const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    // --- Procesar Préstamos Clientes ---
    prestamos.forEach((p) => {
      if (!p.clienteId || !finalMap.has(`cliente-${p.clienteId}`)) return;
      const data = finalMap.get(`cliente-${p.clienteId}`);
      const capital = Number(p.monto || 0);
      const totalCargoInt = p.movimientos_prestamo
        .filter((m) =>
          ["Int-Cargo", "CARGO_INTERES"].includes(m.tipo_movimiento),
        )
        .reduce((sum, m) => sum + Number(m.monto || 0), 0);
      const totalAbonos = p.movimientos_prestamo
        .filter((m) => ["ABONO", "PAGO_INTERES"].includes(m.tipo_movimiento))
        .reduce((sum, m) => sum + Number(m.monto || 0), 0);
      data.activoPrestamo += roundToTwo(capital + totalCargoInt);
      data.abonoPrestamo += roundToTwo(totalAbonos);
    });

    // --- Procesar Anticipos Clientes ---
    anticipos.forEach((a) => {
      if (!a.clienteId || !finalMap.has(`cliente-${a.clienteId}`)) return;
      const data = finalMap.get(`cliente-${a.clienteId}`);
      const capital = Number(a.monto || 0);
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

    // --- Procesar Préstamos Compradores ---
    prestamosCompradores.forEach((p) => {
      if (!p.compradorId || !finalMap.has(`comprador-${p.compradorId}`)) return;
      const data = finalMap.get(`comprador-${p.compradorId}`);
      const capital = Number(p.monto || 0);
      const totalCargoInt = p.movimientos_prestamo
        .filter(
          (m) =>
            ["Int-Cargo", "CARGO_INTERES", "PRESTAMO"].includes(
              m.tipo_movimiento,
            ) && m.tipo_movimiento !== "PRESTAMO",
        )
        .reduce((sum, m) => sum + Number(m.monto || 0), 0);
      // Nota: En compradores, el movimiento "PRESTAMO" es el inicial o adicional?
      // En `cargarDatos` se vio que `PRESTAMO` es una deuda.

      const cargosAdicionales = p.movimientos_prestamo
        .filter((m) => ["PRESTAMO", "Int-Cargo"].includes(m.tipo_movimiento))
        .reduce((sum, m) => sum + Number(m.monto || 0), 0);

      const totalAbonos = p.movimientos_prestamo
        .filter((m) =>
          ["ABONO", "PAGO_INTERES", "ABONO_INTERES"].includes(
            m.tipo_movimiento,
          ),
        )
        .reduce((sum, m) => sum + Number(m.monto || 0), 0);

      data.activoPrestamo += roundToTwo(capital + cargosAdicionales);
      data.abonoPrestamo += roundToTwo(totalAbonos);
    });

    // --- Procesar Anticipos Compradores ---
    anticiposCompradores.forEach((a) => {
      if (!a.compradorId || !finalMap.has(`comprador-${a.compradorId}`)) return;
      const data = finalMap.get(`comprador-${a.compradorId}`);
      const capital = Number(a.monto || 0);
      const cargosReales = a.movimientos_anticipos
        .filter((m) =>
          ["ANTICIPO", "CARGO_ANTICIPO"].includes(m.tipo_movimiento),
        )
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
    const resultados = Array.from(finalMap.values())
      .map((item) => {
        item.saldoPrestamo = roundToTwo(
          item.activoPrestamo - item.abonoPrestamo,
        );
        item.saldoAnticipo = roundToTwo(
          item.activoAnticipo - item.abonoAnticipo,
        );
        return item;
      })
      .filter(
        (item) =>
          item.activoPrestamo > 0 ||
          item.abonoPrestamo > 0 ||
          item.saldoPrestamo !== 0 ||
          item.activoAnticipo > 0 ||
          item.abonoAnticipo > 0 ||
          item.saldoAnticipo !== 0,
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
