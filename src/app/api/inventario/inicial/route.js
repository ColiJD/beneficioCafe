import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { moverInventario, redondear, respuestaError, TX_ESPERA } from "@/lib/inventarioMov";

// Inventario inicial: suma existencia a un producto sin crear una compra,
// así no se alteran los reportes de compras, pagos ni anticipos.
// Permiso: módulo "inventario-inicial" (acción crear), deducido de la URL en checkRole.
export async function POST(req) {
  const sessionOrResponse = await checkRole(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const { productoID, cantidadQQ, nota } = await req.json();

    const idProducto = Number(productoID);
    const cantidad = redondear(cantidadQQ);
    if (!Number.isInteger(idProducto) || idProducto <= 0) {
      return Response.json({ error: "Producto inválido" }, { status: 400 });
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return Response.json({ error: "Cantidad inválida. Debe ser mayor a 0" }, { status: 400 });
    }

    const producto = await prisma.producto.findUnique({
      where: { productID: idProducto },
      select: { productName: true },
    });
    if (!producto) {
      return Response.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const inventario = await moverInventario(tx, idProducto, cantidad);
      await tx.movimientoinventario.create({
        data: {
          inventarioClienteID: inventario.inventarioClienteID,
          tipoMovimiento: "Entrada",
          referenciaTipo: "Inventario inicial",
          cantidadQQ: cantidad,
          cantidadSacos: 0,
          nota: (nota?.trim() || `Inventario inicial de ${producto.productName}`).slice(0, 200),
        },
      });
    }, TX_ESPERA);

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return respuestaError(error, "No se pudo registrar el inventario inicial");
  }
}

// Lista de cargas iniciales vigentes (las anuladas cambian de tipo y no salen).
export async function GET(req) {
  const sessionOrResponse = await checkRole(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const filas = await prisma.movimientoinventario.findMany({
      where: { tipoMovimiento: "Entrada", referenciaTipo: "Inventario inicial" },
      include: { inventariocliente: { include: { producto: { select: { productName: true } } } } },
      orderBy: { movimientoID: "desc" },
    });
    return Response.json(
      filas.map((m) => ({
        movimientoID: m.movimientoID,
        fecha: m.fecha,
        productoID: m.inventariocliente.productoID,
        productName: m.inventariocliente.producto?.productName ?? "Desconocido",
        cantidadQQ: Number(m.cantidadQQ),
        nota: m.nota,
      })),
    );
  } catch (error) {
    return respuestaError(error, "No se pudo cargar el inventario inicial");
  }
}
