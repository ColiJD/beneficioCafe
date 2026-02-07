import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
export async function POST(request,req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const body = await request.json();
    const {
      clienteID,
      depositoTipoCafe,
      depositoCantidadQQ,
      depositoTotalSacos,
      depositoEn,
      depositoDescripcion,
      depositoRetencion,
    } = body;

    // 🔹 Validaciones básicas
    if (
      !clienteID ||
      !depositoTipoCafe ||
      !depositoCantidadQQ ||
      !depositoTotalSacos
    ) {
      return new Response(
        JSON.stringify({ error: "Faltan datos obligatorios" }),
        { status: 400 }
      );
    }

    // 🔹 Convertir y validar números
    const cantidadQQ = parseFloat(depositoCantidadQQ);
    const cantidadSacos = depositoTotalSacos
      ? parseFloat(depositoTotalSacos)
      : 0;

    if (isNaN(cantidadQQ) || cantidadQQ <= 0) {
      return new Response(
        JSON.stringify({
          error: "La cantidad en QQ debe ser un número mayor que cero",
        }),
        { status: 400 }
      );
    }

    if (cantidadSacos < 0 || isNaN(cantidadSacos)) {
      return new Response(
        JSON.stringify({ error: "La cantidad de sacos no puede ser negativa" }),
        { status: 400 }
      );
    }

    // 🔹 Validar strings
    if (typeof depositoEn !== "string" || depositoEn.trim() === "") {
      return new Response(
        JSON.stringify({ error: "El campo 'depositoEn' es obligatorio" }),
        { status: 400 }
      );
    }

    // 🔹 Crear depósito
    const nuevoDeposito = await prisma.deposito.create({
      data: {
        clienteID: Number(clienteID),
        depositoFecha: new Date(),
        depositoTipoCafe: Number(depositoTipoCafe),
        depositoMovimiento: "Deposito",
        depositoCantidadQQ: cantidadQQ,
        depositoTotalSacos: cantidadSacos,
        depositoEn,
        depositoDescripcion: depositoDescripcion || "",
        estado: "Pendiente",
        depositoRetencionQQ: depositoRetencion
          ? parseFloat(depositoRetencion)
          : 0,
      },
    });

    // 🔹 Actualizar inventario del cliente
    const inventarioCliente = await prisma.inventariocliente.upsert({
      where: {
        clienteID_productoID: {
          clienteID: Number(clienteID),
          productoID: Number(depositoTipoCafe),
        },
      },
      update: {
        cantidadQQ: { increment: cantidadQQ },
        cantidadSacos: { increment: cantidadSacos },
      },
      create: {
        clienteID: Number(clienteID),
        productoID: Number(depositoTipoCafe),
        cantidadQQ: cantidadQQ,
        cantidadSacos: cantidadSacos,
      },
    });

    // ✅ Registrar movimiento usando inventarioClienteID
    await prisma.movimientoinventario.create({
      data: {
        inventarioClienteID: inventarioCliente.inventarioClienteID,
        tipoMovimiento: "Entrada",
        referenciaTipo: `Deposito #${nuevoDeposito.depositoID}`,
        referenciaID: nuevoDeposito.depositoID,
        cantidadQQ,
        cantidadSacos,
        nota: "Entrada de café por depósito",
      },
    });

    return new Response(JSON.stringify(nuevoDeposito), { status: 201 });
  } catch (error) {
    console.error("Error al registrar depósito:", error);
    return new Response(
      JSON.stringify({ error: "Error al registrar depósito" }),
      { status: 500 }
    );
  }
}

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    // Usamos query raw para traer todo de la vista
    const depositos = await prisma.$queryRawUnsafe(`
      SELECT * FROM vw_SaldoDepositos
    `);

    return new Response(JSON.stringify(depositos), { status: 200 });
  } catch (error) {
    console.error("Error al obtener vista vw_SaldoDepositos:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
    });
  }
}
