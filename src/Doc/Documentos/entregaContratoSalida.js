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
  processImageToGray,
  getLogoScaled,
} from "@/Doc/Documentos/funcionesdeDocumentos";

export const exportEntregaContratoSalida = async (formState) => {
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

  const fechaInput = formState?.fecha ? new Date(formState.fecha) : new Date();
  const fechaCorta = `${String(fechaInput.getDate()).padStart(2, "0")}/${String(
    fechaInput.getMonth() + 1,
  ).padStart(2, "0")}/${fechaInput.getFullYear()}`;

  // ---------- Un solo tamaño----------
  const scale = mat ? 0.9 : 1.1;
  const FS_H1 = 16 * scale;
  const FS_BODY = 11 * scale;
  const FS_SMALL = 9 * scale;

  const fondoGray = mat ? null : await processImageToGray(empresa.logo, 0.15);
  const logoMat = mat ? await logoBlancoNegro(empresa.logo, 34) : null;
  const logo = await getLogoScaled(tasa.src, 80 * scale, 80 * scale);
  const frijolimg = await getLogoScaled(frijol.src, 80 * scale, 80 * scale);

  const cliente =
    formState?.cliente?.label || formState?.comprador?.label || "Comprador";
  const contratoID = formState?.contratoID || "0000";
  const comprobanteID = formState?.comprobanteID || "0000";
  const tipoCafe = formState?.tipoCafe || "Tipo de Café";
  const quintalesIngresados = formState?.quintalesIngresados || 0; // In this context, it's delivered/sent
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

  const drawComprobante = (offsetY = 0) => {
    // Fondo
    const imgWidth = pageWidth * 0.6 * scale;
    const imgHeight = pageHeight * 0.45 * scale;
    const imgX = (pageWidth - imgWidth) / 2;
    const imgY = offsetY + pageHeight * 0.05;
    if (logoMat) doc.addImage(logoMat.src, "PNG", leftMargin, 10 + offsetY, logoMat.width, logoMat.height);
    if (fondoGray) doc.addImage(fondoGray, "PNG", imgX, imgY, imgWidth, imgHeight);

    // // Logos
    // doc.addImage(
    //   logo.src,
    //   "PNG",
    //   leftMargin,
    //   20 + offsetY,
    //   logo.width,
    //   logo.height,
    // );
    // const frijolY = 20 + offsetY;
    // doc.addImage(
    //   frijolimg.src,
    //   "PNG",
    //   pageWidth - rightMargin - frijolimg.width,
    //   frijolY,
    //   frijolimg.width,
    //   frijolimg.height,
    // );

    // Encabezado
    doc.setFont(fuente, "bold");
    doc.setFontSize(FS_H1);
    doc.text(empresa.nombre.toUpperCase(), pageWidth / 2, (mat ? 28 : 50) + offsetY, {
      align: "center",
    });

    doc.setFont(fuente, peso);
    doc.setFontSize(FS_BODY);
    doc.text("ENTREGA DE VENTA DE CAFÉ", pageWidth / 2, (mat ? 44 : 70) + offsetY, {
      align: "center",
    });

    // Cosecha
    doc.setFont(fuente, "bold");
    doc.setFontSize(FS_BODY);
    doc.text(empresa.cosecha ? `Cosecha ${empresa.cosecha.nombre}` : "", leftMargin, (mat ? 48 : topMargin + 60) + offsetY);

    // Comprador
    doc.setFont(fuente, peso);
    doc.setFontSize(FS_BODY);
    const yProd = (mat ? 66 : topMargin + 80) + offsetY;
    const labelProd = "Comprador:";
    doc.text(labelProd, leftMargin, yProd);
    const wLabelProd = doc.getTextWidth(labelProd);
    doc.setTextColor(...rojo);
    doc.text(` ${cliente}`, leftMargin + wLabelProd, yProd);
    doc.setTextColor(0, 0, 0);

    // Comprobante No
    let compX = pageWidth - rightMargin - 140;
    // const compY = frijolY + frijolimg.height + 18;
    doc.setFont(fuente, "bold");
    doc.setFontSize(FS_BODY);
    const wComp = doc.getTextWidth("Comprobante No:") + 5;
    if (mat) compX = pageWidth - rightMargin - wComp - doc.getTextWidth(String(comprobanteID));
    doc.text("Comprobante No:", compX, yProd);
    doc.setTextColor(...rojo);
    doc.text(`${comprobanteID}`, compX + (mat ? wComp : 125), yProd);
    doc.setTextColor(0, 0, 0);

    // Tabla
    let startY = (mat ? 80 : topMargin + 110) + offsetY;
    autoTable(doc, {
      startY,
      margin: { left: leftMargin, right: rightMargin },
      head: [
        [
          "Contrato",
          "Tipo Café",
          "Quintales Entregados",
          "Precio (Lps)",
          "Total (Lps)",
        ],
      ],
      body: [
        [
          { content: contratoID, styles: { textColor: rojo } },
          { content: tipoCafe, styles: { textColor: rojo } },
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
        fontSize: 9 * scale,
        lineColor: [0, 0, 0],
        lineWidth: mat ? 0 : 0.5,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
      },
    });

    startY = doc.lastAutoTable.finalY + 30;

    // Total en letras
    doc.setFont(fuente, "bold");
    doc.setFontSize(FS_BODY);
    doc.text("Total en Letras:", leftMargin, startY);
    doc.setFont(fuente, peso);
    doc.setFontSize(FS_BODY);
    doc.setTextColor(...rojo);
    const maxWidth = pageWidth - leftMargin - rightMargin - 150;
    const textoEnLetras = doc.splitTextToSize(cantidadLetras, maxWidth);
    doc.text(textoEnLetras, leftMargin + 115, startY);
    const lineCount = textoEnLetras.length;
    startY += 20 + lineCount * 12;
    doc.setTextColor(0, 0, 0);

    // Observaciones
    doc.setFont(fuente, "bold");
    doc.setFontSize(FS_BODY);
    doc.text("Observaciones:", leftMargin, startY);
    startY += 15;
    doc.setFont(fuente, peso);
    doc.setFontSize(FS_BODY);
    const lineasObs = doc.splitTextToSize(String(observaciones || ""), pageWidth - leftMargin - rightMargin);
    doc.text(lineasObs, leftMargin, startY);
    startY += (lineasObs.length - 1) * doc.getLineHeight();

    // ======== BLOQUE DE FIRMAS ========
    const mitadAltura = pageHeight / 2;
    const firmaBase = offsetY + mitadAltura - 25;
    const firmaWidth = 150;
    const firmaY = firmaBase - 8;

    doc.setFont(fuente, "bold");
    doc.setFontSize(FS_BODY);
    doc.line(leftMargin, firmaY, leftMargin + firmaWidth, firmaY);
    doc.text("ENTREGADO POR", leftMargin + 35, firmaY + 14); // Henola delivers

    doc.line(
      pageWidth - rightMargin - firmaWidth,
      firmaY,
      pageWidth - rightMargin,
      firmaY,
    );
    doc.text("RECIBIDO POR", pageWidth - rightMargin - 120, firmaY + 14); // Buyer receives

    doc.setFont(fuente, peso);
    doc.setFontSize(FS_SMALL);
    doc.text(
      `${empresa.nombre} - ${empresa.ciudad}, ${empresa.pais}`,
      pageWidth / 2,
      firmaY + 12,
      { align: "center" },
    );

    // Fecha roja
    doc.setFont(fuente, "bold");
    doc.setFontSize(14);
    doc.setTextColor(...rojo);
    doc.text(`${empresa.ciudad} ${fechaCorta}`, pageWidth / 2 + 120, firmaY - 6);
    doc.setTextColor(0, 0, 0);
  };

  // Doble comprobante (arriba y abajo)
  drawComprobante(0);
  if (!mat) {
    drawComprobante(pageHeight / 2);

    // Línea de corte
    doc.setLineDash([5, 3]);
    doc.line(40, pageHeight / 2, pageWidth - 40, pageHeight / 2);
    doc.setLineDash();
  }

  const nombreArchivo = `EntregaVenta_${cliente.replace(
    /\s+/g,
    "_",
  )}_${comprobanteID}.pdf`;
  const pdfBlob = doc.output("blob");
  const pdfURL = URL.createObjectURL(pdfBlob);

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
