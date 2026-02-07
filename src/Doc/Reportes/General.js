// /Doc/Reportes/General.js
"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import { formatNumber } from "@/components/Formulario";

/**
 * Exporta resumen de movimientos a PDF con Entradas, Salidas, Préstamos, Anticipos e Inventario
 * @param {Array} data - datosTabla del front
 * @param {Object} filtros - Fechas y filtros aplicados
 * @param {Object} options - Opciones: title, colores, orientación
 */
export const exportPDFGeneralConPrestamos = (
  data,
  filtros = {},
  options = {}
) => {
  const doc = new jsPDF({
    orientation: "portrait", // orientación vertical
    unit: "mm",
    format: "letter", // tamaño carta
  });

  const colorPrimario = options.colorPrimario || [41, 128, 185]; // Azul
  const colorSecundario = options.colorSecundario || [236, 240, 241]; // Gris claro
  const colorTexto = options.colorTexto || [44, 62, 80]; // Gris oscuro
  const colorPrestamos = options.colorPrestamos || [255, 193, 7]; // Amarillo

  // ==== ENCABEZADO ====
  doc.setFillColor(...colorPrimario);
  doc.rect(0, 0, 216, 20, "F"); // ancho carta vertical, altura más pequeña
  doc.setTextColor(255, 255, 255);

  // Título
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`REPORTE GENERAL`, 108, 10, {
    align: "center",
  });

  // Fecha
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado el: ${dayjs().format("DD/MM/YYYY HH:mm")}`, 108, 16, {
    align: "center",
  });
  // ==== FILTROS ====
  let yPosition = 35;
  doc.setTextColor(...colorTexto);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("FILTROS APLICADOS:", 20, yPosition);
  yPosition += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
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
  if (!filtros.fechaInicio && !filtros.fechaFin) {
    doc.text("• Sin filtros aplicados (todos los registros)", 20, yPosition);
    yPosition += 6;
  }
  yPosition += 5;

  // ==== RESUMEN GENERAL (Entradas, Salidas y Saldo Restante) ====
  const resumen = data.filter((row) =>
    ["entradas", "salidas"].includes(row.key)
  );

  if (resumen.length) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN GENERAL", 20, yPosition);
    yPosition += 8;

    const bodyResumen = resumen.map((row) => [
      row.tipo || "",
      row.totalQQ != null ? formatNumber(row.totalQQ) : "",
      row.totalLps != null ? `L. ${formatNumber(row.totalLps)}` : "",
      row.promedio != null ? `L. ${formatNumber(row.promedio)}` : "",
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Tipo", "QQ Total", "Total Lps", "Promedio"]],
      body: bodyResumen,
      theme: "grid",
      headStyles: {
        fillColor: colorPrimario,
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: { fontSize: 9, textColor: colorTexto },
      alternateRowStyles: { fillColor: colorSecundario },
      margin: { left: 20, right: 20 },
    });

    yPosition = doc.lastAutoTable.finalY + 10;
  }

  // ==== INVENTARIO ====
  const inventario = data.filter((row) =>
    ["inv", "sal", "pend"].includes(row.key)
  );

  if (inventario.length) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("INVENTARIO", 20, yPosition);
    yPosition += 8;

    const bodyInventario = inventario.map((row) => {
      let colorRow = colorTexto;
      if (row.key === "inv" || row.key === "sal") colorRow = [0, 128, 0]; // verde
      if (row.key === "pend") colorRow = [255, 0, 0]; // rojo
      return [
        row.descripcion || "",
        {
          content: formatNumber(row.cantidad),
          styles: { textColor: colorRow },
        },
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [["Descripción", "Cantidad (QQ)"]],
      body: bodyInventario,
      theme: "grid",
      headStyles: {
        fillColor: colorPrimario,
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: colorSecundario },
      margin: { left: 20, right: 20 },
    });

    yPosition = doc.lastAutoTable.finalY + 10;
  }

  // ==== PRÉSTAMOS Y ANTICIPOS ====
  const prestamosYAnticipos = data.filter((row) =>
    ["prestamos", "anticipos"].includes(row.key)
  );
  if (prestamosYAnticipos.length) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("PRÉSTAMOS Y ANTICIPOS", 20, yPosition);
    yPosition += 8;

    const bodyPrestamos = prestamosYAnticipos.map((row) => [
      row.tipo || "",

      `L. ${formatNumber(row.totalCreditos)}`,
      `L. ${formatNumber(row.totalAbonos)}`,
      `L. ${formatNumber(row.saldo)}`,
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Tipo", "Total Créditos", "Total Abonos", "Saldo"]],
      body: bodyPrestamos,
      theme: "grid",
      headStyles: {
        fillColor: colorPrestamos,
        textColor: [0, 0, 0],
        fontSize: 10,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: { fontSize: 9, textColor: colorTexto },
      alternateRowStyles: { fillColor: colorSecundario },
      margin: { left: 20, right: 20 },
    });

    yPosition = doc.lastAutoTable.finalY + 10;
  }

  if (!resumen.length && !inventario.length && !prestamosYAnticipos.length) {
    doc.setFontSize(12);
    doc.setTextColor(200, 100, 100);
    doc.text("No hay datos disponibles para mostrar", 148.5, yPosition + 20, {
      align: "center",
    });
  }

  const nombreArchivo = `reporte-general-${dayjs().format(
    "YYYY-MM-DD-HHmm"
  )}.pdf`;
  doc.save(nombreArchivo);
  return doc;
};
