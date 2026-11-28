"use client";

import JsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNumber } from "@/components/Formulario";
import { getEmpresaPDF } from "@/Doc/Documentos/funcionesdeDocumentos";
import cafe from "@/img/imagenfrijoles.png";
import tasa from "@/img/tasa.png";
import {
  matricial,
  MATRICIAL,
  logoBlancoNegro,
  numeroALetras,
  processImageToGray,
  getLogoScaled,
} from "@/Doc/Documentos/funcionesdeDocumentos";

export const cleanText = (text) => {
  if (text === null || text === undefined) return "";
  return String(text).replace(/[^a-zA-Z0-9\s.,-]/g, "");
};

export const PDFComprobante = async ({
  tipoComprobante = "COMPROBANTE CONFIRMACION DE VENTA",
  cliente = "Cliente",
  productos = [],
  total = 0,
  observaciones = "N/A",
  comprobanteID = "0000",
  formaPago = "",
  columnStyles = {}, // anchos por columna (opcional): { 0: { cellWidth: 200 } }
  espacioFirma = 80, // espacio entre observaciones y la línea de firma (comprobantes con más filas lo reducen)
  columnas = [
    { title: "Producto", key: "nombre" },
    { title: "Cantidad", key: "cantidad" },
    { title: "Precio", key: "precio" },
    { title: "Total", key: "total" },
  ],
}) => {
  const empresa = await getEmpresaPDF();
  // Impresora matricial (forma continua 9.5 x 5.5 pulg): una sola copia por hoja, Courier en negro, sin fondo ni rejilla
  const mat = matricial(empresa);
  const fuente = mat ? "courier" : "times";
  const peso = mat ? "bold" : "normal";
  const rojo = mat ? [0, 0, 0] : [255, 0, 0];
  const doc = mat ? new JsPDF({ unit: "pt", format: [684, 396], orientation: "landscape" }) : new JsPDF({ unit: "pt", format: "letter" });
  const leftMargin = mat ? MATRICIAL.izquierda : 50;
  const rightMargin = 50;
  const topMargin = 50;
  const pageWidth = mat ? MATRICIAL.ancho : doc.internal.pageSize.getWidth();
  // En matricial la hoja es media carta: las medidas se calculan sobre una carta completa y solo se dibuja la primera copia
  const pageHeight = doc.internal.pageSize.getHeight() * (mat ? 2 : 1);

  const fondoGray = mat ? null : await processImageToGray(empresa.logo, 0.15);
  const logoMat = mat ? await logoBlancoNegro(empresa.logo, 34) : null;

  const fechaObj = new Date();
  const dia = String(fechaObj.getDate()).padStart(2, "0");
  const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
  const anio = fechaObj.getFullYear();
  const fecha = `${dia}/${mes}/${anio}`;

  const scale = mat ? 0.9 : 1.1;
  const logo = await getLogoScaled(tasa.src, 80 * scale, 80 * scale);
  const cafeimg = await getLogoScaled(cafe.src, 80 * scale, 80 * scale);

  const cantidadLetras = numeroALetras(total);

  const drawComprobante = (offsetY = 0) => {
    const imgWidth = pageWidth * 0.6 * scale;
    const imgHeight = pageHeight * 0.45 * scale;
    const imgX = (pageWidth - imgWidth) / 2;
    const imgY = offsetY + pageHeight * 0.05;
    if (logoMat) doc.addImage(logoMat.src, "PNG", leftMargin, 10 + offsetY, logoMat.width, logoMat.height);
    if (fondoGray) doc.addImage(fondoGray, "PNG", imgX, imgY, imgWidth, imgHeight);

    // doc.addImage(
    //   logo.src,
    //   "PNG",
    //   leftMargin,
    //   20 + offsetY,
    //   logo.width,
    //   logo.height,
    // );
    // doc.addImage(
    //   cafeimg.src,
    //   "PNG",
    //   pageWidth - rightMargin - cafeimg.width,
    //   20 + offsetY,
    //   cafeimg.width,
    //   cafeimg.height,
    // );

    // === Encabezado central y datos de contacto ===
    doc.setFont(fuente, "bold");
    doc.setFontSize(16 * scale);
    doc.text(empresa.nombre.toUpperCase(), pageWidth / 2, (mat ? 28 : 50) + offsetY, {
      align: "center",
    });

    // Subtítulo: tipo de comprobante
    doc.setFont(fuente, peso);
    doc.setFontSize(12 * scale);
    doc.text(tipoComprobante, pageWidth / 2, (mat ? 44 : 70) + offsetY, { align: "center" });


    // Productor y comprobante en la misma línea
    let startY = (mat ? 66 : topMargin + 80) + offsetY;
    doc.setFont(fuente, peso);
    const textoProd = "Productor:";
    doc.text(textoProd, leftMargin, startY);
    const anchoProd = doc.getTextWidth(textoProd);
    doc.setTextColor(...rojo);
    doc.text(` ${cliente}`, leftMargin + anchoProd, startY);

    // Comprobante No: a la derecha
    doc.setFontSize(14 * scale);
    const comprobanteTexto = `Comprobante No: ${comprobanteID}`;
    const anchoComp = doc.getTextWidth(comprobanteTexto);
    doc.setTextColor(0, 0, 0);
    doc.text(comprobanteTexto, pageWidth - rightMargin - anchoComp, startY);

    // 🔹 Versión segura de cleanText
    startY += 20;
    // 🔹 Bloque seguro para bodyProductos
    const bodyProductos = productos.map((p) =>
      columnas.map((col) => {
        let value = p[col.key];

        // Si es null o undefined
        if (value === null || value === undefined) value = "";
        // Si es un objeto, tratamos de obtener label o value
        else if (typeof value === "object")
          value = value.label ?? value.value ?? "";

        // Si es precio o total, formateamos como número
        if (col.key === "total" || col.key === "precio") {
          const num = Number(value) || 0;
          value = `L. ${formatNumber(num)}`;
        }

        // Convertimos todo a string antes de limpiar
        const safeText = cleanText(String(value));

        return {
          content: safeText,
          styles: { textColor: rojo },
        };
      }),
    );

    autoTable(doc, {
      startY,
      margin: { left: leftMargin, right: rightMargin },
      head: [columnas.map((c) => c.title)],
      body: bodyProductos,
      columnStyles,
      styles: {
        font: fuente,
        fontStyle: peso,
        fontSize: 10 * scale,
        lineColor: [0, 0, 0],
        lineWidth: mat ? 0 : 0.5,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: mat ? 0 : 0.5,
      },
    });

    startY = doc.lastAutoTable.finalY + 15;

    doc.setFont(fuente, peso);
    const texto = "Cantidad en Letras:";
    const valor = `${cantidadLetras}`;
    doc.text(texto, leftMargin, startY);
    const anchoTexto = doc.getTextWidth(texto);
    doc.setTextColor(...rojo);
    const lineasLetras = doc.splitTextToSize(String(valor), pageWidth - rightMargin - leftMargin - anchoTexto - 5);
    doc.text(lineasLetras, leftMargin + anchoTexto + 5, startY);
    startY += (lineasLetras.length - 1) * doc.getLineHeight();
    doc.setTextColor(0, 0, 0);

    startY += 20;

    doc.text("Forma de Pago:", leftMargin, startY);
    const formas = ["Efectivo", "Transferencia", "Cheque"];
    let x = leftMargin + doc.getTextWidth("Forma de Pago:") + 14; // según el ancho real: con Courier no se encimaban
    const gap = 20; // espacio entre casilla y siguiente texto
    formas.forEach((f) => {
      const rectWidth = 10;
      doc.rect(x, startY - 7, rectWidth, 10); // caja
      if ([].concat(formaPago).includes(f)) doc.text("X", x + 2, startY + 1); // marcar seleccionado
      const textX = x + rectWidth + 5; // espacio entre cuadro y texto
      doc.text(f, textX, startY + 1);
      // mover x al final del texto + un margen
      x = textX + doc.getTextWidth(f) + 20;
    });

    startY += 25;

    doc.setFont(fuente, "bold");
    doc.text("Observaciones:", leftMargin, startY);
    startY += 12;
    doc.setFont(fuente, peso);
    const lineasObs = doc.splitTextToSize(String(observaciones || ""), pageWidth - leftMargin - rightMargin);
    doc.text(lineasObs, leftMargin, startY);
    startY += (lineasObs.length - 1) * doc.getLineHeight();

    startY += mat ? 28 : espacioFirma;

    const firmaWidth = 150;
    // En la matricial las firmas van al pie de la hoja (arriba del pie de página); si el contenido es largo, quedan debajo de él.
    const firmaY = mat ? Math.max(startY, doc.internal.pageSize.getHeight() - 44) : startY;

    doc.line(leftMargin, firmaY, leftMargin + firmaWidth, firmaY);
    doc.text("FIRMA", leftMargin + firmaWidth / 2 - 20, firmaY + 12);

    const lugarX = pageWidth - rightMargin - firmaWidth - 20;
    doc.line(lugarX + 25, firmaY, lugarX + firmaWidth + 25, firmaY);
    doc.text("LUGAR Y FECHA", lugarX + firmaWidth / 2 - 40, firmaY + 12);

    doc.setTextColor(...rojo);
    doc.text(`${empresa.ciudad}  ${fecha}`, lugarX + firmaWidth / 2 - 45, firmaY - 4);
    doc.setTextColor(0, 0, 0);
  };

  drawComprobante(0);
  if (!mat) {
    drawComprobante(pageHeight / 2);

    doc.setLineDash([5, 3]);
    doc.line(40, pageHeight / 2, pageWidth - 40, pageHeight / 2);
    doc.setLineDash();
  }

  const pdfBlob = doc.output("blob");
  const pdfURL = URL.createObjectURL(pdfBlob);

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    const newWindow = window.open(pdfURL, "_blank");
    if (!newWindow) alert("Permite ventanas emergentes para ver el documento.");
  } else {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = pdfURL;
    document.body.appendChild(iframe);
    iframe.onload = function () {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
  }
};
