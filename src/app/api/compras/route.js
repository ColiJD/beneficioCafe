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
      compraTipoDocumento,
      compraTipoCafe,
      compraPrecioQQ,
      compraCantidadQQ,
      compraTotal,
      compraTotalSacos,
      compraRetencio,
      compraDescripcion,
      compraEn,
    } = body;

    // ✅ Validaciones
    if (
      !clienteID ||
      !compraTipoCafe ||
      !compraPrecioQQ ||
      !compraCantidadQQ ||
      !compraTotalSacos
    ) {
      return new Response(
        JSON.stringify({ error: "Faltan datos obligatorios" }),
        { status: 400 }
      );
    }
    const hoy = new Date();
    const fechaSolo = new Date(
      Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
    );

    // ✅ Crear la compra
    const nuevaCompra = await prisma.compra.create({
      data: {
        clienteID: Number(clienteID),
        compraFecha: fechaSolo, // Fecha automática
        compraTipoDocumento,
        compraMovimiento: "Entrada",
        compraTipoCafe: Number(compraTipoCafe),
        compraPrecioQQ: parseFloat(compraPrecioQQ),
        compraCantidadQQ: parseFloat(compraCantidadQQ),
        compraTotal: parseFloat(compraTotal),
        compraTotalSacos: compraTotalSacos ? parseFloat(compraTotalSacos) : 0,
        compraRetencio: compraRetencio ? parseFloat(compraRetencio) : 0,
        compraEn,
        compraDescripcion: compraDescripcion || "",
      },
    });

    // ✅ 2️⃣ Actualizar o crear inventario del cliente
    const productoID = Number(compraTipoCafe);
    const cantidadQQ = parseFloat(compraCantidadQQ);
    const cantidadSacos = compraTotalSacos ? parseFloat(compraTotalSacos) : 0;
    const clienteIDNum = Number(clienteID);

    const inventarioCliente = await prisma.inventariocliente.upsert({
      where: {
        clienteID_productoID: {
          clienteID: clienteIDNum,
          productoID,
        },
      },
      update: {
        cantidadQQ: { increment: cantidadQQ },
        cantidadSacos: { increment: cantidadSacos },
      },
      create: {
        clienteID: clienteIDNum,
        productoID,
        cantidadQQ,
        cantidadSacos,
      },
    });

    // ✅ Registrar movimiento usando inventarioClienteID
    await prisma.movimientoinventario.create({
      data: {
        inventarioClienteID: inventarioCliente.inventarioClienteID,
        tipoMovimiento: "Entrada",
        referenciaTipo: `Compra directa #${nuevaCompra.compraId}`,
        referenciaID: nuevaCompra.compraId,
        cantidadQQ,
        cantidadSacos,
        nota: "Entrada de café por compra directa",
      },
    });

    return new Response(JSON.stringify(nuevaCompra), { status: 201 });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: "Error al registrar compra" }),
      {
        status: 500,
      }
    );
  }
}

/**
 * Handles GET requests to fetch all compras from the database
 * @returns {Response} - A Response object containing either the list of compras or an error message
 */
// app/api/compras/route.js

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const url = new URL(req.url);
    const clienteID = url.searchParams.get("clienteID");

    let compras;

    if (clienteID) {
      // 🔹 Consulta segura con parámetro
      compras = await prisma.$queryRaw`
        SELECT * 
        FROM vw_comprascondetalle
        WHERE clienteID = ${Number(clienteID)}
      `;
    } else {
      // 🔹 Si no mandan clienteID, trae todo
      compras = await prisma.$queryRaw`
        SELECT * 
        FROM vw_comprascondetalle
      `;
    }

    return new Response(JSON.stringify(compras), { status: 200 });
  } catch (error) {
    console.error("❌ Error al obtener vista vw_comprascondetalle:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
    });
  }
}
