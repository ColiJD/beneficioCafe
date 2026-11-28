import JsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNumber } from "@/components/Formulario";
import { getEmpresaPDF } from "@/Doc/Documentos/funcionesdeDocumentos";
import frijol from "@/img/imagenfrijoles.png";
import tasa from "@/img/tasa.png";
import {
  matricial,
  MATRICIAL,
  logoBlancoNegro,
  numeroALetras,
  cleanText,
  processImageToGray,
  getLogoScaled,
} from "@/Doc/Documentos/funcionesdeDocumentos";

export const exportEntregaContrato = async (formState) => {
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

  // Fecha actual (Adoptado de compra.js)
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

  const scale = mat ? 0.9 : 1.1;
  const logo = await getLogoScaled(tasa.src, 80 * scale, 80 * scale);
  const frijolimg = await getLogoScaled(frijol.src, 80 * scale, 80 * scale);

  const cliente = formState?.cliente?.label || "Cliente";
  const contratoID = formState?.contratoID || "0000";
  const comprobanteID = formState?.comprobanteID || "0000";
  const tipoCafe = formState?.tipoCafe || "Tipo de Café";
  const quintalesIngresados = formState?.quintalesIngresados || 0;
  const precio = formState?.precio || 0;
  const totalPagar = formState?.totalPagar || 0;
  const formaPago = formState?.formaPago || "";
  const observaciones = formState?.observaciones || "N/A";

  const numeroALetrasExtendido = (num) => {
    const entero = Math.floor(num);
    const centavos = Math.round((num - entero) * 100);
    let letrasEntero = numeroALetras(entero)
      .replace(/lempiras?/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    const letrasCentavos =
      centavos > 0
        ? numeroALetras(centavos)
            .replace(/lempiras?/gi, "")
            .replace(/\s+/g, " ")
            .trim()
        : "";
    return centavos > 0
      ? `${letrasEntero} lempiras con ${letrasCentavos} centavos`
      : `${letrasEntero} lempiras exactos`;
  };

  const cantidadLetras = numeroALetrasExtendido(totalPagar);

  // FUNCIÓN PRINCIPAL DE DIBUJO (Alineada con compra.js)
  const drawComprobante = (offsetY = 0) => {
    // Fondo
    const imgWidth = pageWidth * 0.6 * scale;
    const imgHeight = pageHeight * 0.45 * scale;
    const imgX = (pageWidth - imgWidth) / 2;
    const imgY = offsetY + pageHeight * 0.05;
    if (logoMat) doc.addImage(logoMat.src, "PNG", leftMargin, 10 + offsetY, logoMat.width, logoMat.height);
    if (fondoGray) doc.addImage(fondoGray, "PNG", imgX, imgY, imgWidth, imgHeight);

    // Cosecha
    doc.setFont(fuente, peso);
    doc.setFontSize(11 * scale);
    doc.setTextColor(0, 0, 0);
    doc.text(empresa.cosecha ? `Cosecha ${empresa.cosecha.nombre}` : "", leftMargin, (mat ? 66 : topMargin + 80) + offsetY - 18);

    // Encabezado central
    doc.setFont(fuente, "bold");
    doc.setFontSize(16 * scale);
    doc.text(empresa.nombre.toUpperCase(), pageWidth / 2, (mat ? 28 : 50) + offsetY, {
      align: "center",
    });

    doc.setFont(fuente, peso);
    doc.setFontSize(12 * scale);
    doc.text("ENTREGA DE CONTRATO", pageWidth / 2, (mat ? 44 : 70) + offsetY, {
      align: "center",
    });

    // Productor y Comprobante en la misma línea
    let startY = (mat ? 66 : topMargin + 80) + offsetY;
    doc.setFont(fuente, peso);

    const textoProd = "Productor:";
    doc.text(textoProd, leftMargin, startY);

    const anchoProd = doc.getTextWidth(textoProd);
    doc.setTextColor(...rojo);
    doc.text(` ${cliente}`, leftMargin + anchoProd, startY);

    doc.setFontSize(14 * scale);
    const comprobanteTexto = `Comprobante No: ${comprobanteID}`;
    const anchoComp = doc.getTextWidth(comprobanteTexto);
    doc.text(comprobanteTexto, pageWidth - rightMargin - anchoComp, startY);
    doc.setTextColor(0, 0, 0);

    startY += 20;

    // Tabla de productos (Alineada con los estilos de compra.js)
    autoTable(doc, {
      startY,
      margin: { left: leftMargin, right: rightMargin },
      head: [
        [
          "Contrato",
          "Tipo Café",
          "Quintales Ingresados",
          "Precio (Lps)",
          "Total a Pagar (Lps)",
        ],
      ],
      body: [
        [
          {
            content: cleanText(contratoID),
            styles: { textColor: rojo },
          },
          { content: cleanText(tipoCafe), styles: { textColor: rojo } },
          {
            content: formatNumber(quintalesIngresados),
            styles: { textColor: rojo },
          },
          {
            content: `L. ${formatNumber(precio)}`,
            styles: { textColor: rojo },
          },
          {
            content: `L. ${formatNumber(totalPagar)}`,
            styles: { textColor: rojo },
          },
        ],
      ],
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
    const texto = "Total en Letras:";
    const valor = `${cantidadLetras}`;
    doc.text(texto, leftMargin, startY);
    const anchoTexto = doc.getTextWidth(texto);
    doc.setTextColor(...rojo);
    const lineasLetras = doc.splitTextToSize(String(valor), pageWidth - rightMargin - leftMargin - anchoTexto - 5);
    doc.text(lineasLetras, leftMargin + anchoTexto + 5, startY);
    startY += (lineasLetras.length - 1) * doc.getLineHeight();
    doc.setTextColor(0, 0, 0);

    startY += 20;

    // Forma de pago (Alineada con compra.js)
    doc.text("Forma de Pago:", leftMargin, startY);
    const formas = ["Efectivo", "Transferencia", "Cheque"];
    let x = leftMargin + doc.getTextWidth("Forma de Pago:") + 14; // según el ancho real: con Courier no se encimaban
    formas.forEach((f) => {
      doc.rect(x, startY - 7, 10, 10);
      if (formaPago === f) doc.text("X", x + 2, startY + 1);
      doc.text(f, x + 15, startY + 1);
      x += 17 + doc.getTextWidth(f) + 22;
    });

    startY += 25;

    doc.setFont(fuente, "bold");
    doc.text("Observaciones:", leftMargin, startY);
    startY += 12;
    doc.setFont(fuente, peso);
    const lineasObs = doc.splitTextToSize(String(observaciones || ""), pageWidth - leftMargin - rightMargin);
    doc.text(lineasObs, leftMargin, startY);
    startY += (lineasObs.length - 1) * doc.getLineHeight();

    startY += mat ? 28 : 80;

    // Firmas y lugar/fecha (Alineada con compra.js)
    const firmaWidth = 150;
    // En la matricial las firmas van al pie de la hoja (arriba del pie de página); si el contenido es largo, quedan debajo de él.
    const firmaY = mat ? Math.max(startY, doc.internal.pageSize.getHeight() - 44) : startY;

    // Línea de firma (izquierda)
    doc.line(leftMargin, firmaY, leftMargin + firmaWidth, firmaY);
    doc.text("FIRMA", leftMargin + firmaWidth / 2 - 20, firmaY + 12);

    // Línea de lugar y fecha
    const lugarX = pageWidth - rightMargin - firmaWidth - 20;
    doc.line(lugarX + 25, firmaY, lugarX + firmaWidth + 25, firmaY);

    // Texto “LUGAR Y FECHA”
    doc.text("LUGAR Y FECHA", lugarX + firmaWidth / 2 - 40, firmaY + 12);

    doc.setFont(fuente, peso);
    doc.setTextColor(...rojo);
    doc.text(`${empresa.ciudad}  ${fecha}`, lugarX + firmaWidth / 2 - 45, firmaY - 4);
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(8 * scale);
    doc.text(
      `${empresa.nombre} - ${empresa.ciudad}, ${empresa.pais}`,
      pageWidth / 2,
      mat ? doc.internal.pageSize.getHeight() - 14 : offsetY + pageHeight * 0.45,
      { align: "center" },
    );
  };

  // === GENERACIÓN DE DOCUMENTO ===
  drawComprobante(0);
  if (!mat) {
    drawComprobante(pageHeight / 2);

    doc.setLineDash([5, 3]);
    doc.line(40, pageHeight / 2, pageWidth - 40, pageHeight / 2);
    doc.setLineDash();
  }

  const nombreArchivo = `EntregaContrato_${cliente.replace(
    /\s+/g,
    "_",
  )}_${comprobanteID}.pdf`;
  const pdfBlob = doc.output("blob");
  const pdfURL = URL.createObjectURL(pdfBlob);

  // Detección básica de dispositivo móvil
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    const newWindow = window.open(pdfURL, "_blank");
    if (!newWindow) {
      alert(
        "Por favor permite las ventanas emergentes para poder ver el documento.",
      );
    }
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
