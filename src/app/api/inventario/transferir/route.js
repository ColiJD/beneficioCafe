import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function POST(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const body = await req.json();
    const { cantidadQQ, nota } = body;
    const fromProductID = Number(body.fromProductID);
    const toProductID = Number(body.toProductID);

    // 🔹 1️⃣ Validación de campos obligatorios
    if (!fromProductID || !toProductID || !cantidadQQ) {
      return new Response(JSON.stringify({ error: "Datos incompletos" }), {
        status: 400,
      });
    }

    // 🔹 2️⃣ Evitar transferencia al mismo tipo de café
    if (fromProductID === toProductID) {
      return new Response(
        JSON.stringify({
          error: "No se puede transferir al mismo tipo de café",
        }),
        { status: 400 },
      );
    }

    // 🔹 3️⃣ Validar que la cantidad sea un número positivo
    const cantidad = parseFloat(cantidadQQ);
    if (isNaN(cantidad) || cantidad <= 0) {
      return new Response(
        JSON.stringify({ error: "Cantidad inválida. Debe ser mayor a 0" }),
        { status: 400 },
      );
    }

    // 🔹 4️⃣ Transacción para mover inventario de manera atómica
    const result = await prisma.$transaction(async (tx) => {
      // 🔹 4a️⃣ Buscar inventario origen
      const inventarioOrigen = await tx.inventariocliente.findUnique({
        where: { productoID: fromProductID },
      });

      // 🔹 4b️⃣ Validar que hay suficiente inventario
      if (!inventarioOrigen || Number(inventarioOrigen.cantidadQQ) < cantidad) {
        return {
          ok: false,
          error: "No hay suficiente inventario para transferir",
        };
      }

      // 🔹 4c️⃣ Procesar la transferencia
      // Reducir inventario origen (condicionado al saldo por si cambió en paralelo)
      const bajado = await tx.inventariocliente.updateMany({
        where: { productoID: fromProductID, cantidadQQ: { gte: cantidad } },
        data: { cantidadQQ: { decrement: cantidad } },
      });
      if (bajado.count === 0) {
        return { ok: false, error: "No hay suficiente inventario para transferir" };
      }

      // Actualizar inventario destino
      const inventarioDestino = await tx.inventariocliente.upsert({
        where: { productoID: toProductID },
        update: { cantidadQQ: { increment: cantidad } },
        create: {
          productoID: toProductID,
          cantidadQQ: cantidad,
          cantidadSacos: 0,
        },
      });

      // 🔹 Registrar movimiento de salida
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: inventarioOrigen.inventarioClienteID,
          tipoMovimiento: "Salida", // tipo que reconocen las sumas del inventario
          referenciaTipo: `Transferencia de producto ${fromProductID} ➜ ${toProductID}`,
          referenciaID: toProductID,
          cantidadQQ: cantidad,
          cantidadSacos: 0,
          nota:
            nota ||
            `Transferencia de ${cantidad} QQ desde producto #${fromProductID} hacia producto #${toProductID}`,
        },
      });

      // 🔹 Registrar movimiento de entrada (opcional, pero ayuda a rastrear en el destino)
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: inventarioDestino.inventarioClienteID,
          tipoMovimiento: "Entrada",
          referenciaTipo: `Transferencia desde ${fromProductID}`,
          referenciaID: fromProductID,
          cantidadQQ: cantidad,
          cantidadSacos: 0,
          nota: `Entrada por transferencia desde producto #${fromProductID}`,
        },
      });

      return { ok: true };
    });

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
    });
  } catch (err) {
    console.error("❌ Error en transferencia FIFO:", err);

    // 🔹 6️⃣ Captura de error inesperado
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    // 🔹 Movimiento de origen de cada transferencia (incluye los antiguos tipo "Transferencia")
    const movimientos = await prisma.movimientoinventario.findMany({
      where: {
        OR: [
          { tipoMovimiento: "Transferencia" },
          { referenciaTipo: { startsWith: "Transferencia de producto" } },
        ],
      },
      orderBy: { fecha: "desc" }, // los más recientes primero
    });

    return new Response(JSON.stringify(movimientos), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Error obteniendo movimientos:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
