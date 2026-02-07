"use client";

import JsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNumber } from "@/components/Formulario";
import fondoImg from "@/img/frijoles.png";
import cafe from "@/img/imagenfrijoles.png";
import sello from "@/img/logo_transparente.png";
import tasa from "@/img/tasa.png";
import {
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
  columnas = [
    { title: "Producto", key: "nombre" },
    { title: "Cantidad", key: "cantidad" },
    { title: "Precio", key: "precio" },
    { title: "Total", key: "total" },
  ],
}) => {
  const doc = new JsPDF({ unit: "pt", format: "letter" });
  const leftMargin = 50;
  const rightMargin = 50;
  const topMargin = 50;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const fondoGray = await processImageToGray(fondoImg.src, 0.15);

  const fechaObj = new Date();
  const dia = String(fechaObj.getDate()).padStart(2, "0");
  const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
  const anio = fechaObj.getFullYear();
  const fecha = `${dia}/${mes}/${anio}`;

  const scale = 1.1;
  const logo = await getLogoScaled(tasa.src, 80 * scale, 80 * scale);
  const cafeimg = await getLogoScaled(cafe.src, 80 * scale, 80 * scale);
  const selloimg = await getLogoScaled(sello.src, 50 * scale, 50 * scale);

  const cantidadLetras = numeroALetras(total);

  const drawComprobante = (offsetY = 0) => {
    const imgWidth = pageWidth * 0.9 * scale;
    const imgHeight = pageHeight * 0.45 * scale;
    const imgX = (pageWidth - imgWidth) / 2;
    const imgY = offsetY + pageHeight * 0.05;
    doc.addImage(fondoGray, "PNG", imgX, imgY, imgWidth, imgHeight);

    doc.addImage(
      logo.src,
      "PNG",
      leftMargin,
      20 + offsetY,
      logo.width,
      logo.height
    );
    doc.addImage(
      cafeimg.src,
      "PNG",
      pageWidth - rightMargin - cafeimg.width,
      20 + offsetY,
      cafeimg.width,
      cafeimg.height
    );

    // === Encabezado central y datos de contacto ===
    doc.setFont("times", "bold");
    doc.setFontSize(16 * scale);
    doc.text("BENEFICIO CAFÉ HENOLA", pageWidth / 2, 50 + offsetY, {
      align: "center",
    });

    // Subtítulo: tipo de comprobante
    doc.setFont("times", "normal");
    doc.setFontSize(12 * scale);
    doc.text(tipoComprobante, pageWidth / 2, 70 + offsetY, { align: "center" });

    // Propietario y contacto
    doc.setFontSize(12 * scale);
    doc.text("Propietario Enri Lagos", pageWidth / 2, 85 + offsetY, {
      align: "center",
    });
    doc.text(
      "Teléfono: (504) 3271-3188, (504) 9877-8789",
      pageWidth / 2,
      100 + offsetY,
      { align: "center" }
    );

    // Productor y comprobante en la misma línea
    let startY = topMargin + 80 + offsetY;
    doc.setFont("times", "normal");
    const textoProd = "Productor:";
    doc.text(textoProd, leftMargin, startY);
    const anchoProd = doc.getTextWidth(textoProd);
    doc.setTextColor(255, 0, 0);
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
          styles: { textColor: [255, 0, 0] },
        };
      })
    );

    autoTable(doc, {
      startY,
      margin: { left: leftMargin, right: rightMargin },
      head: [columnas.map((c) => c.title)],
      body: bodyProductos,
      styles: {
        font: "times",
        fontSize: 10 * scale,
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
      },
    });

    startY = doc.lastAutoTable.finalY + 15;

    doc.setFont("times", "normal");
    const texto = "Cantidad en Letras:";
    const valor = `${cantidadLetras}`;
    doc.text(texto, leftMargin, startY);
    const anchoTexto = doc.getTextWidth(texto);
    doc.setTextColor(255, 0, 0);
    doc.text(valor, leftMargin + anchoTexto + 5, startY);
    doc.setTextColor(0, 0, 0);

    startY += 20;

    doc.text("Forma de Pago:", leftMargin, startY);
    const formas = ["Efectivo", "Transferencia", "Cheque"];
    let x = leftMargin + 100;
    const gap = 20; // espacio entre casilla y siguiente texto
    formas.forEach((f) => {
      const rectWidth = 10;
      doc.rect(x, startY - 7, rectWidth, 10); // caja
      if (formaPago === f) doc.text("X", x + 2, startY + 1); // marcar seleccionado
      const textX = x + rectWidth + 5; // espacio entre cuadro y texto
      doc.text(f, textX, startY + 1);
      // mover x al final del texto + un margen
      x = textX + doc.getTextWidth(f) + 20;
    });

    startY += 25;

    doc.setFont("times", "bold");
    doc.text("Observaciones:", leftMargin, startY);
    startY += 12;
    doc.setFont("times", "normal");
    doc.text(String(observaciones || ""), leftMargin, startY, {
      maxWidth: pageWidth - leftMargin - rightMargin,
    });

    startY += 80;

    const firmaWidth = 150;
    const firmaY = startY;

    doc.line(leftMargin, firmaY, leftMargin + firmaWidth, firmaY);
    doc.text("FIRMA", leftMargin + firmaWidth / 2 - 20, firmaY + 12);

    const lugarX = pageWidth - rightMargin - firmaWidth - 20;
    doc.line(lugarX + 25, firmaY, lugarX + firmaWidth + 25, firmaY);
    doc.text("LUGAR Y FECHA", lugarX + firmaWidth / 2 - 40, firmaY + 12);

    doc.setTextColor(255, 0, 0);
    doc.text(`El Paraíso  ${fecha}`, lugarX + firmaWidth / 2 - 45, firmaY - 4);
    doc.setTextColor(0, 0, 0);

    doc.addImage(
      selloimg.src,
      "PNG",
      leftMargin + firmaWidth / 2 - selloimg.width / 2,
      firmaY - selloimg.height - 5,
      selloimg.width,
      selloimg.height
    );
  };

  drawComprobante(0);
  drawComprobante(pageHeight / 2);

  doc.setLineDash([5, 3]);
  doc.line(40, pageHeight / 2, pageWidth - 40, pageHeight / 2);
  doc.setLineDash();

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
