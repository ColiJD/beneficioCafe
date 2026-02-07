"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import fondoImg from "@/img/frijoles.png";

export const generarPDFMultiplesSecciones = (
  secciones,
  filtros = {},
  opciones = {}
) => {
  const doc = new jsPDF({
    orientation: opciones.orientation || "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.width;
  const margin = 15;

  const colorPrimario = opciones.colorPrimario || [41, 128, 185];
  const colorSecundario = opciones.colorSecundario || [236, 240, 241];
  const colorTexto = opciones.colorTexto || [44, 62, 80];
  const colorAccento = opciones.colorAccento || [52, 152, 219];

  // -------------------------------
  // Función de formato de números y monedas
  // -------------------------------
const formatNumber = (num) => {
  const valor = Number(num);
  if (isNaN(valor)) return "0.00";
  // Forzar 2 decimales y luego aplicar separador de miles
  return Number(valor.toFixed(2)).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

  const formatValue = (valor, tipo) => {
    if (tipo === "moneda") return `L. ${formatNumber(valor)}`;
    if (tipo === "numero") return formatNumber(valor);
    return valor ?? "";
  };

  // -------------------------------
  // Encabezado
  // -------------------------------
  const headerHeight = 32;
  doc.setFillColor(...colorPrimario);
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  doc.setFillColor(...colorAccento);
  doc.rect(0, 0, pageWidth, 3, "F");
  try {
    doc.addImage(fondoImg, "PNG", margin, 7, 18, 18);
  } catch (e) {}

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(opciones.title || "REPORTE", pageWidth / 2, 14, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Generado el: ${dayjs().format("DD/MM/YYYY [a las] HH:mm")}`,
    pageWidth / 2,
    22,
    { align: "center" }
  );

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(
    margin + 30,
    headerHeight - 3,
    pageWidth - margin - 30,
    headerHeight - 3
  );

  // -------------------------------
  // Filtros
  // -------------------------------
  let yPos = headerHeight + 8;
  const lineHeight = 5.5;
  const filtrosLines =
    1 +
    (filtros.fechaInicio && filtros.fechaFin ? 1 : 0) +
    (filtros.nombreFiltro ? 1 : 0);
  const filtrosHeight = filtrosLines * lineHeight + 8;

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

  yPos += 6;
  doc.setTextColor(...colorPrimario);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("FILTROS APLICADOS", margin + 5, yPos);

  yPos += lineHeight + 1;
  doc.setTextColor(...colorTexto);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

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

  if (filtros.nombreFiltro) {
    doc.setFont("helvetica", "bold");
    doc.text("Búsqueda:", margin + 5, yPos);
    doc.setFont("helvetica", "normal");
    const maxWidth = pageWidth - margin * 2 - 30;
    doc.text(
      doc.splitTextToSize(`"${filtros.nombreFiltro}"`, maxWidth),
      margin + 25,
      yPos
    );
    yPos += lineHeight * 1.5;
  }

  if (!filtros.fechaInicio && !filtros.nombreFiltro) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Sin filtros aplicados (todos los registros)", margin + 5, yPos);
    yPos += lineHeight;
  }

  yPos = headerHeight + 8 + filtrosHeight + 8;

  // -------------------------------
  // Secciones
  // -------------------------------
  secciones.forEach((seccion) => {
    if (!seccion.datos?.length) return;

    // Título de sección
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colorPrimario);
    doc.setFontSize(12);
    doc.text(seccion.titulo, margin, yPos);
    yPos += 6;

    const tableHead = seccion.columnas.map((c) => c.header);

    // Cuerpo de tabla
    const tableBody = seccion.datos.map((row) =>
      seccion.columnas.map((c) => formatValue(row[c.key], c.format))
    );

    // Totales
    const totalRow = seccion.columnas.map((c) => {
      if (c.isCantidad || c.isTotal) {
        const suma = seccion.datos.reduce(
          (acc, r) => acc + (parseFloat(r[c.key]) || 0),
          0
        );
        return c.isTotal ? `L. ${formatNumber(suma)}` : formatNumber(suma);
      }
      return "";
    });

    tableBody.push(totalRow);

    autoTable(doc, {
      startY: yPos,
      head: [tableHead],
      body: tableBody,
      theme: "striped",
      headStyles: {
        fillColor: colorPrimario,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8, cellPadding: 2.5, halign: "right" },
      alternateRowStyles: { fillColor: colorSecundario },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        // Alinear texto a la izquierda para columnas que no sean números/moneda
        const col = seccion.columnas[data.column.index];
        if (!["moneda", "numero"].includes(col.format)) {
          data.cell.styles.halign = "left";
        }
      },
    });

    yPos = doc.lastAutoTable.finalY + 10;
  });

  const filename = `${(opciones.title || "reporte").replace(
    /\s+/g,
    "_"
  )}-${dayjs().format("YYYY-MM-DD-HHmm")}.pdf`;
  doc.save(filename);
  return doc;
};
