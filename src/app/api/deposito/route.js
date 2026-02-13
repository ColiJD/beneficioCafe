import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { NextResponse } from "next/server";

export async function POST(request) {
  const sessionOrResponse = await checkRole(request, [
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
      return NextResponse.json(
        { error: "Faltan datos obligatorios" },
        { status: 400 },
      );
    }

    // 🔹 Convertir y validar números
    const cantidadQQ = parseFloat(depositoCantidadQQ);
    const cantidadSacos = depositoTotalSacos
      ? parseFloat(depositoTotalSacos)
      : 0;

    if (isNaN(cantidadQQ) || cantidadQQ <= 0) {
      return NextResponse.json(
        {
          error: "La cantidad en QQ debe ser un número mayor que cero",
        },
        { status: 400 },
      );
    }

    if (cantidadSacos < 0 || isNaN(cantidadSacos)) {
      return NextResponse.json(
        { error: "La cantidad de sacos no puede ser negativa" },
        { status: 400 },
      );
    }

    // 🔹 Validar strings
    if (typeof depositoEn !== "string" || depositoEn.trim() === "") {
      return NextResponse.json(
        { error: "El campo 'depositoEn' es obligatorio" },
        { status: 400 },
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

    // 🔹 Actualizar inventario global por producto
    const inventarioGlobal = await prisma.inventariocliente.upsert({
      where: {
        productoID: Number(depositoTipoCafe),
      },
      update: {
        cantidadQQ: { increment: cantidadQQ },
        cantidadSacos: { increment: cantidadSacos },
      },
      create: {
        productoID: Number(depositoTipoCafe),
        cantidadQQ: cantidadQQ,
        cantidadSacos: cantidadSacos,
      },
    });

    // ✅ Registrar movimiento usando inventarioClienteID
    await prisma.movimientoinventario.create({
      data: {
        inventarioClienteID: inventarioGlobal.inventarioClienteID,
        tipoMovimiento: "Entrada",
        referenciaTipo: `Deposito #${nuevoDeposito.depositoID}`,
        referenciaID: nuevoDeposito.depositoID,
        cantidadQQ,
        cantidadSacos,
        nota: "Entrada de café por depósito",
      },
    });

    return NextResponse.json(nuevoDeposito, { status: 201 });
  } catch (error) {
    console.error("Error al registrar depósito:", error);
    return NextResponse.json(
      { error: "Error al registrar depósito" },
      {
        status: 500,
      },
    );
  }
}

export async function GET(request) {
  const sessionOrResponse = await checkRole(request, [
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

    return NextResponse.json(depositos, { status: 200 });
  } catch (error) {
    console.error("Error al obtener vista vw_SaldoDepositos:", error);
    return NextResponse.json(
      { error: "Error interno" },
      {
        status: 500,
      },
    );
  }
}
