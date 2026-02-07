import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

/**
 * Filtra un array de objetos según filtros de texto, exactos y rango de fechas.
 */
export function FiltrosTarjetas(
  data,
  filtros = {},
  rangoFecha = [null, null],
  fechaKey = "fechaDetalle",
  detallesKey = "detalles"
) {
  const [inicio, fin] = Array.isArray(rangoFecha) ? rangoFecha : [null, null];

  const inicioDay = inicio ? dayjs(inicio, "YYYY-MM-DD").startOf("day") : null;
  const finDay = fin ? dayjs(fin, "YYYY-MM-DD").endOf("day") : null;

  return data.filter((item) => {
    // 🔹 Filtros de texto
    for (const [campo, valor] of Object.entries(filtros)) {
      if (!valor) continue;
      const campoValor = item[campo] ?? "";
      if (
        typeof campoValor === "string" &&
        !campoValor.toLowerCase().includes(valor.toLowerCase())
      ) {
        return false;
      }
      if (typeof campoValor !== "string" && campoValor !== valor) {
        return false;
      }
    }

    // 🔹 Filtrar por rango de fechas
    if (item[detallesKey]?.length) {
      const detalleDentroRango = item[detallesKey].some((det) => {
        const fecha = dayjs(det[fechaKey], "YYYY-MM-DD").startOf("day"); // 🔹 startOf("day") agregado
        return (
          (!inicioDay || fecha.isSameOrAfter(inicioDay)) &&
          (!finDay || fecha.isSameOrBefore(finDay))
        );
      });
      if (!detalleDentroRango) return false;
    } else {
      if (item[fechaKey]) {
        const fecha = dayjs(item[fechaKey]).startOf("day"); // 🔹 startOf("day") agregado
        if (
          (inicioDay && fecha.isBefore(inicioDay, "day")) ||
          (finDay && fecha.isAfter(finDay, "day"))
        ) {
          return false;
        }
      }
    }

    return true;
  });
}
