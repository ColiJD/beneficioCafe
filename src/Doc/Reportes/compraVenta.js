import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";

/**
 * Generar PDF de compras/ventas con subtotales por cliente/comprador
 * @param {Array} data - Datos normalizados para PDF
 * @param {Object} filtros - { nombreFiltro, fechaInicio, fechaFin, movimiento }
 * @param {Object} options - { title, orientation, colorPrimario, colorSecundario, colorTexto }
 */
export const generarReportePDF = (data, filtros = {}, options = {}) => {
  const doc = new jsPDF({
    orientation: options.orientation || "landscape",
    unit: "mm",
    format: "a4",
  });

  const colorPrimario = options.colorPrimario || [41, 128, 185];
  const colorSecundario = options.colorSecundario || [236, 240, 241];
  const colorTexto = options.colorTexto || [44, 62, 80];

  const formatNumber = (num) =>
    !num || num === 0
      ? "0.00"
      : Number(num).toLocaleString("es-HN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  // === ENCABEZADO ===
  doc.setFillColor(...colorPrimario);
  doc.rect(0, 0, 297, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(options.title || "REPORTE DE COMPRAS/VENTAS", 148.5, 12, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado el: ${dayjs().format("DD/MM/YYYY HH:mm")}`, 148.5, 18, { align: "center" });

  // === FILTROS APLICADOS ===
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
      `• Período: ${dayjs(filtros.fechaInicio).format("DD/MM/YYYY")} - ${dayjs(filtros.fechaFin).format("DD/MM/YYYY")}`,
      20,
      yPosition
    );
    yPosition += 6;
  }

  if (filtros.nombreFiltro) {
    doc.text(`• Búsqueda por nombre: "${filtros.nombreFiltro}"`, 20, yPosition);
    yPosition += 6;
  }

  if (filtros.movimiento) {
    doc.text(`• Tipo de movimiento: ${filtros.movimiento}`, 20, yPosition);
    yPosition += 6;
  }

  if (!filtros.fechaInicio && !filtros.nombreFiltro && !filtros.movimiento) {
    doc.text("• Sin filtros aplicados (todos los registros)", 20, yPosition);
    yPosition += 6;
  }

  yPosition += 5;

  // === RESUMEN GENERAL ===
  const totales = data.reduce(
    (acc, item) => ({
      cantidadTotal: (acc.cantidadTotal || 0) + (item.cantidadTotal || 0),
      totalLps: (acc.totalLps || 0) + (item.totalLps || 0),
    }),
    {}
  );

  autoTable(doc, {
    startY: yPosition,
    head: [["RESUMEN GENERAL", "Total (QQ)", "Total (Lps)"]],
    body: [["Totales", formatNumber(totales.cantidadTotal), `L. ${formatNumber(totales.totalLps)}`]],
    theme: "grid",
    headStyles: { fillColor: colorPrimario, textColor: [255, 255, 255], fontSize: 10, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: colorTexto },
    alternateRowStyles: { fillColor: colorSecundario },
    margin: { left: 20, right: 20 },
  });

  yPosition = doc.lastAutoTable.finalY + 10;

  // === DETALLE POR CLIENTE/COMPRADOR CON SUBTOTALES ===
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DETALLE POR CLIENTE / COMPRADOR", 20, yPosition);
  yPosition += 8;

  data.forEach((cliente) => {
    const nombre = cliente.clienteNombreCompleto || cliente.compradorNombre || "Sin nombre";
    const id = cliente.clienteID || cliente.compradorID || "";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Cliente/Comprador: ${nombre} (ID: ${id})`, 20, yPosition);
    yPosition += 6;

    const tableData = cliente.detalles.map((det) => [
      det.compraId,
      det.tipoCafeNombre || "",
      det.compraFecha ? dayjs(det.compraFecha).format("DD/MM/YYYY") : "",
      formatNumber(det.compraCantidadQQ),
      `L. ${formatNumber(det.totalLps)}`,
      det.compraDescripcion || "",
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["ID Registro", "Tipo Café", "Fecha", "Cantidad (QQ)", "Total (Lps)", "Descripción"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: colorPrimario, textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 8, textColor: colorTexto },
      alternateRowStyles: { fillColor: colorSecundario },
      margin: { left: 20, right: 20 },
      didDrawPage: (dataArg) => {
        const pageCount = doc.internal.getNumberOfPages();
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Página ${dataArg.pageNumber} de ${pageCount}`, pageSize.width - 20, pageHeight - 10, { align: "right" });
        doc.setDrawColor(200, 200, 200);
        doc.line(20, pageHeight - 15, pageSize.width - 20, pageHeight - 15);
      },
    });

    yPosition = doc.lastAutoTable.finalY + 4;

    const subtotalQQ = cliente.detalles.reduce((acc, det) => acc + (det.compraCantidadQQ || 0), 0);
    const subtotalLps = cliente.detalles.reduce((acc, det) => acc + (det.totalLps || 0), 0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Subtotal ${nombre}: QQ ${formatNumber(subtotalQQ)} - Lps ${formatNumber(subtotalLps)}`, 20, yPosition);
    yPosition += 8;
  });

  // Pie de página con total de clientes/compradores
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Total de clientes/compradores: ${data.length}`, 20, yPosition + 5);

  const nombreArchivo = `reporte-clientes-${dayjs().format("YYYY-MM-DD-HHmm")}.pdf`;
  doc.save(nombreArchivo);
  return doc;
};
