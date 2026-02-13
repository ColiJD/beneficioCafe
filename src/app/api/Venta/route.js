import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { Prisma } from "@prisma/client";
export async function POST(request) {
  // 1️⃣ Verificar roles
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    // 2️⃣ Obtener datos del body
    const body = await request.json();
    const {
      compradorID,
      compraTipoCafe,
      compraCantidadQQ,
      compraTotalSacos,
      compraPrecioQQ,
      compraTotal,
      compraDescripcion,
      compraMovimiento,
    } = body;

    // 3️⃣ Validar campos obligatorios y convertir a números
    const cantidadQQ = parseFloat(compraCantidadQQ);
    const precioQQ = parseFloat(compraPrecioQQ);
    const totalCompra = compraTotal ? parseFloat(compraTotal) : 0;
    const totalSacos = compraTotalSacos ? parseFloat(compraTotalSacos) : 0; // Solo para guardar en compra

    if (
      !compradorID ||
      !compraTipoCafe ||
      Number.isNaN(cantidadQQ) ||
      Number.isNaN(precioQQ)
    ) {
      return new Response(
        JSON.stringify({ error: "Faltan datos obligatorios o son inválidos" }),
        { status: 400 },
      );
    }

    // 4️⃣ Obtener inventario global
    const inventario = await prisma.inventariocliente.findUnique({
      where: { productoID: Number(compraTipoCafe) },
    });

    const totalQQ = inventario
      ? parseFloat(inventario.cantidadQQ.toString())
      : 0;

    if (totalQQ < cantidadQQ) {
      return new Response(
        JSON.stringify({ error: "Inventario insuficiente" }),
        { status: 400 },
      );
    }

    // 5️⃣ Ejecutar todo dentro de una transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // 5a️⃣ Registrar la venta
      const registro = await tx.compra.create({
        data: {
          compradorID: Number(compradorID),
          compraFecha: new Date(),
          compraTipoCafe: Number(compraTipoCafe),
          compraCantidadQQ: new Prisma.Decimal(cantidadQQ),
          compraTotalSacos: new Prisma.Decimal(totalSacos),
          compraPrecioQQ: new Prisma.Decimal(precioQQ),
          compraTotal: new Prisma.Decimal(totalCompra),
          compraDescripcion: compraDescripcion || "",
          compraEn: "Venta Directa",
          compraMovimiento: compraMovimiento || "",
        },
      });

      // 5b️⃣ Actualizar inventario global
      await tx.inventariocliente.update({
        where: { productoID: Number(compraTipoCafe) },
        data: {
          cantidadQQ: { decrement: new Prisma.Decimal(cantidadQQ) },
        },
      });

      // 5c️⃣ Registrar movimiento de inventario
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: inventario.inventarioClienteID,
          tipoMovimiento: "Salida",
          referenciaTipo: `Venta directa #${registro.compraId}`,
          referenciaID: registro.compraId,
          cantidadQQ: new Prisma.Decimal(cantidadQQ),
          nota: `Salida de café por venta a comprador ${compradorID}`,
        },
      });

      return registro;
    });

    return new Response(JSON.stringify(resultado), { status: 201 });
  } catch (error) {
    console.error("🔥 Error al registrar la venta:", error);
    return new Response(
      JSON.stringify({ error: "Error al registrar la venta" }),
      { status: 500 },
    );
  }
}
