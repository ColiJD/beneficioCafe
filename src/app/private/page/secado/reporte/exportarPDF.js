import { generarReportePDF } from "@/Doc/Reportes/FormatoDoc";
import dayjs from "dayjs";

export const exportarSecadoPDF = (data = [], filtros = {}, title = "REPORTE DE CONTROL DE SECADO") => {
  const dataFormateada = data.map((row) => ({
    secadoId: row.secadoId,
    secadora: row.secadora?.nombre || "—",
    fechaInicio: dayjs(row.fechaInicio).format("DD/MM/YYYY HH:mm"),
    fechaFin: row.fechaFin ? dayjs(row.fechaFin).format("DD/MM/YYYY HH:mm") : "En proceso",
    producto: row.producto?.productName || "—",
    cantidadEntradaQQ: Number(row.cantidadEntradaQQ || 0),
    cantidadSalidaQQ: Number(row.cantidadSalidaQQ || 0),
    humedadInicial: `${row.humedadInicial || 0}%`,
    humedadFinal: row.humedadFinal ? `${row.humedadFinal}%` : "—",
    estado: row.estado || "—",
  }));

  const columnasPDF = [
    { header: "ID", key: "secadoId", format: "texto" },
    { header: "SECADORA", key: "secadora", format: "texto" },
    { header: "F. INICIO", key: "fechaInicio", format: "texto" },
    { header: "F. FIN", key: "fechaFin", format: "texto" },
    { header: "PRODUCTO", key: "producto", format: "texto" },
    { header: "ENTRADA (QQ)", key: "cantidadEntradaQQ", format: "numero", isCantidad: true },
    { header: "SALIDA (QQ)", key: "cantidadSalidaQQ", format: "numero", isCantidad: true },
    { header: "H. INI", key: "humedadInicial", format: "texto" },
    { header: "H. FIN", key: "humedadFinal", format: "texto" },
    { header: "ESTADO", key: "estado", format: "texto" },
  ];

  // Filtros formateados para el encabezado
  const filtrosPDF = {
    fechaInicio: filtros.dateRange?.[0] ? filtros.dateRange[0].toISOString() : null,
    fechaFin: filtros.dateRange?.[1] ? filtros.dateRange[1].toISOString() : null,
    nombreFiltro: filtros.secadoraNombre ? `Secadora: ${filtros.secadoraNombre} | Estado: ${filtros.estadoLabel}` : `Estado: ${filtros.estadoLabel}`,
  };

  generarReportePDF(dataFormateada, filtrosPDF, columnasPDF, { 
    title,
    colorPrimario: [22, 163, 74] // Color verde para secado
  });
};
