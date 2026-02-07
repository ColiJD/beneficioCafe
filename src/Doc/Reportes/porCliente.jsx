"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import { formatNumber } from "@/components/Formulario";

/**
 * Exporta movimientos de un cliente a PDF
 * @param {Object} params - Parámetros
 * @param {Array} params.dataTabla - Datos principales (Compras, Contratos, Depósitos)
 * @param {Array} params.prestamos - Préstamos y anticipos
 * @param {string} params.clienteNombre - Nombre del cliente
 * @param {Object} params.rangoFechas - Fechas { inicio, fin }
 * @param {Object} params.options - Opciones PDF
 */
export const exportPDFMovimientosCliente = ({
  dataTabla = [],
  prestamos = [],
  clienteNombre = "-",
  rangoFechas = {},
  options = {},
}) => {
  const doc = new jsPDF({
    orientation: "portrait", // orientación vertical
    unit: "mm",
    format: "letter", // tamaño carta
  });

  const colorPrimario = options.colorPrimario || [41, 128, 185];
  const colorSecundario = options.colorSecundario || [236, 240, 241];
  const colorTexto = options.colorTexto || [44, 62, 80];
  const colorPrestamos = options.colorPrestamos || [255, 193, 7];
  const fontSize = options.fontSize || 9;


  // ==== ENCABEZADO ====
  doc.setFillColor(...colorPrimario);
  doc.rect(0, 0, 216, 20, "F"); // ancho carta vertical, altura más pequeña
  doc.setTextColor(255, 255, 255);

  // Título
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Reporte de Movimientos - ${clienteNombre}`, 108, 10, {
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

  // ==== TABLA COMBINADA (Compras, Contratos, Depósitos) ====
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

  // ==== PRÉSTAMOS ====
  const safePrestamos = Array.isArray(prestamos)
    ? prestamos.filter((p) => p.tipo !== "ANTICIPO")
    : [];
  if (safePrestamos.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("PRÉSTAMOS", 20, yPosition);
    yPosition += 6;

    const bodyPrestamos = safePrestamos.map((p) => [
      p.tipo || "-",
      `L. ${formatNumber(p.monto ?? 0)}`,
      `L. ${formatNumber(p.abonado ?? 0)}`,
      `L. ${formatNumber(p.total ?? 0)}`,
    ]);

    const totalsPrestamos = safePrestamos.reduce(
      (acc, p) => {
        acc.monto += p.monto ?? 0;
        acc.abonado += p.abonado ?? 0;
        acc.total += p.total ?? 0;
        return acc;
      },
      { monto: 0, abonado: 0, total: 0 }
    );
    bodyPrestamos.push([
      "Totales",
      `L. ${formatNumber(totalsPrestamos.monto, 2)}`,
      `L. ${formatNumber(totalsPrestamos.abonado, 2)}`,
      `L. ${formatNumber(totalsPrestamos.total, 2)}`,
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Tipo", "Monto", "Abonado", "Restante"]],
      body: bodyPrestamos,
      theme: "grid",
      headStyles: {
        fillColor: colorPrestamos,
        textColor: [0, 0, 0],
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

  // ==== ANTICIPOS ====
  const safeAnticipos = Array.isArray(prestamos)
    ? prestamos.filter((p) => p.tipo === "ANTICIPO")
    : [];
  if (safeAnticipos.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("ANTICIPOS", 20, yPosition);
    yPosition += 6;

    const bodyAnticipos = safeAnticipos.map((p) => [
      p.tipo || "-",
      `L. ${formatNumber(p.monto ?? 0)}`,
      `L. ${formatNumber(p.abonado ?? 0)}`,
      `L. ${formatNumber(p.total ?? 0)}`,
    ]);

    const totalsAnticipos = safeAnticipos.reduce(
      (acc, p) => {
        acc.monto += p.monto ?? 0;
        acc.abonado += p.abonado ?? 0;
        acc.total += p.total ?? 0;
        return acc;
      },
      { monto: 0, abonado: 0, total: 0 }
    );
    bodyAnticipos.push([
      "Totales",
      `L. ${formatNumber(totalsAnticipos.monto, 2)}`,
      `L. ${formatNumber(totalsAnticipos.abonado, 2)}`,
      `L. ${formatNumber(totalsAnticipos.total, 2)}`,
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Tipo", "Monto", "Abonado", "Restante"]],
      body: bodyAnticipos,
      theme: "grid",
      headStyles: {
        fillColor: colorPrestamos,
        textColor: [0, 0, 0],
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

  if (
    body.length === 0 &&
    safePrestamos.length === 0 &&
    safeAnticipos.length === 0
  ) {
    doc.setFontSize(10);
    doc.setTextColor(200, 100, 100);
    doc.text("No hay datos disponibles para mostrar", 148.5, yPosition + 10, {
      align: "center",
    });
  }

  const nombreArchivo = `reporte-movimientos-${clienteNombre}-${dayjs().format(
    "YYYY-MM-DD-HHmm"
  )}.pdf`;
  doc.save(nombreArchivo);
  return doc;
};
