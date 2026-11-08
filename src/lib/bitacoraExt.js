import { Prisma } from "@prisma/client";
import { detalleSeguro, actorDePeticion } from "@/lib/bitacoraCtx";

// Registra cada escritura (crear, editar, anular, eliminar) hecha desde una petición web, con el usuario de la sesión.
// Quedan fuera la propia bitácora, los tokens y las tablas que son consecuencia de otra (inventario).
// shortcut: se registra al ejecutarse la escritura; si la transacción que la contiene se revierte después, la fila queda.
//           Para un registro exacto habría que escribir dentro de la misma transacción.
const IGNORAR = new Set(["bitacora", "password_resets", "movimientoinventario", "inventariocliente", "cosecha_inventario"]);
const OPS = { create: "CREAR", createMany: "CREAR", update: "EDITAR", updateMany: "EDITAR", upsert: "EDITAR", delete: "ELIMINAR", deleteMany: "ELIMINAR" };
const ID = Object.fromEntries(Prisma.dmmf.datamodel.models.map((m) => [m.name, m.fields.find((f) => f.isId)?.name]));
const valor = (v) => (v && typeof v === "object" && !(v instanceof Date) && "set" in v ? v.set : v);
const esAnulacion = (data) => Object.values(data ?? {}).some((v) => /anulad/i.test(String(valor(v) ?? "")));

let pausaHasta = 0; // si la tabla no existe o falla, se deja de intentar un minuto (la bitácora nunca rompe una operación)

export function bitacoraExt(base, obtenerActor = actorDePeticion) {
  const hook = (operation) => async ({ model, args, query }) => {
    const resultado = await query(args);
    if (IGNORAR.has(model) || Date.now() < pausaHasta) return resultado;
    try {
      const actor = await obtenerActor();
      if (!actor) return resultado; // fuera de una petición web
      const unico = ["create", "update", "delete", "upsert"].includes(operation);
      const idDe = args.where?.[ID[model]];
      let evento = OPS[operation];
      if (evento === "EDITAR" && esAnulacion(args.data ?? args.update)) evento = "ANULAR";
      await base.bitacora.create({
        data: {
          userId: actor.userId, usuario: actor.usuario, rol: actor.rol, ip: actor.ip, ruta: actor.ruta,
          evento, modulo: model,
          registroId: String((unico ? resultado?.[ID[model]] : null) ?? (typeof idDe === "object" ? "" : idDe ?? "")) || null,
          detalle: detalleSeguro({
            datos: args.data ?? args.update ?? args.create, donde: args.where,
            eliminado: operation === "delete" ? resultado : undefined,
            afectados: unico ? undefined : resultado?.count,
          }),
        },
      });
    } catch {
      pausaHasta = Date.now() + 60_000;
    }
    return resultado;
  };
  return Prisma.defineExtension({
    name: "bitacora",
    query: { $allModels: Object.fromEntries(Object.keys(OPS).map((op) => [op, hook(op)])) },
  });
}
