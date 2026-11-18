// Parte de empresa que corre en el navegador (sin Prisma): carga única de /api/empresa.
// "*" en la lista = todas las funciones (y las que se agreguen), pudiendo llevar además opciones encendidas.
export const TODAS = "*";
export const funcionHabilitada = (funciones, nombre) => !Array.isArray(funciones) || funciones.includes(TODAS) || funciones.includes(nombre);

// Opciones que el cliente enciende a propósito (apagadas por defecto, aun con "todas las funciones"). Se guardan en el mismo arreglo de funciones.
export const OPCION_DESCUENTO_PRIMERO = "opt:descuento-primero";
export const OPCIONES = [[OPCION_DESCUENTO_PRIMERO, "Compra directa: permitir aplicar el descuento antes de restar los sacos"]];
export const opcionActiva = (funciones, nombre) => Array.isArray(funciones) && funciones.includes(nombre);

// Valores neutros si la tabla empresa no existe o falla la lectura (también los usa src/lib/empresa.js).
export const POR_DEFECTO = { nombre: "Beneficio de Café", propietario: "", ciudad: "", pais: "", rtn: null, telefono: null, funciones: null };

let promesa;
let logoPng = null;

// El logo en PNG (data URL) para los reportes PDF, que se arman de forma síncrona. null hasta que cargue.
export const logoSync = () => logoPng;

async function precargarLogo(url) {
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || 200;
    c.height = img.naturalHeight || 200;
    c.getContext("2d").drawImage(img, 0, 0);
    logoPng = c.toDataURL("image/png"); // convierte PNG/JPG/SVG a PNG, que es lo que jsPDF entiende
  } catch {}
}

export function cargarEmpresa() {
  promesa ??= fetch("/api/empresa")
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((e) => (precargarLogo(e.logo), e))
    .catch(() => { promesa = undefined; return { ...POR_DEFECTO, logo: "/api/empresa/imagen/logo" }; });
  return promesa;
}
