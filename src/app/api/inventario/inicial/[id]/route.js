import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { ErrorNegocio, moverInventario, redondear, respuestaError, TX_ESPERA } from "@/lib/inventarioMov";

// Carga inicial vigente (no anulada), con su producto.
async function cargaInicial(tx, id) {
  const m = await tx.movimientoinventario.findFirst({
    where: { movimientoID: id, tipoMovimiento: "Entrada", referenciaTipo: "Inventario inicial" },
    include: { inventariocliente: true },
  });
  if (!m) throw new ErrorNegocio("Carga inicial no encontrada o ya anulada", 404);
  return m;
}

// Editar la cantidad o la nota (permiso "editar"). El producto no se cambia: se anula y se carga de nuevo.
// Si baja la cantidad y ese café ya se usó, moverInventario rechaza porque no alcanzaría el saldo.
export async function PUT(req, { params }) {
  const sessionOrResponse = await checkRole(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const id = Number((await params).id);
    const { cantidadQQ, nota } = await req.json();
    const cantidad = redondear(cantidadQQ);
    if (!Number.isInteger(id) || !Number.isFinite(cantidad) || cantidad <= 0) {
      return Response.json({ error: "Cantidad inválida. Debe ser mayor a 0" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const m = await cargaInicial(tx, id);
      const delta = redondear(cantidad - Number(m.cantidadQQ));
      if (delta !== 0) await moverInventario(tx, m.inventariocliente.productoID, delta);
      await tx.movimientoinventario.update({
        where: { movimientoID: id },
        data: { cantidadQQ: cantidad, ...(nota?.trim() ? { nota: nota.trim().slice(0, 200) } : {}) },
      });
    }, TX_ESPERA);

    return Response.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "No se pudo editar el inventario inicial");
  }
}

// Anular la carga (permiso "eliminar"): resta lo cargado y deja el movimiento como "Anulado".
// Si ese café ya se secó o se vendió, no alcanza el saldo y se rechaza.
export async function DELETE(req, { params }) {
  const sessionOrResponse = await checkRole(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return Response.json({ error: "Carga inválida" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const m = await cargaInicial(tx, id);
      await moverInventario(tx, m.inventariocliente.productoID, -Number(m.cantidadQQ));
      await tx.movimientoinventario.update({
        where: { movimientoID: id },
        data: { tipoMovimiento: "Anulado", nota: `Inventario inicial anulado #${id}` },
      });
    }, TX_ESPERA);

    return Response.json({ ok: true });
  } catch (error) {
    return respuestaError(error, "No se pudo anular el inventario inicial");
  }
}
