// Guardia: las pruebas solo corren contra la base de desarrollo beneficioCafe_copia.
import { PrismaClient } from "@prisma/client";

export const BASE_DESARROLLO = "beneficioCafe_copia";

export function verificarBaseDesarrollo() {
  const url = process.env.DATABASE_URL || "";
  const base = url.split("?")[0].split("/").pop();
  if (base !== BASE_DESARROLLO) {
    throw new Error(`Pruebas abortadas: DATABASE_URL apunta a "${base}", solo se permite "${BASE_DESARROLLO}".`);
  }
}

verificarBaseDesarrollo();
export const prisma = new PrismaClient();

/** Ejecuta fn dentro de una transacción y la revierte siempre: no deja nada escrito. */
export async function enRollback(fn) {
  const REVERTIR = Symbol("revertir");
  let resultado;
  try {
    await prisma.$transaction(
      async (tx) => {
        resultado = await fn(tx);
        throw REVERTIR;
      },
      { timeout: 60_000, maxWait: 20_000 },
    );
  } catch (e) {
    if (e !== REVERTIR) throw e;
  }
  return resultado;
}

/** Inventario real vs. historial de movimientos (Entrada + Ajuste − Salida), por producto. */
export async function conciliacionInventario(cliente = prisma) {
  return cliente.$queryRaw`
    SELECT i.productoID,
           CAST(i.cantidadQQ AS DECIMAL(15,2)) AS saldo,
           CAST(COALESCE(SUM(CASE m.tipoMovimiento
                 WHEN 'Entrada' THEN m.cantidadQQ
                 WHEN 'Ajuste'  THEN m.cantidadQQ
                 WHEN 'Salida'  THEN -m.cantidadQQ
                 ELSE 0 END), 0) AS DECIMAL(15,2)) AS historial
    FROM inventariocliente i
    LEFT JOIN movimientoinventario m ON m.inventarioClienteID = i.inventarioClienteID
    GROUP BY i.productoID, i.cantidadQQ`;
}
