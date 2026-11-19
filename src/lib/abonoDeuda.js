import { Prisma } from "@prisma/client";
import { ErrorNegocio, redondear } from "@/lib/inventarioMov";

// Abono al capital de la deuda de un cliente (préstamos o anticipos) hecho desde una compra.
// Mismas reglas que /api/prestamos/movimiento y /api/anticipos/movimiento (abono FIFO al capital, estado COMPLETADO/ACTIVO).
const TIPOS = {
  PRESTAMO: { deuda: "prestamos", movs: "movimientos_prestamo", id: "prestamoId", fk: "prestamo_id", abono: "ABONO", cargo: "Int-Cargo", interes: "PAGO_INTERES" },
  ANTICIPO: { deuda: "anticipo", movs: "movimientos_anticipos", id: "anticipoId", fk: "anticipoId", abono: "ABONO_ANTICIPO", cargo: "CARGO_ANTICIPO", interes: "INTERES_ANTICIPO" },
};

// El vínculo es movimientos_*.compraId (con FK a compra); este texto solo es para que se lea en el historial de la deuda.
export const marcaAbono = (compraId) => `Abono por compra #${compraId}`;

const config = (tipo) => {
  const t = TIPOS[tipo];
  if (!t) throw new ErrorNegocio("Tipo de deuda no válido para el abono");
  return t;
};
const suma = (movs, tipo) => redondear(movs.filter((m) => m.tipo_movimiento === tipo).reduce((s, m) => s + Number(m.monto || 0), 0));

// Capital pendiente de cada deuda vigente del cliente, de la más antigua a la más nueva.
async function deudasConCapital(tx, tipo, clienteID) {
  const t = config(tipo);
  const filas = await tx[t.deuda].findMany({
    where: { clienteId: Number(clienteID), estado: { not: "ANULADO" } },
    include: { [t.movs]: true },
    orderBy: { fecha: "asc" },
  });
  return filas
    .map((d) => ({ d, capital: redondear(Number(d.monto || 0) - suma(d[t.movs], t.abono)) }))
    .filter((x) => x.capital > 0);
}

/** Módulo de permisos que corresponde a cada tipo de deuda. */
export const moduloDeDeuda = (tipo) => (tipo === "PRESTAMO" ? "prestamos" : "anticipos");

/**
 * Bloquea las deudas (préstamos y anticipos) de esos clientes hasta que termine la transacción, para que dos abonos
 * simultáneos a la misma deuda no se pasen del capital. Debe ser lo PRIMERO que hace la transacción: si ya hubo una
 * lectura normal, MySQL leería una foto anterior de los movimientos y no vería el abono que acaba de confirmarse el otro.
 * Siempre bloquea en el mismo orden (préstamos, anticipos; por ID) para evitar bloqueos cruzados.
 */
export async function bloquearDeudas(tx, clienteIDs) {
  const ids = [...new Set(clienteIDs.map(Number).filter(Boolean))].sort((a, b) => a - b);
  if (!ids.length) return;
  await tx.$queryRaw`SELECT prestamoId FROM prestamos WHERE clienteId IN (${Prisma.join(ids)}) ORDER BY prestamoId FOR UPDATE`;
  await tx.$queryRaw`SELECT anticipoId FROM anticipo WHERE clienteId IN (${Prisma.join(ids)}) ORDER BY anticipoId FOR UPDATE`;
}

/** Capital pendiente total del cliente en ese tipo de deuda. */
export async function capitalPendiente(tx, tipo, clienteID) {
  return redondear((await deudasConCapital(tx, tipo, clienteID)).reduce((s, x) => s + x.capital, 0));
}

async function actualizarEstado(tx, tipo, deudaId) {
  const t = config(tipo);
  const d = await tx[t.deuda].findUnique({ where: { [t.id]: deudaId } });
  if (d.estado === "ANULADO") return; // una deuda anulada no vuelve a COMPLETADO/ACTIVO por mover sus abonos
  const movs = await tx[t.movs].findMany({ where: { [t.fk]: deudaId } });
  const saldo = redondear(Number(d.monto || 0) + suma(movs, t.cargo) - (suma(movs, t.abono) + suma(movs, t.interes)));
  const estado = saldo <= 0 ? "COMPLETADO" : d.estado === "COMPLETADO" ? "ACTIVO" : d.estado;
  if (estado !== d.estado) await tx[t.deuda].update({ where: { [t.id]: deudaId }, data: { estado } });
}

/** Aplica el abono (FIFO) dentro de la transacción de la compra. Falla si no hay deuda o excede el capital pendiente. */
export async function aplicarAbono(tx, tipo, clienteID, monto, compraId, fecha = new Date()) {
  const t = config(tipo);
  const abono = redondear(monto);
  const deudas = await deudasConCapital(tx, tipo, clienteID);
  if (!deudas.length) throw new ErrorNegocio("El cliente no tiene capital pendiente para abonar.");
  const total = redondear(deudas.reduce((s, x) => s + x.capital, 0));
  if (abono > total) throw new ErrorNegocio(`El abono (L. ${abono.toFixed(2)}) excede el capital pendiente (L. ${total.toFixed(2)}).`);
  let resto = abono;
  for (const { d, capital } of deudas) {
    if (resto <= 0) break;
    const aplicar = redondear(Math.min(resto, capital));
    await tx[t.movs].create({
      data: { [t.fk]: d[t.id], fecha, tipo_movimiento: t.abono, monto: aplicar, interes: null, dias: null, descripcion: marcaAbono(compraId), compraId },
    });
    await actualizarEstado(tx, tipo, d[t.id]);
    resto = redondear(resto - aplicar);
  }
}

/** Anula los abonos que hizo una compra (en préstamos y anticipos, por compraId) y recalcula el estado de cada deuda. */
export async function anularAbonos(tx, compraId) {
  for (const tipo of Object.keys(TIPOS)) {
    const t = TIPOS[tipo];
    const movs = await tx[t.movs].findMany({ where: { compraId, tipo_movimiento: t.abono } });
    for (const m of movs) await tx[t.movs].update({ where: { MovimientoId: m.MovimientoId }, data: { tipo_movimiento: "ANULADO" } });
    for (const id of new Set(movs.map((m) => m[t.fk]))) await actualizarEstado(tx, tipo, id);
  }
}

/** Abono vigente de una compra, leído de los movimientos enlazados: { abono, tipo } (tipo null si no abonó). */
export async function abonoDeCompra(db, compraId) {
  let abono = 0;
  let tipo = null;
  for (const k of Object.keys(TIPOS)) {
    const t = TIPOS[k];
    const movs = await db[t.movs].findMany({ where: { compraId, tipo_movimiento: t.abono }, select: { monto: true } });
    const suma = redondear(movs.reduce((s, m) => s + Number(m.monto || 0), 0));
    if (suma > 0) {
      abono = redondear(abono + suma);
      tipo ??= k;
    }
  }
  return { abono, tipo };
}

/** Valida y normaliza lo que manda el formulario: { abono, tipo } (abono 0 si no aplica). */
export function validarAbono(abono, tipo, compraTotal) {
  const a = abono === undefined || abono === null || abono === "" ? 0 : Number(abono);
  if (!Number.isFinite(a) || a < 0) throw new ErrorNegocio("El abono a la deuda no es válido.");
  if (a === 0) return { abono: 0, tipo: null };
  config(tipo);
  if (a > Number(compraTotal)) throw new ErrorNegocio("El abono no puede ser mayor que el pago por el café.");
  return { abono: redondear(a), tipo };
}
