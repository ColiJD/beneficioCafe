"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";

/**
 * Exporta listado de clientes a PDF (todos los campos en una sola fila + números de página)
 * @param {Array} data - Datos de los clientes
 * @param {Object} filtros - Filtros aplicados (nombre, fechas, etc.)
 * @param {Object} options - Opciones: title, colores, orientación
 */
export const exportPDFClientes = (data, filtros = {}, options = {}) => {
  const doc = new jsPDF({
    orientation: options.orientation || "landscape",
    unit: "mm",
    format: "a4",
  });

  const colorPrimario = options.colorPrimario || [41, 128, 185]; // Azul
  const colorSecundario = options.colorSecundario || [236, 240, 241]; // Gris claro
  const colorTexto = options.colorTexto || [44, 62, 80]; // Gris oscuro

  // --- ENCABEZADO ---
  doc.setFillColor(...colorPrimario);
  doc.rect(0, 0, 297, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(options.title || "REPORTE DE CLIENTES", 148.5, 12, {
    align: "center",
  });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado el: ${dayjs().format("DD/MM/YYYY HH:mm")}`, 148.5, 18, {
    align: "center",
  });

  // --- FILTROS ---
  let yPosition = 35;
  doc.setTextColor(...colorTexto);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("FILTROS APLICADOS:", 20, yPosition);
  yPosition += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  if (filtros.nombreFiltro) {
    doc.text(`• Nombre contiene: "${filtros.nombreFiltro}"`, 20, yPosition);
    yPosition += 6;
  }

  if (filtros.fechaInicio && filtros.fechaFin) {
    doc.text(
      `• Período: ${dayjs(filtros.fechaInicio).format("DD/MM/YYYY")} - ${dayjs(
        filtros.fechaFin
      ).format("DD/MM/YYYY")}`,
      20,
      yPosition
    );
    yPosition += 6;
  }

  if (!filtros.nombreFiltro && !filtros.fechaInicio && !filtros.fechaFin) {
    doc.text("• Sin filtros aplicados (todos los registros)", 20, yPosition);
    yPosition += 6;
  }

  yPosition += 5;

  // --- TABLA PRINCIPAL (TODOS LOS CAMPOS) ---
  const body = data.map((c) => [
    c.clienteID,
    `${c.clienteNombre || ""} ${c.clienteApellido || ""}`,
    c.clienteTelefono || "",
    c.clienteCedula || "",
    c.clienteDepartament || "",
    c.clienteRTN || "N/A",
    c.clienteDirecion || "N/A",
    c.clienteMunicipio || "N/A",
    c.claveIHCAFE || "N/A",
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [
      [
        "ID",
        "Nombre",
        "Teléfono",
        "Cédula",
        "Departamento",
        "RTN",
        "Dirección",
        "Municipio",
        "IHCAFE",
      ],
    ],
    body,
    theme: "grid",
    headStyles: {
      fillColor: colorPrimario,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: { fontSize: 8, textColor: colorTexto },
    alternateRowStyles: { fillColor: colorSecundario },
    margin: { left: 10, right: 10 },
    styles: { cellPadding: 2, overflow: "linebreak" },
    didDrawPage: (dataArg) => {
      // Número de página en el pie
      const pageCount = doc.internal.getNumberOfPages();
      const pageCurrent = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        `Página ${pageCurrent} / ${pageCount}`,
        doc.internal.pageSize.getWidth() - 20,
        doc.internal.pageSize.getHeight() - 10,
        { align: "right" }
      );
    },
  });

  // --- GUARDAR ---
  const nombreArchivo = `clientesRegistrados-${dayjs().format(
    "YYYY-MM-DD-HHmm"
  )}.pdf`;
  doc.save(nombreArchivo);
  return doc;
};
