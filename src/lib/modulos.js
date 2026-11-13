// Sin prisma: usable en cliente. key = carpeta de src/app/api/<key>.
export const GRUPOS = [
  { grupo: "Entradas", items: [
    ["compras", "Compra directa"], ["reg-compras", "Registro de compras"],
    ["deposito", "Depósito"], ["reg-depositos", "Registro de depósitos"],
    ["liqDeposito", "Liquidar depósito"], ["reg-liqDepositos", "Registro de liquidaciones de depósito"],
    ["contratos", "Contratos (entradas)"], ["reg-contratos", "Registro de contratos (entradas)"],
    ["entregaContratos", "Entregar contrato (entradas)"], ["reg-entregaContratos", "Registro de entregas (entradas)"] ] },
  { grupo: "Salidas", items: [
    ["Venta", "Venta directa"], ["reg-ventas", "Registro de ventas"],
    ["salidas", "Confirmación de venta"], ["reg-salidas", "Registro de confirmaciones"],
    ["liqSalidas", "Liquidar salida"], ["reg-liqSalidas", "Registro de liquidaciones de salida"],
    ["contratoSalida", "Contratos (salidas)"], ["reg-contratoSalida", "Registro de contratos (salidas)"],
    ["entregaContratoSalida", "Entregar contrato (salidas)"], ["reg-entregaContratoSalida", "Registro de entregas (salidas)"] ] },
  { grupo: "Préstamos y anticipos", items: [
    ["prestamos", "Préstamos clientes"], ["anticipos", "Anticipos clientes"],
    ["prestamosCompradores", "Préstamos compradores"],
    ["anticiposCompradores", "Anticipos compradores"] ] },
  { grupo: "Registros", items: [
    ["productos", "Productos"], ["clientes", "Clientes"], ["compradores", "Compradores"] ] },
  { grupo: "Inventario y secado", items: [
    ["inventario", "Inventario"], ["transferencias", "Conversión / transferencia de café"],
    ["secado", "Control de secado"], ["secadoras", "Secadoras"] ] },
  { grupo: "Informes", items: [
    ["informe-general", "General"], ["informe-entradas", "Registro de entradas"],
    ["informe-salidas", "Registro de salidas"], ["informe-porCliente", "Por cliente"],
    ["informe-porComprador", "Por comprador"], ["informe-saldoDeposito", "Saldo por depósito"],
    ["informe-saldoContrato", "Saldo por contrato"], ["informe-prestamos", "Saldo préstamos y anticipos"],
    ["reg-secado", "Reporte de secado"] ] },
  { grupo: "Caja", items: [["caja-chica", "Caja chica"]] },
];
export const ETIQUETAS = Object.fromEntries(GRUPOS.flatMap((g) => g.items));

// Red de dependencias: al usar un módulo sus pantallas CONSULTAN datos de estos (listas de clientes/productos,
// saldos de contratos, préstamos pendientes...). Se les da acceso solo a los DATOS (API en lectura),
// nunca a su pantalla ni al menú. No es transitiva.
const CLIENTES_OPS = ["clientes", "productos", "contratos", "liqDeposito", "prestamos", "anticipos"];
export const DEPENDENCIAS = {
  compras: CLIENTES_OPS,
  deposito: CLIENTES_OPS,
  liqDeposito: ["productos", "contratos", "prestamos", "anticipos"],
  contratos: CLIENTES_OPS.filter((m) => m !== "contratos"),
  contratoSalida: ["compradores", "productos", "salidas"],
  salidas: ["compradores", "productos", "contratoSalida"],
  Venta: ["compradores", "productos", "contratoSalida", "salidas", "compras"],
  prestamos: ["clientes", "anticipos"],
  anticipos: ["clientes"],
  prestamosCompradores: ["compradores", "anticiposCompradores"],
  anticiposCompradores: ["compradores"],
  entregaContratos: ["contratos", "productos", "liqDeposito", "prestamos", "anticipos"],
  entregaContratoSalida: ["contratoSalida", "compradores", "productos", "salidas"],
  liqSalidas: ["salidas", "compradores"],
  "reg-entregaContratos": ["contratos"],
  "reg-entregaContratoSalida": ["contratoSalida", "contratos"],
  transferencias: ["productos"],
  secado: ["productos", "secadoras"],
  "informe-porCliente": ["clientes"],
  "informe-saldoDeposito": ["deposito"],
  "informe-saldoContrato": ["contratos"],
};
export const necesitan = (modulo) =>
  Object.keys(DEPENDENCIAS).filter((m) => DEPENDENCIAS[m].includes(modulo));

// Cada acción existe en un solo lugar: el formulario registra y actualiza; el registro consulta y elimina
// (salvo los registros que editan en su propia pantalla). Las que no aplican no se pueden asignar.
const NO_APLICA = {
  compras: ["eliminar"], Venta: ["eliminar"], contratos: ["eliminar"], contratoSalida: ["eliminar"],
  deposito: ["editar", "eliminar"], liqDeposito: ["editar", "eliminar"], salidas: ["editar", "eliminar"],
  liqSalidas: ["editar", "eliminar"], entregaContratos: ["editar", "eliminar"], entregaContratoSalida: ["editar", "eliminar"],
  "reg-compras": ["crear", "editar"], "reg-ventas": ["crear", "editar"],
  "reg-contratos": ["crear", "editar"], "reg-contratoSalida": ["crear", "editar"],
  "reg-liqDepositos": ["crear", "editar"], "reg-liqSalidas": ["crear", "editar"],
  "reg-depositos": ["crear"], "reg-entregaContratos": ["crear"], "reg-entregaContratoSalida": ["crear"],
  "reg-salidas": ["crear"], "reg-secado": ["crear", "editar", "eliminar"],
};
export const aplica = (modulo, accion) => !(NO_APLICA[modulo] || []).includes(accion);

export const MODULOS = GRUPOS.flatMap((g) => g.items.map(([k]) => k));
export const ACCIONES = ["ver", "crear", "editar", "eliminar"];
// columna en BD: ver → puedeVer, crear → puedeCrear...
export const col = (a) => "puede" + a[0].toUpperCase() + a.slice(1);

// Ruta de página → módulo (o lista: basta tener permiso en cualquiera, p.ej. préstamos + anticipos en una misma pantalla). "ADMIN" = solo administradores; null = cualquier usuario logueado.
const RUTAS = [
  ["/private/caja-chica", "caja-chica"],
  ["/private/page/user", "ADMIN"],
  ["/private/page/roles", "ADMIN"],
  ["/private/page/cosechas", "ADMIN"],
  ["/private/page/empresa", "ADMIN"],
  ["/private/page/bitacora", "ADMIN"],
  ["/private/page/cliente", "clientes"],
  ["/private/page/compradores", "compradores"],
  ["/private/page/producto", "productos"],
  ["/private/page/inventario/transferir", "transferencias"],
  ["/private/page/inventario", "inventario"],
  ["/private/page/secadora", "secadoras"],
  // Central de registros: solo si puede ver alguno de los registros que lista
  ["/private/page/registros", ["reg-compras", "reg-ventas", "reg-depositos", "reg-liqDepositos", "reg-contratos",
    "reg-entregaContratos", "reg-salidas", "reg-liqSalidas", "reg-contratoSalida", "reg-entregaContratoSalida",
    "prestamos", "anticipos", "prestamosCompradores", "anticiposCompradores", "reg-secado"]],
  ["/private/page/secado/reporte", "reg-secado"],
  ["/private/page/secado", "secado"],
  ["/private/page/informe/general", "informe-general"],
  ["/private/page/informe/reporteCliente", "informe-entradas"],
  ["/private/page/informe/reporteSalidas", "informe-salidas"],
  ["/private/page/informe/porCliente", "informe-porCliente"],
  ["/private/page/informe/porComprador", "informe-porComprador"],
  ["/private/page/informe/reportePrestamo", "informe-prestamos"],
  ["/private/page/informe/registrodeposito", "reg-depositos"],
  ["/private/page/transacciones/deposito/vista", "informe-saldoDeposito"],
  ["/private/page/transacciones/contrato/vista", "informe-saldoContrato"],
  ["/private/page/transacciones/compra/vista", "reg-compras"],
  ["/private/page/transacciones/compra", "compras"],
  ["/private/page/transacciones/deposito/liqDeposito", "liqDeposito"],
  ["/private/page/transacciones/deposito/lipdedeposito", "reg-liqDepositos"],
  ["/private/page/transacciones/deposito", "deposito"],
  ["/private/page/transacciones/contratoSalida/registrocontrato", "reg-contratoSalida"],
  ["/private/page/transacciones/contratoSalida/detallecontrato", "reg-entregaContratoSalida"],
  ["/private/page/transacciones/contratoSalida/entrega", "entregaContratoSalida"],
  ["/private/page/transacciones/contratoSalida", "contratoSalida"],
  ["/private/page/transacciones/contrato/registrocontrato", "reg-contratos"],
  ["/private/page/transacciones/contrato/detallecontrato", "reg-entregaContratos"],
  ["/private/page/transacciones/contrato/entrega", "entregaContratos"],
  ["/private/page/transacciones/contrato", "contratos"],
  ["/private/page/transacciones/prestamosCompradores", ["prestamosCompradores", "anticiposCompradores"]],
  ["/private/page/transacciones/prestamos", ["prestamos", "anticipos"]],
  ["/private/page/transacciones/salidas/registroliq", "reg-liqSalidas"],
  ["/private/page/transacciones/salidas/registro", "reg-salidas"],
  ["/private/page/transacciones/salidas", "salidas"],
  ["/private/page/transacciones/venta/vista", "reg-ventas"],
  ["/private/page/transacciones/venta", "Venta"],
];
// Cada transacción son DOS módulos: formulario (crear/actualizar) y registro (lista, eliminar).
// Los endpoints que sirven a las dos pantallas aceptan el permiso de cualquiera de ellas:
//   GET → formulario o registro · POST → formulario · PUT → donde se edita (EDITA_EN) · DELETE → registro.
const FAMILIAS = {
  compras: ["compras", "reg-compras"], Venta: ["Venta", "reg-ventas"],
  deposito: ["deposito", "reg-depositos"], liqDeposito: ["liqDeposito", "reg-liqDepositos"],
  contratos: ["contratos", "reg-contratos"], entregaContratos: ["entregaContratos", "reg-entregaContratos"],
  salidas: ["salidas", "reg-salidas"], liqSalidas: ["liqSalidas", "reg-liqSalidas"],
  contratoSalida: ["contratoSalida", "reg-contratoSalida"],
  entregaContratoSalida: ["entregaContratoSalida", "reg-entregaContratoSalida"],
};
// dónde se edita: 0 = formulario (el lápiz del registro lleva a él), 1 = el propio registro
const EDITA_EN = { deposito: 1, salidas: 1, entregaContratos: 1, entregaContratoSalida: 1 };
export function modulosDeModulo(modulo, method = "GET") {
  const f = FAMILIAS[modulo];
  if (!f) return [modulo];
  if (method === "POST") return [f[0]];
  if (method === "DELETE") return [f[1]];
  if (method === "PUT" || method === "PATCH") return [f[EDITA_EN[modulo] ?? 0]];
  return f;
}
const API_INFORMES = {
  reporteCliente: "informe-entradas", reporteSalidas: "informe-salidas", porCliente: "informe-porCliente",
  porComprador: "informe-porComprador", reportePrestamos: "informe-prestamos",
};
export const modulosDeApi = (pathname = "", method = "GET") => {
  const [, , a, sub] = pathname.split("/");
  if (a === "inventario" && sub === "transferir") return ["transferencias"];
  if (a === "reportes") return [API_INFORMES[sub] || "informe-general"];
  if (a === "secado" && sub === "reporte") return ["reg-secado"];
  if (a === "contratos" && sub === "vista") return ["informe-saldoContrato"];
  // la pantalla de préstamos también es la de anticipos: consultar préstamos vale con cualquiera de los dos
  if (a === "prestamos" && method === "GET") return ["prestamos", "anticipos"];
  let fam = a;
  if (a === "compras" && sub === "salidas") fam = "Venta"; // lista de ventas
  else if (a === "contratos" && (sub === "entregar" || sub === "detallecontrato")) fam = "entregaContratos";
  else if (a === "contratoSalida" && (sub === "entregar" || sub === "detallecontrato")) fam = "entregaContratoSalida";
  else if (a === "salidas" && sub === "liquidarSalida") fam = "liqSalidas";
  return modulosDeModulo(fam, method);
};
export const moduloDeRuta = (pathname = "") =>
  RUTAS.find(([p]) => pathname === p || pathname.startsWith(p + "/"))?.[1] ?? null;

// ¿puede el usuario (resultado de /api/auth/permisos) entrar/editar en esa ruta?
export function puedeEnModulo(acc, modulo, accion = "ver") {
  if (!acc) return false;
  return !!acc.permisos[modulo]?.[accion];
}
export function puedeEnRuta(acc, pathname, accion = "ver") {
  if (!acc) return false;
  const m = moduloDeRuta(pathname);
  if (m === null) return true;
  if (m === "ADMIN") return !!acc.admin; // Administración: solo con rol ADMIN

  return [].concat(m).some((x) => puedeEnModulo(acc, x, accion));
}
