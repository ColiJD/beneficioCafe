"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import { formatNumber } from "@/components/Formulario";

/**
 * Exporta movimientos de un comprador a PDF
 * @param {Object} params - Parámetros
 * @param {Array} params.dataTabla - Datos principales (ConfirmacionVenta, Venta, Contratos)
 * @param {string} params.compradorNombre - Nombre del comprador
 * @param {Object} params.rangoFechas - Fechas { inicio, fin }
 * @param {Object} params.options - Opciones PDF
 */
export const exportPDFMovimientosComprador = ({
  dataTabla = [],
  compradorNombre = "-",
  rangoFechas = {},
  options = {},
}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  const colorPrimario = options.colorPrimario || [41, 128, 185];
  const colorSecundario = options.colorSecundario || [236, 240, 241];
  const colorTexto = options.colorTexto || [44, 62, 80];
  const fontSize = options.fontSize || 9;

  // ==== ENCABEZADO ====
  doc.setFillColor(...colorPrimario);
  doc.rect(0, 0, 216, 20, "F");
  doc.setTextColor(255, 255, 255);

  // Título
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Reporte de Comprador - ${compradorNombre}`, 108, 10, {
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
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("FILTROS APLICADOS:", 20, yPosition);
  yPosition += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  if (rangoFechas.inicio && rangoFechas.fin) {
    doc.text(
      `• Período: ${dayjs(rangoFechas.inicio).format("DD/MM/YYYY")} - ${dayjs(
        rangoFechas.fin
      ).format("DD/MM/YYYY")}`,
      20,
      yPosition
    );
    yPosition += 5;
  } else {
    doc.text("• Sin filtros aplicados (todos los registros)", 20, yPosition);
    yPosition += 5;
  }
  yPosition += 3;

  // ==== TABLA COMBINADA ====
  const safeData = Array.isArray(dataTabla) ? dataTabla : [];
  const body = safeData
    .filter((row) => row.totalQQ !== undefined || row.totalLps !== undefined)
    .map((row) => [
      row.tipo || "-",
      formatNumber(row.totalQQPorLiquidar ?? 0, 2),
      formatNumber(row.totalQQ ?? 0, 2),
      `L. ${formatNumber(row.totalLps ?? 0, 2)}`,
      `L. ${formatNumber(row.promedioPrecio ?? 0, 2)}`,
    ]);

  // ==== CALCULAR TOTALES PRINCIPAL ====
  const totals = safeData.reduce(
    (acc, row) => {
      acc.totalQQPorLiquidar += row.totalQQPorLiquidar ?? 0;
      acc.totalQQ += row.totalQQ ?? 0;
      acc.totalLps += row.totalLps ?? 0;
      return acc;
    },
    { totalQQPorLiquidar: 0, totalQQ: 0, totalLps: 0 }
  );
  const promedioPrecioTotal =
    totals.totalQQ > 0 ? totals.totalLps / totals.totalQQ : 0;

  if (body.length > 0) {
    body.push([
      "Totales",
      formatNumber(totals.totalQQPorLiquidar, 2),
      formatNumber(totals.totalQQ, 2),
      `L. ${formatNumber(totals.totalLps, 2)}`,
      `L. ${formatNumber(promedioPrecioTotal, 2)}`,
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [
        [
          "Tipo",
          "QQ Pendientes",
          "Entregado QQ",
          "Entregado Lps",
          "Promedio Precio",
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
      bodyStyles: { fontSize, textColor: colorTexto },
      alternateRowStyles: { fillColor: colorSecundario },
      margin: { left: 20, right: 20 },
    });
    yPosition = doc.lastAutoTable.finalY + 8;
  }

  if (body.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(200, 100, 100);
    doc.text("No hay datos disponibles para mostrar", 108, yPosition + 10, {
      align: "center",
    });
  }

  const nombreArchivo = `reporte-comprador-${compradorNombre}-${dayjs().format(
    "YYYY-MM-DD-HHmm"
  )}.pdf`;
  doc.save(nombreArchivo);
  return doc;
};
