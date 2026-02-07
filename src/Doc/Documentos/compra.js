import JsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNumber } from "@/components/Formulario";
import fondoImg from "@/img/frijoles.png";
import cafe from "@/img/imagenfrijoles.png";
import sello from "@/img/logo_transparente.png";
import tasa from "@/img/tasa.png";
import {
  numeroALetras,
  cleanText,
  processImageToGray,
  getLogoScaled,
} from "@/Doc/Documentos/funcionesdeDocumentos";

export const exportCompraDirecta = async (formState) => {
  const doc = new JsPDF({ unit: "pt", format: "letter" });
  const leftMargin = 50;
  const rightMargin = 50;
  const topMargin = 50;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const fondoGray = await processImageToGray(fondoImg.src, 0.15);

  // Fecha actual
  let fechaObj;
  if (formState?.fecha) {
    const partes = formState.fecha.split("-"); // "YYYY-MM-DD"
    const year = parseInt(partes[0], 10);
    const month = parseInt(partes[1], 10) - 1; // mes 0-11
    const day = parseInt(partes[2], 10);
    fechaObj = new Date(year, month, day); // evita desfase de zona horaria
  } else {
    fechaObj = new Date();
  }
  const dia = String(fechaObj.getDate()).padStart(2, "0");
  const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
  const anio = fechaObj.getFullYear();
  const fecha = `${dia}/${mes}/${anio}`;

  const scale = 1.1;
  const logo = await getLogoScaled(tasa.src, 80 * scale, 80 * scale);
  const cafeimg = await getLogoScaled(cafe.src, 80 * scale, 80 * scale);
  const selloimg = await getLogoScaled(sello.src, 50 * scale, 50 * scale);

  const cliente = formState?.cliente?.label || "Cliente";
  const productos = formState?.productos || [];
  const observaciones = formState?.observaciones || "N/A";
  const comprobanteID = formState?.comprobanteID || "0000";
  const cantidadLetras = numeroALetras(formState?.total || 0);
  const formaPago = formState?.formaPago || "";

  // FUNCIÓN PRINCIPAL DE DIBUJO
  const drawComprobante = (offsetY = 0) => {
    // Fondo
    const imgWidth = pageWidth * 0.9 * scale;
    const imgHeight = pageHeight * 0.45 * scale;
    const imgX = (pageWidth - imgWidth) / 2;
    const imgY = offsetY + pageHeight * 0.05;
    doc.addImage(fondoGray, "PNG", imgX, imgY, imgWidth, imgHeight);

    // Logo izquierda
    doc.addImage(
      logo.src,
      "PNG",
      leftMargin,
      20 + offsetY,
      logo.width,
      logo.height
    );

    // logo derecha
    const cafeY = 20 + offsetY;
    doc.addImage(
      cafeimg.src,
      "PNG",
      pageWidth - rightMargin - cafeimg.width,
      cafeY,
      cafeimg.width,
      cafeimg.height
    );

    //  Cosecha
    doc.setFont("times", "normal");
    doc.setFontSize(11 * scale);
    doc.setTextColor(0, 0, 0);

    doc.text("Cosecha 2025 - 2026", leftMargin, topMargin + 80 + offsetY - 18);

    //Encabezado central
    doc.setFont("times", "bold");
    doc.setFontSize(16 * scale);
    doc.text("BENEFICIO CAFÉ HENOLA", pageWidth / 2, 50 + offsetY, {
      align: "center",
    });

    doc.setFont("times", "normal");
    doc.setFontSize(12 * scale);
    doc.text("COMPROBANTE DE COMPRA DIRECTA", pageWidth / 2, 70 + offsetY, {
      align: "center",
    });
    doc.text("Propietario Enri Lagos", pageWidth / 2, 85 + offsetY, {
      align: "center",
    });
    doc.text(
      "Teléfono: (504) 3271-3188, (504) 9877-8789",
      pageWidth / 2,
      100 + offsetY,
      { align: "center" }
    );

    // Productor y Comprobante en la misma línea
    let startY = topMargin + 80 + offsetY;
    doc.setFont("times", "normal");

    const textoProd = "Productor:";
    doc.text(textoProd, leftMargin, startY);

    const anchoProd = doc.getTextWidth(textoProd);
    doc.setTextColor(255, 0, 0);
    doc.text(` ${cliente}`, leftMargin + anchoProd, startY);

    doc.setFontSize(14 * scale);
    const comprobanteTexto = `Comprobante No: ${comprobanteID}`;
    const anchoComp = doc.getTextWidth(comprobanteTexto);
    doc.text(comprobanteTexto, pageWidth - rightMargin - anchoComp, startY);
    doc.setTextColor(0, 0, 0);

    startY += 20;

    //Tabla de productos
    const bodyProductos = productos.map((p) => [
      { content: cleanText(p.nombre), styles: { textColor: [255, 0, 0] } },
      { content: formatNumber(p.cantidad), styles: { textColor: [255, 0, 0] } },
      {
        content: `L. ${formatNumber(p.precio)}`,
        styles: { textColor: [255, 0, 0] },
      },
      {
        content: `L. ${formatNumber(p.total)}`,
        styles: { textColor: [255, 0, 0] },
      },
    ]);

    autoTable(doc, {
      startY,
      margin: { left: leftMargin, right: rightMargin },
      head: [["Producto", "Cantidad (QQ)", "Precio (LPS)", "Total (LPS)"]],
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

    // Forma de pago
    doc.text("Forma de Pago:", leftMargin, startY);
    const formas = ["Efectivo", "Transferencia", "Cheque"];
    let x = leftMargin + 100;
    formas.forEach((f) => {
      doc.rect(x, startY - 7, 10, 10);
      if (formaPago === f) doc.text("X", x + 2, startY + 1);
      doc.text(f, x + 15, startY + 1);
      x += 100;
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

    // Firmas y lugar/fecha
    const firmaWidth = 150;
    const firmaY = startY;

    // Línea de firma (izquierda)
    doc.line(leftMargin, firmaY, leftMargin + firmaWidth, firmaY);
    doc.text("FIRMA", leftMargin + firmaWidth / 2 - 20, firmaY + 12);

    // Línea de lugar y fecha
    const lugarX = pageWidth - rightMargin - firmaWidth - 20;
    doc.line(lugarX + 25, firmaY, lugarX + firmaWidth + 25, firmaY);

    // Texto “LUGAR Y FECHA”
    doc.text("LUGAR Y FECHA", lugarX + firmaWidth / 2 - 40, firmaY + 12);

    doc.setFont("times", "normal");
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

    doc.setFontSize(8 * scale);
    doc.text(
      "Beneficio Café Henola - El Paraíso, Honduras",
      pageWidth / 2,
      offsetY + pageHeight * 0.45,
      { align: "center" }
    );
  };

  // === GENERACIÓN DE DOCUMENTO ===
  drawComprobante(0);
  drawComprobante(pageHeight / 2);

  doc.setLineDash([5, 3]);
  doc.line(40, pageHeight / 2, pageWidth - 40, pageHeight / 2);
  doc.setLineDash();

  const nombreArchivo = `CompraDirecta_${cliente.replace(
    /\s+/g,
    "_"
  )}_${comprobanteID}.pdf`;
  const pdfBlob = doc.output("blob");
  const pdfURL = URL.createObjectURL(pdfBlob);

  // Detección básica de dispositivo móvil
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // 📱 En móvil: abrir PDF visible (el usuario imprime desde el visor)
    const newWindow = window.open(pdfURL, "_blank");
    if (!newWindow) {
      alert(
        "Por favor permite las ventanas emergentes para poder ver el documento."
      );
    }
  } else {
    // 💻 En escritorio: imprimir directamente
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
