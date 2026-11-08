// Los reportes se imprimen en blanco y negro: este envoltorio convierte a escala de grises todos los colores
// que usa el documento (incluidas las tablas de autoTable), sin tocar la lógica de cada reporte.
//  - Rellenos oscuros o de color (franjas de título, cabeceras de tabla) → gris claro, con texto negro encima.
//  - Rellenos claros (filas alternas) → gris muy claro. El blanco queda blanco.
//  - Texto de color o blanco → negro; los grises de pie de página se conservan si se leen bien.
//  - Líneas de color → negro; las grises se conservan.
const CABECERA = 222; // gris de franjas y cabeceras (#DEDEDE)
const ALTERNA = 244; // gris de filas alternas (#F4F4F4)

const aRGB = (args) => {
  const [a, b, c] = args;
  if (typeof a === "string" && a.startsWith("#")) {
    const h = a.length === 4 ? a.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : a;
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  if (Array.isArray(a)) return a.slice(0, 3);
  if (typeof a === "number" && b === undefined) return [a, a, a];
  if ([a, b, c].every((v) => typeof v === "number")) return [a, b, c];
  return null; // otros formatos (CMYK, nombres): se dejan como vienen
};
const luz = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const esGris = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) < 12;

export const grisRelleno = (rgb) => {
  const l = luz(rgb);
  if (l > 0.97) return 255;
  return l > 0.85 ? ALTERNA : CABECERA;
};
export const grisTexto = (rgb) => {
  if (luz(rgb) > 0.85) return 0; // texto blanco sobre franja de color → negro sobre gris claro
  return esGris(rgb) ? Math.min(rgb[0], 110) : 0;
};
export const grisLinea = (rgb) => (esGris(rgb) ? rgb[0] : 0);

export function blancoYNegro(doc) {
  for (const [metodo, convertir] of [["setFillColor", grisRelleno], ["setTextColor", grisTexto], ["setDrawColor", grisLinea]]) {
    const original = doc[metodo].bind(doc);
    doc[metodo] = (...args) => {
      const rgb = aRGB(args);
      return rgb ? original(convertir(rgb)) : original(...args);
    };
  }
  return doc;
}
