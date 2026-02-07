import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";

/**
 * Genera un PDF con los contratos del reporte
 * @param {Array} data - Datos de los contratos
 * @param {Object} filtros - Filtros aplicados
 * @param {Object} options - Configuración visual
 */
export const generarReporteContratos = (data, filtros = {}, options = {}) => {
  const doc = new jsPDF({
    orientation: options.orientation || "landscape",
    unit: "mm",
    format: "a4",
  });

  const colorPrimario = options.colorPrimario || [16, 86, 132];
  const colorSecundario = options.colorSecundario || [240, 242, 245];
  const colorTexto = [33, 37, 41];

  const formatNumber = (num) =>
    !num || num === 0
      ? "0.00"
      : Number(num).toLocaleString("es-HN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  doc.setFillColor(...colorPrimario);
  doc.rect(0, 0, 297, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("REPORTE DE CONTRATOS", 148.5, 12, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado el: ${dayjs().format("DD/MM/YYYY HH:mm")}`, 148.5, 18, {
    align: "center",
  });

  let y = 35;
  doc.setFontSize(11);
  doc.setTextColor(...colorTexto);
  doc.text("FILTROS APLICADOS:", 20, y);
  y += 6;
  doc.setFontSize(9);

  if (filtros.fechaInicio && filtros.fechaFin) {
    doc.text(
      `• Período: ${dayjs(filtros.fechaInicio).format(
        "DD/MM/YYYY"
      )} - ${dayjs(filtros.fechaFin).format("DD/MM/YYYY")}`,
      20,
      y
    );
    y += 5;
  }
  if (filtros.nombreFiltro) {
    doc.text(`• Cliente: ${filtros.nombreFiltro}`, 20, y);
    y += 5;
  }
  if (!filtros.fechaInicio && !filtros.nombreFiltro) {
    doc.text("• Sin filtros (todos los contratos)", 20, y);
    y += 5;
  }

  if (data && data.length > 0) {
    const totalQQ = data.reduce(
      (sum, i) => sum + (parseFloat(i.cantidadQQ) || 0),
      0
    );
    const totalLps = data.reduce(
      (sum, i) => sum + (parseFloat(i.totalLps) || 0),
      0
    );

    autoTable(doc, {
      startY: y + 5,
      head: [["TOTAL REGISTROS", "TOTAL QQ", "TOTAL LPS"]],
      body: [[data.length, formatNumber(totalQQ), `L. ${formatNumber(totalLps)}`]],
      headStyles: { fillColor: colorPrimario, textColor: [255, 255, 255] },
      bodyStyles: { textColor: colorTexto },
      theme: "grid",
      margin: { left: 20, right: 20 },
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // Tabla de detalle 
  if (data && data.length > 0) {
    const tableData = data.map((i) => [
      i.contratoID,
      dayjs(i.fecha).format("DD/MM/YYYY"),
      i.nombreCliente,
      i.tipoCafe,
      formatNumber(i.cantidadQQ),
      `L. ${formatNumber(i.precio)}`,
      `L. ${formatNumber(i.totalLps)}`,
      formatNumber(i.retencionQQ),
      i.estado,
    ]);

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Contrato ID",
          "Fecha",
          "Cliente",
          "Tipo Café",
          "Cantidad QQ",
          "Precio Lps",
          "Total Lps",
          "Retención QQ",
          "Estado",
        ],
      ],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: colorPrimario,
        textColor: [255, 255, 255],
        fontSize: 10,
      },
      bodyStyles: { fontSize: 9, textColor: colorTexto },
      alternateRowStyles: { fillColor: colorSecundario },
      margin: { left: 20, right: 20 },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height || pageSize.getHeight();
        doc.setFontSize(8);
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          pageSize.width - 20,
          pageHeight - 10,
          { align: "right" }
        );
      },
    });
  } else {
    doc.setFontSize(12);
    doc.text("No hay contratos en este rango de fechas", 148.5, y + 10, {
      align: "center",
    });
  }

  const nombreArchivo = `reporte-contratos-${dayjs().format(
    "YYYY-MM-DD-HHmm"
  )}.pdf`;
  doc.save(nombreArchivo);
};
