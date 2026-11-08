import { Prisma } from "@prisma/client";
import { ErrorNegocio } from "@/lib/inventarioMov";

// Una cosecha cerrada queda congelada: no se crean transacciones con fecha dentro de ella y sus registros
// no se modifican, anulan ni eliminan. Se aplica a cada tabla transaccional (modelo → columna de fecha).
const FECHAS = {
  compra: "compraFecha", deposito: "depositoFecha", contrato: "contratoFecha", contratoSalida: "contratoFecha",
  detallecontrato: "fecha", detalleContratoSalida: "fecha", liqdeposito: "liqFecha", liqsalida: "liqFecha",
  salida: "salidaFecha", caja_chica: "fecha", secado: "fechaInicio", servicio_secado: "fecha",
  prestamos: "fecha", anticipo: "fecha", prestamos_compradores: "fecha", anticipo_compradores: "fecha",
  movimientos_prestamo: "fecha", movimientos_anticipos: "fecha",
  movimientos_prestamo_compradores: "fecha", movimientos_anticipos_compradores: "fecha",
};

// Excepciones: lo que sigue pasando en un registro viejo como consecuencia de actividad posterior.
//  - "documento": su estado se recalcula al entregar, liquidar o abonar (Pendiente, Liquidado, ACTIVO, COMPLETADO…),
//    pero no se puede editar, anular ni eliminar.
//  - "movimiento": congelado del todo (solo se permite re-enlazar prestamo_id al refinanciar un préstamo).
//  - secado: mientras esté "En Proceso" se puede seguir completando, aunque empezara en la cosecha cerrada.
const DOCUMENTOS = ["deposito", "contrato", "contratoSalida", "salida", "prestamos", "anticipo", "prestamos_compradores", "anticipo_compradores"];
const SOLO_ENLACE = { movimientos_prestamo: ["prestamo_id"], movimientos_prestamo_compradores: ["prestamo_id"] };

// shortcut: caché en memoria del proceso (30 s); con varias instancias, un cierre tarda hasta 30 s en verse en las demás.
let cache = { hasta: 0, cerradas: [] };
export const invalidarCosechas = () => (cache.hasta = 0);

const dia = (d) => new Date(d).toISOString().slice(0, 10);
const valorDe = (v) => (v && typeof v === "object" && !(v instanceof Date) ? v.set : v); // { set: x } en updates

async function cerradas(base) {
  if (Date.now() >= cache.hasta) {
    const filas = await base.cosecha.findMany({ where: { estado: "Cerrada" }, select: { nombre: true, fechaInicio: true, fechaFin: true } });
    cache = { hasta: Date.now() + 30_000, cerradas: filas.map((c) => ({ nombre: c.nombre, ini: dia(c.fechaInicio), fin: dia(c.fechaFin) })) };
  }
  return cache.cerradas;
}
const cerradaDe = (lista, fecha) => {
  if (!fecha) return null;
  const f = dia(fecha);
  return lista.find((x) => f >= x.ini && f <= x.fin) ?? null;
};
const bloqueo = (c, accion) =>
  new ErrorNegocio(`Este registro pertenece a la cosecha cerrada ${c.nombre} (${c.ini} a ${c.fin}) y no se puede ${accion}.`, 409);

// Fecha nueva (crear o cambiar la fecha): no puede caer en una cosecha cerrada.
async function validarFecha(base, campo, data) {
  const lista = await cerradas(base);
  const valor = valorDe(data?.[campo]);
  const c = cerradaDe(lista, valor);
  if (c) throw new ErrorNegocio(`La fecha ${dia(valor)} cae en la cosecha cerrada ${c.nombre} (${c.ini} a ${c.fin}). Use una fecha de la cosecha vigente.`, 409);
}

// Registros existentes (los que tocaría el update/delete): si están en una cosecha cerrada, solo pasan las excepciones.
async function validarExistentes(base, modelo, campo, args, borrar) {
  const lista = await cerradas(base);
  if (!lista.length) return; // sin cierres no se consulta nada
  const filas = await base[modelo].findMany({ where: args.where, select: { [campo]: true, ...(modelo === "secado" ? { estado: true } : {}) } });
  for (const f of filas) {
    const c = cerradaDe(lista, f[campo]);
    if (!c) continue;
    if (modelo === "secado" && f.estado === "En Proceso") continue;
    if (!borrar) {
      const claves = Object.keys(args.data ?? {});
      if (DOCUMENTOS.includes(modelo) && claves.every((k) => k === "estado") && !/anulad/i.test(String(valorDe(args.data.estado)))) continue;
      if (SOLO_ENLACE[modelo] && claves.every((k) => SOLO_ENLACE[modelo].includes(k))) continue;
    }
    throw bloqueo(c, borrar ? "eliminar" : "modificar");
  }
  // y si además cambia la fecha, la nueva tampoco puede estar en una cosecha cerrada
  if (!borrar && args.data) await validarFecha(base, campo, args.data);
}

export function guardaDeFechas(base) {
  const query = {};
  for (const [modelo, campo] of Object.entries(FECHAS)) {
    const todos = (data) => [].concat(data ?? []);
    query[modelo] = {
      async create({ args, query }) { await validarFecha(base, campo, args.data); return query(args); },
      async createMany({ args, query }) { for (const d of todos(args.data)) await validarFecha(base, campo, d); return query(args); },
      async update({ args, query }) { await validarExistentes(base, modelo, campo, args, false); return query(args); },
      async updateMany({ args, query }) { await validarExistentes(base, modelo, campo, args, false); return query(args); },
      async delete({ args, query }) { await validarExistentes(base, modelo, campo, args, true); return query(args); },
      async deleteMany({ args, query }) { await validarExistentes(base, modelo, campo, args, true); return query(args); },
      async upsert({ args, query }) {
        await validarFecha(base, campo, args.create);
        await validarExistentes(base, modelo, campo, { where: args.where, data: args.update }, false);
        return query(args);
      },
    };
  }
  return Prisma.defineExtension({ name: "guardaDeCosechas", query });
}
