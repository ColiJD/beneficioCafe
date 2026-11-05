import prisma from "@/lib/prisma";
import { ErrorNegocio } from "@/lib/inventarioMov";
import { invalidarCosechas } from "@/lib/cosechaGuard";

const dia = (d) => new Date(d).toISOString().slice(0, 10);
// Fecha de hoy en Honduras (UTC-6), como texto AAAA-MM-DD
const hoy = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const aFecha = (s, campo) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s ?? "") || Number.isNaN(Date.parse(s))) throw new ErrorNegocio(`${campo}: fecha no válida (AAAA-MM-DD)`);
  return new Date(s + "T00:00:00.000Z");
};

/** La cosecha en curso (la única "Abierta") o null. */
export const getCosechaActual = () => prisma.cosecha.findFirst({ where: { estado: "Abierta" } });

/** Todas, de la más reciente a la más antigua; las cerradas con la foto del inventario al cierre. */
export async function listarCosechas() {
  const [cosechas, productos] = await Promise.all([
    prisma.cosecha.findMany({ orderBy: { fechaInicio: "desc" }, include: { inventario: true } }),
    prisma.producto.findMany({ select: { productID: true, productName: true } }),
  ]);
  const nombre = Object.fromEntries(productos.map((p) => [p.productID, p.productName]));
  return cosechas.map((c) => ({
    ...c,
    inventario: c.inventario.map((i) => ({ ...i, producto: nombre[i.productoID] ?? `#${i.productoID}` })),
  }));
}

export async function abrirCosecha({ nombre, fechaInicio }) {
  nombre = String(nombre ?? "").trim();
  if (!nombre || nombre.length > 50) throw new ErrorNegocio("El nombre es obligatorio (máximo 50 caracteres)");
  const inicio = aFecha(fechaInicio, "Fecha de inicio");
  if (await getCosechaActual()) throw new ErrorNegocio("Ya hay una cosecha abierta: ciérrela antes de abrir otra", 409);
  if (await prisma.cosecha.findUnique({ where: { nombre } })) throw new ErrorNegocio("Ya existe una cosecha con ese nombre", 409);
  const ultima = await prisma.cosecha.findFirst({ orderBy: { fechaFin: "desc" }, where: { fechaFin: { not: null } } });
  if (ultima && dia(inicio) <= dia(ultima.fechaFin))
    throw new ErrorNegocio(`La nueva cosecha debe empezar después del cierre de la anterior (${dia(ultima.fechaFin)})`, 409);
  const c = await prisma.cosecha.create({ data: { nombre, fechaInicio: inicio } });
  invalidarCosechas();
  return c;
}

export async function cerrarCosecha({ fechaFin, notas }, userId) {
  const fin = aFecha(fechaFin, "Fecha de cierre");
  if (dia(fin) > hoy()) throw new ErrorNegocio("La fecha de cierre no puede ser futura");
  const actual = await getCosechaActual();
  if (!actual) throw new ErrorNegocio("No hay una cosecha abierta", 409);
  if (dia(fin) < dia(actual.fechaInicio)) throw new ErrorNegocio("La fecha de cierre no puede ser anterior al inicio de la cosecha");
  const cerrada = await prisma.$transaction(async (tx) => {
    const inventario = await tx.inventariocliente.findMany({ select: { productoID: true, cantidadQQ: true, cantidadSacos: true } });
    // Foto del inventario al cierre: el café sigue existiendo en la siguiente cosecha, pero queda anotado cuánto había.
    await tx.cosecha_inventario.createMany({
      data: inventario.map((i) => ({ cosechaID: actual.cosechaID, productoID: i.productoID, cantidadQQ: i.cantidadQQ, cantidadSacos: i.cantidadSacos })),
    });
    return tx.cosecha.update({
      where: { cosechaID: actual.cosechaID },
      data: { estado: "Cerrada", fechaFin: fin, notas: notas?.toString().slice(0, 255) || null, cerradaEn: new Date(), cerradaPor: Number(userId) || null },
    });
  });
  invalidarCosechas();
  return cerrada;
}
