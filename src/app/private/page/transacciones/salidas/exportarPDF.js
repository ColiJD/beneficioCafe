import { generarReportePDF } from "@/Doc/Reportes/FormatoDoc";
import dayjs from "dayjs";

export const exportarPDF = (data = [], columnas = [], filtros = {}, title = "") => {
  const dataFormateada = data.map((row) => {
    const nuevo = {};

    columnas.forEach((col) => {
      if (col.type === "date") {
        nuevo[col.key] = row[col.key] ? dayjs(row[col.key]).format("DD/MM/YYYY") : "";
      } else if (col.type === "number" || col.type === "money") {
        nuevo[col.key] = Number(row[col.key] || 0);
      } else {
        nuevo[col.key] = row[col.key] || "";
      }
    });

    return nuevo;
  });

  const columnasPDF = columnas.map((c) => ({
    header: c.label,
    key: c.key,
    format: c.type === "money" ? "moneda" : c.type === "number" ? "numero" : "texto",
    isCantidad: c.isCantidad || false,
    isTotal: c.isTotal || false,
  }));

  generarReportePDF(dataFormateada, filtros, columnasPDF, { title });
};
