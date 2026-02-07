"use client";
import jsPDF from "jspdf";

export function generarContratoDoc(formData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 50;

  // Título
  doc.setFont("Times", "bold");
  doc.setFontSize(18);
  doc.text("CONTRATO DE COMPRA-VENTA DE CAFÉ", pageWidth / 2, y, {
    align: "center",
  });
  y += 40;

  doc.setFont("Times", "normal");
  doc.setFontSize(12);

  // Fecha y lugar
  const fechaActual = new Date().toLocaleDateString("es-HN");
  doc.text(
    `En Tegucigalpa, Honduras, a los ${fechaActual}, se celebra el presente contrato entre las partes:`,
    margin,
    y,
    { maxWidth: pageWidth - 2 * margin }
  );
  y += 30;

  // Comprador
  doc.setFont("Times", "bold");
  doc.text(`COMPRADOR: ${formData.clienteNombre || "N/A"}`, margin, y);
  y += 30;

  // Tabla manual
  const tableX = margin;
  const tableY = y;
  const colWidths = [
    (pageWidth - 2 * margin) * 0.4,
    (pageWidth - 2 * margin) * 0.2,
    (pageWidth - 2 * margin) * 0.2,
    (pageWidth - 2 * margin) * 0.2,
  ];
  const rowHeight = 20;

  // Encabezado
  doc.setFont("Times", "bold");
  ["Producto", "Cantidad (QQ)", "Precio por QQ", "Total Lps"].forEach(
    (text, i) => {
      doc.rect(
        tableX + colWidths.slice(0, i).reduce((a, b) => a + b, 0),
        tableY,
        colWidths[i],
        rowHeight
      );
      doc.text(
        text,
        tableX + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 2,
        tableY + 14
      );
    }
  );

  // Datos
  doc.setFont("Times", "normal");
  const dataY = tableY + rowHeight;
  [
    formData.productoNombre || "-",
    formData.contratoCantidadQQ?.toString() || "0",
    `L. ${formData.contratoPrecio || "0"}`,
    `L. ${formData.contratoTotalLps || "0"}`,
  ].forEach((text, i) => {
    doc.rect(
      tableX + colWidths.slice(0, i).reduce((a, b) => a + b, 0),
      dataY,
      colWidths[i],
      rowHeight
    );
    doc.text(
      text,
      tableX + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 2,
      dataY + 14
    );
  });

  y = dataY + rowHeight + 20;

  // Modalidad y observaciones
  doc.setFont("Times", "bold");
  doc.text(
    `Modalidad de contrato: ${formData.contratoEn || "Contrato Directo"}`,
    margin,
    y
  );
  y += 20;
  doc.text(
    `Observaciones: ${formData.contratoDescripcion || "N/A"}`,
    margin,
    y
  );
  y += 40;

  // Cláusulas
  const clausulas = [
    "1. Obligaciones del Vendedor: El vendedor se compromete a entregar el café en la cantidad y condiciones acordadas, asegurando la calidad y procedencia del producto.",
    "2. Obligaciones del Comprador: El comprador se obliga a pagar el precio total estipulado en este contrato en la forma y plazos acordados, cumpliendo las condiciones establecidas.",
    `3. Observaciones y Detalles Adicionales: ${
      formData.contratoDescripcion || "Ninguna."
    }`,
    "4. Aceptación de Condiciones: Ambas partes declaran haber leído, comprendido y aceptado íntegramente los términos y condiciones de este contrato, firmando en señal de conformidad.",
  ];

  doc.setFont("Times", "bold");
  doc.text("CLÁUSULAS:", margin, y);
  y += 20;
  doc.setFont("Times", "normal");
  clausulas.forEach((c) => {
    doc.text(c, margin, y, { maxWidth: pageWidth - 2 * margin });
    y += 30;
  });

  // Firmas
  y += 40;
  const signatureY = y;
  const halfWidth = (pageWidth - 2 * margin) / 2;

  doc.text("_________________________", margin, signatureY);
  doc.text("Firma del Comprador", margin, signatureY + 15);

  doc.text("_________________________", margin + halfWidth, signatureY);
  doc.text("Firma del Vendedor", margin + halfWidth, signatureY + 15);

  const clienteNombre =
    formData.cliente?.data?.clienteNombre?.trim() || "Cliente";
  const clienteApellido =
    formData.cliente?.data?.clienteApellido?.trim() || "N/A";
  const contratoID = Date.now(); // si no tienes un ID, puedes usar un timestamp: new Date().getTime()

  // 🔹 Construir nombre seguro
  let nombreArchivo = `Contrato_${clienteNombre}_${clienteApellido}_${contratoID}.pdf`;

  // Reemplazar espacios por guiones bajos y eliminar guiones dobles
  nombreArchivo = nombreArchivo.replace(/\s+/g, "_").replace(/__+/g, "_");

  // Guardar PDF
  doc.save(nombreArchivo);
}
