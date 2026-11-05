import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ErrorNegocio } from "@/lib/inventarioMov";
import { funcionHabilitada, POR_DEFECTO } from "@/lib/empresa-cliente";

// Todo lo de la empresa vive en su base de datos; las imágenes se sirven desde /api/empresa/imagen/<logo|icono>.
// ?v= cambia cuando cambia la imagen, para que el navegador no muestre la anterior.
const URL_LOGO = "/api/empresa/imagen/logo";
const URL_ICONO = "/api/empresa/imagen/icono";
export const invalidarEmpresa = () => (cache.hasta = 0);

// shortcut: caché en memoria del proceso (60 s), un cambio en la tabla tarda hasta 1 min en verse; subir a revalidación por evento si hace falta.
let cache = { hasta: 0, valor: null };

export async function getEmpresa() {
  if (cache.valor && Date.now() < cache.hasta) return cache.valor;
  let fila = null;
  try {
    // Sin las columnas de imagen (pesan cientos de KB): esas se leen solo al servir la imagen.
    fila = await prisma.empresa.findFirst({
      orderBy: { empresaID: "asc" },
      select: { empresaID: true, nombre: true, propietario: true, ciudad: true, pais: true, rtn: true, telefono: true, funciones: true },
    });
  } catch {}
  let v = {};
  try {
    [v = {}] = await prisma.$queryRaw`SELECT SUBSTRING(MD5(logoDatos), 1, 8) AS logo, SUBSTRING(MD5(iconoDatos), 1, 8) AS icono FROM empresa ORDER BY empresaID LIMIT 1`;
  } catch {}
  cache = {
    valor: { ...POR_DEFECTO, ...(fila ?? {}), logo: URL_LOGO + (v.logo ? `?v=${v.logo}` : ""), icono: URL_ICONO + (v.icono ? `?v=${v.icono}` : "") },
    hasta: Date.now() + 60_000,
  };
  return cache.valor;
}

export async function tieneFuncion(nombre) {
  return funcionHabilitada((await getEmpresa()).funciones, nombre);
}

/** Imagen guardada en la base (o null): { datos: Buffer, tipo } */
export async function getImagenEmpresa(cual /* "logo" | "icono" */) {
  const campo = cual === "icono" ? { datos: "iconoDatos", tipo: "iconoTipo" } : { datos: "logoDatos", tipo: "logoTipo" };
  let fila = null;
  try {
    fila = await prisma.empresa.findFirst({ orderBy: { empresaID: "asc" }, select: { [campo.datos]: true, [campo.tipo]: true } });
  } catch {}
  return fila?.[campo.datos] ? { datos: Buffer.from(fila[campo.datos]), tipo: fila[campo.tipo] || "application/octet-stream" } : null;
}

const TIPOS_IMAGEN = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
const MAX_IMAGEN = 1.5 * 1024 * 1024; // 1.5 MB

// "data:image/png;base64,...." → { datos: Buffer, tipo }
function leerImagen(dataUrl, cual) {
  const m = /^data:([\w.+/-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "");
  if (!m || !TIPOS_IMAGEN.includes(m[1])) throw new ErrorNegocio(`${cual}: formato no admitido (use PNG, JPG, WEBP, SVG o ICO)`);
  const datos = Buffer.from(m[2], "base64");
  if (datos.length > MAX_IMAGEN) throw new ErrorNegocio(`${cual}: pesa más de 1.5 MB`);
  return { datos, tipo: m[1] };
}

const texto = (v, campo, max, obligatorio = false) => {
  const s = String(v ?? "").trim();
  if (obligatorio && !s) throw new ErrorNegocio(`${campo} es obligatorio`);
  if (s.length > max) throw new ErrorNegocio(`${campo}: máximo ${max} caracteres`);
  return s || null;
};

/** Actualiza la fila única de empresa. logo/icono: data URL para cambiarlos, null o ausente para dejarlos. */
export async function guardarEmpresa(b, modulosValidos) {
  const data = {
    nombre: texto(b.nombre, "El nombre", 120, true),
    propietario: texto(b.propietario, "El propietario", 120, true),
    ciudad: texto(b.ciudad, "La ciudad", 80, true),
    pais: texto(b.pais, "El país", 80, true),
    rtn: texto(b.rtn, "El RTN", 20),
    telefono: texto(b.telefono, "El teléfono", 30),
  };
  if (b.funciones === null) data.funciones = Prisma.DbNull; // todas las funciones
  else if (Array.isArray(b.funciones)) {
    if (!b.funciones.every((f) => modulosValidos.includes(f))) throw new ErrorNegocio("Hay funciones que no existen");
    data.funciones = b.funciones;
  }
  if (b.logo) Object.assign(data, (({ datos, tipo }) => ({ logoDatos: datos, logoTipo: tipo }))(leerImagen(b.logo, "El logo")));
  if (b.icono) Object.assign(data, (({ datos, tipo }) => ({ iconoDatos: datos, iconoTipo: tipo }))(leerImagen(b.icono, "El icono")));
  const fila = await prisma.empresa.findFirst({ select: { empresaID: true } });
  if (fila) await prisma.empresa.update({ where: { empresaID: fila.empresaID }, data });
  else await prisma.empresa.create({ data });
  invalidarEmpresa();
  return getEmpresa();
}
