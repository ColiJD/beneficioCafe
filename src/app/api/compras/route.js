import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { ErrorNegocio, respuestaError, TX_ESPERA } from "@/lib/inventarioMov";
import { validarFlete } from "@/lib/flete";
import { aplicarAbono, bloquearDeudas, moduloDeDeuda, validarAbono } from "@/lib/abonoDeuda";
import { getPermisos } from "@/lib/permisos";
import { puedeEnModulo } from "@/lib/modulos";
import { Prisma } from "@prisma/client";

// Abono de cada compra: suma de los movimientos de préstamo/anticipo enlazados por compraId (los anulados no cuentan).
const ABONO_SQL = Prisma.sql`
  COALESCE((SELECT SUM(m.monto) FROM movimientos_prestamo m WHERE m.compraId = c.compraId AND m.tipo_movimiento = 'ABONO'), 0) +
  COALESCE((SELECT SUM(m.monto) FROM movimientos_anticipos m WHERE m.compraId = c.compraId AND m.tipo_movimiento = 'ABONO_ANTICIPO'), 0) AS compraAbono,
  CASE WHEN EXISTS (SELECT 1 FROM movimientos_prestamo m WHERE m.compraId = c.compraId AND m.tipo_movimiento = 'ABONO') THEN 'PRESTAMO'
       WHEN EXISTS (SELECT 1 FROM movimientos_anticipos m WHERE m.compraId = c.compraId AND m.tipo_movimiento = 'ABONO_ANTICIPO') THEN 'ANTICIPO'
  END AS compraAbonoTipo`;

export async function POST(request, req) {
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "COLABORADORES",
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
      compraFlete,
      compraAbono,
      compraAbonoTipo,
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
        { status: 400 },
      );
    }
    const flete = validarFlete(compraFlete, compraTotal);
    const { abono, tipo: tipoAbono } = validarAbono(compraAbono, compraAbonoTipo, compraTotal);
    if (abono > 0) {
      // el abono crea movimientos en préstamos/anticipos: exige también ese permiso
      const acc = await getPermisos(sessionOrResponse.user.id);
      if (!puedeEnModulo(acc, moduloDeDeuda(tipoAbono), "crear")) {
        throw new ErrorNegocio("No tiene permiso para abonar a esta deuda.", 403);
      }
    }
    const hoy = new Date();
    const fechaSolo = new Date(
      Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()),
    );

    // Compra, inventario y abono van juntos: si algo falla no se guarda nada.
    const nuevaCompra = await prisma.$transaction(async (tx) => {
    // con abono, lo primero es bloquear las deudas del cliente: dos abonos simultáneos no pueden pasarse del capital
    if (abono > 0) await bloquearDeudas(tx, [clienteID]);
    const nuevaCompra = await tx.compra.create({
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
        compraFlete: flete,
        compraEn,
        compraDescripcion: compraDescripcion || "",
      },
    });

    // ✅ 2️⃣ Actualizar o crear inventario global
    const productoID = Number(compraTipoCafe);
    const cantidadQQ = parseFloat(compraCantidadQQ);
    const cantidadSacos = compraTotalSacos ? parseFloat(compraTotalSacos) : 0;

    const inventarioGlobal = await tx.inventariocliente.upsert({
      where: {
        productoID,
      },
      update: {
        cantidadQQ: { increment: cantidadQQ },
        cantidadSacos: { increment: cantidadSacos },
      },
      create: {
        productoID,
        cantidadQQ,
        cantidadSacos,
      },
    });

    // ✅ Registrar movimiento usando inventarioClienteID
    await tx.movimientoinventario.create({
      data: {
        inventarioClienteID: inventarioGlobal.inventarioClienteID,
        tipoMovimiento: "Entrada",
        referenciaTipo: `Compra directa #${nuevaCompra.compraId}`,
        referenciaID: nuevaCompra.compraId,
        cantidadQQ,
        cantidadSacos,
        nota: "Entrada de café por compra directa",
      },
    });

    // el abono no se guarda en la compra ni se descuenta de compraTotal: vive en los movimientos de la deuda, enlazados por compraId
    if (abono > 0) await aplicarAbono(tx, tipoAbono, clienteID, abono, nuevaCompra.compraId);
    return { ...nuevaCompra, compraAbono: abono, compraAbonoTipo: tipoAbono };
    }, TX_ESPERA);

    return new Response(JSON.stringify(nuevaCompra), { status: 201 });
  } catch (error) {
    if (error instanceof ErrorNegocio) return respuestaError(error);
    console.error(error);
    return new Response(
      JSON.stringify({ error: "Error al registrar compra" }),
      {
        status: 500,
      },
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
    "COLABORADORES",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const url = new URL(req.url);
    const clienteID = url.searchParams.get("clienteID");

    let compras;

    if (clienteID) {
      // 🔹 Consulta segura con parámetro
      // flete y abono viven en la tabla compra (la vista no los trae)
      compras = await prisma.$queryRaw`
        SELECT v.*, c.compraFlete, ${ABONO_SQL}
        FROM vw_comprascondetalle v
        LEFT JOIN compra c ON c.compraId = v.compraId
        WHERE v.clienteID = ${Number(clienteID)}
      `;
    } else {
      // 🔹 Si no mandan clienteID, trae todo
      compras = await prisma.$queryRaw`
        SELECT v.*, c.compraFlete, ${ABONO_SQL}
        FROM vw_comprascondetalle v
        LEFT JOIN compra c ON c.compraId = v.compraId
      `;
    }

    return new Response(JSON.stringify(compras), { status: 200 });
  } catch (error) {
    if (error instanceof ErrorNegocio) return respuestaError(error);
    console.error("❌ Error al obtener vista vw_comprascondetalle:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
    });
  }
}
