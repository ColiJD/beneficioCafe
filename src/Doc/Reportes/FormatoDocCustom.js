import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import fondoImg from "@/img/frijoles.png";

/**
 * Genera un archivo PDF para reportes con diseño optimizado (Custom).
 * Permite customPromedio en options.
 *
 * @param {Array} data - Conjunto de registros del reporte.
 * @param {Object} filtros - Filtros aplicados al reporte.
 * @param {Array} columnas - Definición de columnas:
 *        [{ header, key, format, isCantidad, isTotal }]
 *        isCantidad → columna con cantidad (QQ).
 *        isTotal → columna con monto (L).
 * @param {Object} options - Opciones del reporte (title, colores, orientación, customPromedio).
 *
 * Esta función sigue criterios de presentación clara y ordenada,
 * recomendados por estándares APA: organización, congruencia visual
 * y rotulación consistente.
 */
export const generarReportePDF = (
  data,
  filtros = {},
  columnas = [],
  options = {}
) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;

  // Colores base con valores predeterminados
  const colorPrimario = options.colorPrimario || [41, 128, 185];
  const colorSecundario = options.colorSecundario || [236, 240, 241];
  const colorTexto = options.colorTexto || [44, 62, 80];
  const colorAccento = options.colorAccento || [52, 152, 219];

  // Formateo de números con dos decimales
  const formatNumber = (num) =>
    !num || isNaN(num)
      ? "0.00"
      : Number(num).toLocaleString("es-HN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  /* ------------------------------------------------------
   * ENCABEZADO
   * ------------------------------------------------------ */
  const headerHeight = 32;

  // Fondo del encabezado
  doc.setFillColor(...colorPrimario);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  // Franja decorativa
  doc.setFillColor(...colorAccento);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Logo
  const logoSize = 18;
  const logoX = margin;
  const logoY = 7;

  try {
    doc.addImage(fondoImg, "PNG", logoX, logoY, logoSize, logoSize);
  } catch (error) {
    console.warn("No se pudo cargar el logo:", error);
  }

  // Título central
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(options.title || "REPORTE", pageWidth / 2, 14, { align: "center" });

  // Fecha de generación
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generado el: ${dayjs().format("DD/MM/YYYY [a las] HH:mm")}`,
    pageWidth / 2,
    22,
    { align: "center" }
  );

  // Línea inferior del encabezado
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(
    margin + 30,
    headerHeight - 3,
    pageWidth - margin - 30,
    headerHeight - 3
  );

  /* ------------------------------------------------------
   * SECCIÓN DE FILTROS
   * ------------------------------------------------------ */
  let yPos = headerHeight + 8;

  // Cálculo dinámico de la altura
  let filtrosLines = 1;
  if (filtros.fechaInicio && filtros.fechaFin) filtrosLines++;
  if (filtros.nombreFiltro) filtrosLines++;
  if (!filtros.fechaInicio && !filtros.nombreFiltro) filtrosLines++;

  const lineHeight = 5.5;
  const filtrosHeight = filtrosLines * lineHeight + 8;

  // Caja externa
  doc.setFillColor(250, 250, 252);
  doc.setDrawColor(...colorPrimario);
  doc.setLineWidth(0.3);
  doc.roundedRect(
    margin,
    yPos,
    pageWidth - margin * 2,
    filtrosHeight,
    2,
    2,
    "FD"
  );

  // Título de filtros
  yPos += 6;
  doc.setTextColor(...colorPrimario);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("FILTROS APLICADOS", margin + 5, yPos);

  yPos += lineHeight + 1;
  doc.setTextColor(...colorTexto);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Período
  if (filtros.fechaInicio && filtros.fechaFin) {
    doc.setFont("helvetica", "bold");
    doc.text("Período:", margin + 5, yPos);

    doc.setFont("helvetica", "normal");
    doc.text(
      `${dayjs(filtros.fechaInicio).format("DD/MM/YYYY")} - ${dayjs(
        filtros.fechaFin
      ).format("DD/MM/YYYY")}`,
      margin + 23,
      yPos
    );

    yPos += lineHeight;
  }

  // Búsqueda
  if (filtros.nombreFiltro) {
    doc.setFont("helvetica", "bold");
    doc.text("Búsqueda:", margin + 5, yPos);

    doc.setFont("helvetica", "normal");
    const maxWidth = pageWidth - margin * 2 - 30;

    const searchText = doc.splitTextToSize(
      `"${filtros.nombreFiltro}"`,
      maxWidth
    );
    doc.text(searchText, margin + 25, yPos);
    yPos += lineHeight * searchText.length;
  }

  // Sin filtros
  if (!filtros.fechaInicio && !filtros.nombreFiltro) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Sin filtros aplicados (todos los registros)", margin + 5, yPos);
    yPos += lineHeight;
  }

  yPos = headerHeight + 8 + filtrosHeight + 8;

  /* ------------------------------------------------------
   * CÁLCULO DE TOTALES Y PROMEDIO
   * ------------------------------------------------------ */
  const totales = {};
  let totalCantidad = 0;
  let totalMonto = 0;

  columnas.forEach((col) => {
    if (col.isCantidad || col.isTotal) {
      const suma = data.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
      totales[col.key] = suma;

      if (col.isCantidad) totalCantidad = suma;
      if (col.isTotal) totalMonto = suma;
    }
  });

  // Use customPromedio if available, otherwise calculate
  const promedioGeneral =
    options.customPromedio !== undefined
      ? options.customPromedio
      : totalCantidad > 0
      ? totalMonto / totalCantidad
      : 0;

  /* ------------------------------------------------------
   * TABLA DETALLE
   * ------------------------------------------------------ */
  const tableBody = data.map((row) =>
    columnas.map((col) => {
      if (col.format === "moneda") return `L. ${formatNumber(row[col.key])}`;
      if (col.format === "numero") return formatNumber(row[col.key]);
      return row[col.key] || "";
    })
  );

  // Fila final: Totales
  const totalRow = columnas.map((col, i) => {
    if (i === 0) return "TOTAL GENERAL";
    if (col.isCantidad) return formatNumber(totales[col.key] || 0);
    if (col.isTotal) return `L. ${formatNumber(totales[col.key] || 0)}`;
    if (col.key.toLowerCase().includes("promedio"))
      return `L. ${formatNumber(promedioGeneral)}`;
    return "";
  });

  tableBody.push(totalRow);

  const tableHead = columnas.map((col) => col.header);

  const footerSpace = 20;
  const availableHeight = pageHeight - yPos - footerSpace;

  autoTable(doc, {
    startY: yPos,
    head: [tableHead],
    body: tableBody,
    theme: "striped",
    headStyles: {
      fillColor: colorPrimario,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 3.5,
      minCellHeight: 8,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: colorTexto,
      cellPadding: 2.5,
      minCellHeight: 7,
    },
    alternateRowStyles: {
      fillColor: colorSecundario,
    },
    columnStyles: columnas.reduce((acc, col, idx) => {
      if (
        col.format === "moneda" ||
        col.format === "numero" ||
        col.isCantidad ||
        col.isTotal
      ) {
        acc[idx] = { halign: "right" };
      }
      return acc;
    }, {}),
    margin: { left: margin, right: margin, bottom: footerSpace },

    // Estilos especiales para la fila de totales
    didParseCell: (data) => {
      const isTotalRow =
        data.row.index === tableBody.length - 1 && data.section === "body";

      if (isTotalRow) {
        data.cell.styles.fillColor = [52, 73, 94];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 6;
        data.cell.styles.valign = "middle";

        if (data.column.index === 0) {
          data.cell.styles.halign = "right";
          return;
        }

        const rawValue = String(data.cell.raw).replace(/[^0-9.-]/g, "");
        const isNumeric = !isNaN(parseFloat(rawValue));

        data.cell.styles.halign = isNumeric ? "right" : "center";
      }
    },

    // Pie de página
    didDrawPage: (dataArg) => {
      const pageCount = doc.internal.getNumberOfPages();
      const currentPage = dataArg.pageNumber;

      const footerY = pageHeight - 12;

      doc.setDrawColor(...colorPrimario);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY, pageWidth - margin, footerY);

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Página ${currentPage} de ${pageCount}`,
        pageWidth - margin,
        footerY + 5,
        {
          align: "right",
        }
      );

      try {
        doc.addImage(fondoImg, "PNG", margin, footerY + 1.5, 5, 5);
      } catch {}
    },
  });

  /* ------------------------------------------------------
   * GUARDADO
   * ------------------------------------------------------ */
  const filename = `${(options.title || "reporte")
    .replace(/\s+/g, "_")
    .toLowerCase()}-${dayjs().format("YYYY-MM-DD-HHmm")}.pdf`;

  doc.save(filename);
  return doc;
};
