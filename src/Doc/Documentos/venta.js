import JsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNumber } from "@/components/Formulario";
import { getEmpresaPDF } from "@/Doc/Documentos/funcionesdeDocumentos";
import frijol from "@/img/imagenfrijoles.png";
import tasa from "@/img/tasa.png";
import {
  matricial,
  logoBlancoNegro,
  numeroALetras,
  cleanText,
  processImageToGray,
  getLogoScaled,
} from "@/Doc/Documentos/funcionesdeDocumentos";

export const exportVentaDirecta = async (formState) => {
  const empresa = await getEmpresaPDF();
  // Impresora matricial (forma continua 9.5 x 5.5 pulg): una sola copia por hoja, Courier en negro, sin fondo ni rejilla
  const mat = matricial(empresa);
  const fuente = mat ? "courier" : "times";
  const peso = mat ? "bold" : "normal";
  const rojo = mat ? [0, 0, 0] : [255, 0, 0];
  const doc = mat ? new JsPDF({ unit: "pt", format: [684, 396], orientation: "landscape" }) : new JsPDF({ unit: "pt", format: "letter" });
  const leftMargin = 50;
  const rightMargin = 50;
  const topMargin = 50;
  const pageWidth = doc.internal.pageSize.getWidth();
  // En matricial la hoja es media carta: las medidas se calculan sobre una carta completa y solo se dibuja la primera copia
  const pageHeight = doc.internal.pageSize.getHeight() * (mat ? 2 : 1);

  const fondoGray = mat ? null : await processImageToGray(empresa.logo, 0.15);
  const logoMat = mat ? await logoBlancoNegro(empresa.logo, 34) : null;

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

  const comprador = formState?.comprador?.label || "Comprador";
  const productos = formState?.productos || [];
  const observaciones = formState?.observaciones || "N/A";
  const comprobanteID = formState?.comprobanteID || "0000";
  const formaPago = formState?.formaPago || "";

  // evita repetir "lempiras" y muestra centavos correctamente
  const numeroALetrasExtendido = (num) => {
    const entero = Math.floor(num);
    const centavos = Math.round((num - entero) * 100);

    // convierte número a letras y elimina "lempiras" si la función base ya la añade
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

    if (centavos > 0) {
      return `${letrasEntero} lempiras con ${letrasCentavos} centavos`;
    } else {
      return `${letrasEntero} lempiras exactos`;
    }
  };

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
    //   logo.height
    // );

    // const frijolY = 20 + offsetY;
    // doc.addImage(
    //   frijolimg.src,
    //   "PNG",
    //   pageWidth - rightMargin - frijolimg.width,
    //   frijolY,
    //   frijolimg.width,
    //   frijolimg.height
    // );

    doc.setFont(fuente, peso);
    doc.setFontSize(11 * scale);
    doc.setTextColor(0, 0, 0);
    doc.text(
      empresa.cosecha ? `Cosecha ${empresa.cosecha.nombre}` : "",
      leftMargin + logo.width / 30,
      20 + logo.height + offsetY + 22,
    );

    doc.setFont(fuente, "bold");
    doc.setFontSize(16 * scale);
    doc.text(empresa.nombre.toUpperCase(), pageWidth / 2, 50 + offsetY, {
      align: "center",
    });

    doc.setFont(fuente, peso);
    doc.setFontSize(12 * scale);
    doc.text("COMPROBANTE DE VENTA DIRECTA", pageWidth / 2, 70 + offsetY, {
      align: "center",
    });

    let startY = topMargin + 80 + offsetY;
    doc.setFont(fuente, "bold");
    doc.setFontSize(12 * scale);
    doc.setTextColor(0, 0, 0);

    const textoComprador = "Comprador:";
    doc.text(textoComprador, leftMargin, startY);
    const anchoComprador = doc.getTextWidth(textoComprador);

    doc.setTextColor(...rojo);
    doc.text(` ${comprador}`, leftMargin + anchoComprador, startY);

    doc.setFont(fuente, "bold");
    doc.setFontSize(14 * scale);
    const textoBase = "Comprobante No:";
    const anchoTextoBase = doc.getTextWidth(textoBase);

    doc.setTextColor(0, 0, 0);
    doc.text(textoBase, pageWidth - rightMargin - 120, startY);

    doc.setTextColor(...rojo);
    doc.text(
      `${comprobanteID}`,
      pageWidth - rightMargin - 120 + anchoTextoBase + 5,
      startY,
    );

    doc.setTextColor(0, 0, 0);

    startY += 25;

    const bodyProductos = productos.map((p) => [
      { content: cleanText(p.nombre), styles: { textColor: rojo } },
      { content: formatNumber(p.cantidad), styles: { textColor: rojo } },
      {
        content: `L. ${formatNumber(p.precio)}`,
        styles: { textColor: rojo },
      },
      {
        content: `L. ${formatNumber(p.total)}`,
        styles: { textColor: rojo },
      },
    ]);

    autoTable(doc, {
      startY,
      margin: { left: leftMargin, right: rightMargin },
      head: [["Producto", "Cantidad (QQ)", "Precio (LPS)", "Total (LPS)"]],
      body: bodyProductos,
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

    // cantidad en letras con salto automático y sin repetir “lempiras”
    doc.setFont(fuente, peso);
    const texto = "Cantidad en Letras:";
    const valor = numeroALetrasExtendido(formState?.total || 0);
    const maxWidth = pageWidth - leftMargin - rightMargin;

    doc.setTextColor(0, 0, 0);
    doc.text(texto, leftMargin, startY);

    doc.setTextColor(...rojo);
    const lineHeight = 14;
    const lines = doc.splitTextToSize(valor, maxWidth - 80);
    doc.text(lines, leftMargin + doc.getTextWidth(texto) + 5, startY);
    doc.setTextColor(0, 0, 0);

    startY += lines.length * lineHeight + 5;

    // forma de pago alineada
    doc.text("Forma de Pago:", leftMargin, startY);
    const formas = ["Efectivo", "Transferencia", "Cheque"];
    let x = leftMargin + doc.getTextWidth("Forma de Pago:") + 14; // según el ancho real: con Courier no se encimaban
    formas.forEach((f) => {
      const boxY = startY - 8;
      doc.rect(x, boxY, 10, 10);
      if (formaPago === f) doc.text("X", x + 2.5, startY);
      doc.text(f, x + 17, startY);
      x += 17 + doc.getTextWidth(f) + 22;
    });

    startY += 25;

    doc.setFont(fuente, peso);
    doc.text("Observaciones:", leftMargin, startY);
    startY += 14;
    doc.setFont(fuente, peso);
    const lineasObs = doc.splitTextToSize(String(observaciones || ""), pageWidth - leftMargin - rightMargin);
    doc.text(lineasObs, leftMargin, startY);
    startY += (lineasObs.length - 1) * doc.getLineHeight();

    startY += 80;

    const firmaWidth = 150;
    const firmaY = startY;
    doc.line(leftMargin, firmaY, leftMargin + firmaWidth, firmaY);
    doc.text("FIRMA", leftMargin + firmaWidth / 2 - 20, firmaY + 12);

    doc.line(
      pageWidth - rightMargin - firmaWidth + 25 - 20,
      firmaY,
      pageWidth - rightMargin + 25 - 20,
      firmaY,
    );
    doc.text(
      "LUGAR Y FECHA",
      pageWidth - rightMargin - firmaWidth / 2 - 50,
      firmaY + 12,
    );

    doc.setFont(fuente, peso);
    doc.setTextColor(...rojo);
    doc.text(
      `${empresa.ciudad}  ${fecha}`,
      pageWidth - rightMargin - firmaWidth / 2 - 60,
      firmaY - 4,
    );
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(8 * scale);
    doc.text(
      `${empresa.nombre} - ${empresa.ciudad}, ${empresa.pais}`,
      pageWidth / 2,
      offsetY + pageHeight * 0.45,
      { align: "center" },
    );
  };

  drawComprobante(0);
  if (!mat) {
    drawComprobante(pageHeight / 2);

    doc.setLineDash([5, 3]);
    doc.line(40, pageHeight / 2, pageWidth - 40, pageHeight / 2);
    doc.setLineDash();
  }

  const nombreArchivo = `VentaDirecta_${comprador.replace(
    /\s+/g,
    "_",
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
        "Por favor permite las ventanas emergentes para poder ver el documento.",
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
