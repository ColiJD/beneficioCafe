// utils/fechaHonduras.js
export function convertirAHonduras(utcDate) {
  if (!utcDate) return "";
  
  const fecha = new Date(utcDate);
  
  // Honduras: UTC-6
  const offset = 0; 
  const fechaHonduras = new Date(fecha.getTime() + offset * 60 * 60 * 1000);
  
  // Formato legible: YYYY-MM-DD HH:MM:SS
  const yyyy = fechaHonduras.getFullYear();
  const mm = String(fechaHonduras.getMonth() + 1).padStart(2, "0");
  const dd = String(fechaHonduras.getDate()).padStart(2, "0");
  const hh = String(fechaHonduras.getHours()).padStart(2, "0");
  const min = String(fechaHonduras.getMinutes()).padStart(2, "0");
  const ss = String(fechaHonduras.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}
