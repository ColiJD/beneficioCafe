import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";

/**
 * Genera un PDF para el Reporte de Detalles de Contrato
 * @param {Array} data - Datos del detalle de contrato
 * @param {Object} filtros - Fechas, nombre, etc.
 * @param {Object} resumen - Totales generales (QQ, Lps)
 */
export const generarReporteDetalleContrato = (
  data,
  filtros = {},
  resumen = {}
) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const colorPrimario = [16, 86, 132];
  const colorSecundario = [240, 242, 245];
  const colorTexto = [33, 37, 41];

  const formatNumber = (num) =>
    !num || num === 0
      ? "0.00"
      : Number(num).toLocaleString("es-HN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  // encabezado principal
  doc.setFillColor(...colorPrimario);
  doc.rect(0, 0, 297, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("REPORTE DE DETALLES DE CONTRATO", 148.5, 12, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado el: ${dayjs().format("DD/MM/YYYY HH:mm")}`, 148.5, 18, {
    align: "center",
  });

  // filtros
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

  if (filtros.nombreFiltro) {
    doc.text(`• Búsqueda por nombre: "${filtros.nombreFiltro}"`, 20, yPosition);
    yPosition += 6;
  }

  if (!filtros.fechaInicio && !filtros.nombreFiltro) {
    doc.text("• Sin filtros aplicados (todos los registros)", 20, yPosition);
    yPosition += 6;
  }

  yPosition += 8;

  // tabla totales
  if (resumen && data && data.length > 0) {
    const totalRegistros = resumen.totalRegistros || data.length;
    const totalQQ = resumen.totalQQ || 0;
    const totalLps = resumen.totalLps || 0;

    autoTable(doc, {
      startY: yPosition,
      head: [["TOTAL REGISTROS", "TOTAL QQ", "TOTAL LPS"]],
      body: [
        [
          totalRegistros,
          formatNumber(totalQQ),
          `L. ${formatNumber(totalLps)}`,
        ],
      ],
      headStyles: { fillColor: colorPrimario, textColor: [255, 255, 255] },
      bodyStyles: { textColor: colorTexto },
      theme: "grid",
      margin: { left: 20, right: 20 },
    });

    yPosition = doc.lastAutoTable.finalY + 10;
  }

  // tabla detalles
  if (data && data.length > 0) {
    const tableData = data.map((item) => [
      item.detalleID,
      item.contratoID,
      dayjs(item.fecha).format("DD/MM/YYYY"),
      item.nombreCliente || "—",
      item.tipoCafe || "—",
      item.tipoMovimiento || "Entrada",
      formatNumber(item.cantidadQQ),
      `L. ${formatNumber(item.precioQQ)}`,
      `L. ${formatNumber(item.totalLps)}`,
      item.observaciones || "—",
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [
        [
          "Detalle ID",
          "Contrato ID",
          "Fecha",
          "Cliente",
          "Tipo de Café",
          "Movimiento",
          "Cantidad QQ",
          "Precio QQ (Lps)",
          "Total (Lps)",
          "Observaciones",
        ],
      ],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: colorPrimario,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8, textColor: colorTexto },
      alternateRowStyles: { fillColor: colorSecundario },
      margin: { left: 20, right: 20 },
      didDrawPage: function (data) {
        const pageCount = doc.internal.getNumberOfPages();
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height
          ? pageSize.height
          : pageSize.getHeight();

        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          pageSize.width - 20,
          pageHeight - 10,
          { align: "right" }
        );

        doc.setDrawColor(200, 200, 200);
        doc.line(20, pageHeight - 15, pageSize.width - 20, pageHeight - 15);
      },
    });

    // totales al final
    const finalY = doc.lastAutoTable?.finalY || yPosition;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Total de registros: ${data.length}`, 20, finalY + 10);
  } else {
    doc.setFontSize(12);
    doc.setTextColor(200, 100, 100);
    doc.text("No hay datos disponibles para mostrar", 148.5, yPosition + 20, {
      align: "center",
    });
  }

  const nombreArchivo = `reporte-detalle-contrato-${dayjs().format(
    "YYYY-MM-DD-HHmm"
  )}.pdf`;
  doc.save(nombreArchivo);
  return doc;
};
