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
        { status: 400 }
      );
    }

    // 4️⃣ Obtener inventario total (solo cantidadQQ)
    const totalInventario = await prisma.inventariocliente.aggregate({
      where: { productoID: Number(compraTipoCafe) },
      _sum: { cantidadQQ: true },
    });

    const totalQQ = totalInventario._sum?.cantidadQQ || 0;

    if (totalQQ < cantidadQQ) {
      return new Response(
        JSON.stringify({ error: "Inventario total insuficiente" }),
        { status: 400 }
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
          compraTotalSacos: new Prisma.Decimal(totalSacos), // Solo para guardar
          compraPrecioQQ: new Prisma.Decimal(precioQQ),
          compraTotal: new Prisma.Decimal(totalCompra),
          compraDescripcion: compraDescripcion || "",
          compraEn: "Venta Directa",
          compraMovimiento: compraMovimiento || "",
        },
      });

      // 5b️⃣ Distribuir la venta entre inventarios (solo cantidadQQ)
      const inventarios = await tx.inventariocliente.findMany({
        where: { productoID: Number(compraTipoCafe) },
        orderBy: { inventarioClienteID: "asc" },
      });

      let restanteQQ = cantidadQQ;

      for (const inv of inventarios) {
        if (restanteQQ <= 0) break;

        const descontarQQ = Math.min(
          restanteQQ,
          parseFloat(inv.cantidadQQ.toString())
        );

        await tx.inventariocliente.update({
          where: { inventarioClienteID: inv.inventarioClienteID },
          data: {
            cantidadQQ: { decrement: new Prisma.Decimal(descontarQQ) },
          },
        });

        await tx.movimientoinventario.create({
          data: {
            inventarioClienteID: inv.inventarioClienteID,
            tipoMovimiento: "Salida",
            referenciaTipo: `Venta directa #${registro.compraId}`,
            referenciaID: registro.compraId,
            cantidadQQ: new Prisma.Decimal(descontarQQ),
            nota: `Salida de café por venta a comprador ${compradorID}`,
          },
        });

        restanteQQ -= descontarQQ;
      }

      return registro;
    });

    return new Response(JSON.stringify(resultado), { status: 201 });
  } catch (error) {
    console.error("🔥 Error al registrar la venta:", error);
    return new Response(
      JSON.stringify({ error: "Error al registrar la venta" }),
      { status: 500 }
    );
  }
}
