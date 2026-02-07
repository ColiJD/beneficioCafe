import JsPDF from "jspdf";
import { formatNumber } from "@/components/Formulario";
import fondoImg from "@/img/frijoles.png";
import frijol from "@/img/imagenfrijoles.png";
import sello from "@/img/logo_transparente.png";
import tasa from "@/img/tasa.png";
import autoTable from "jspdf-autotable";
import {
  numeroALetras,
  cleanText,
  processImageToGray,
  getLogoScaled,
} from "@/Doc/Documentos/funcionesdeDocumentos";

export const exportDeposito = async (formState) => {
  const doc = new JsPDF({ unit: "pt", format: "letter" });
  const leftMargin = 72;
  const rightMargin = 72;
  const topMargin = 72;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Fondo gris
  const fondoGray = await processImageToGray(fondoImg.src, 0.15);

  // Fecha (solo para pie de página)
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

  // Escalar imágenes
  const logo = await getLogoScaled(tasa.src, 80, 80);
  const frijolimg = await getLogoScaled(frijol.src, 80, 80);
  const selloimg = await getLogoScaled(sello.src, 60, 60);

  // Datos
  const cliente = formState?.cliente?.label || "Cliente";
  const productos = formState?.productos || [];
  const cantidad = formState?.total || 0;
  const observaciones = formState?.observaciones || "N/A";
  const comprobanteID = formState?.comprobanteID || "0000";

  // 🔧 Nueva función sin la palabra
  const numeroALetrasQQ = (num) => {
    const entero = Math.floor(num);
    const decimales = Math.round((num - entero) * 100);

    // Elimina “lempiras” o “lempira” de los textos
    let textoEntero = numeroALetras(entero)
      .replace(/lempiras?/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (decimales > 0) {
      let textoDecimales = numeroALetras(decimales)
        .replace(/lempiras?/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      return `${textoEntero} punto ${textoDecimales} QQ de oro`;
    } else {
      return `${textoEntero} QQ de oro`;
    }
  };

  const cantidadLetras = numeroALetrasQQ(cantidad);

  const drawComprobante = (offsetY = 0) => {
    // Fondo
    const imgWidth = pageWidth * 0.6;
    const imgHeight = (imgWidth / pageWidth) * pageHeight;
    const imgX = (pageWidth - imgWidth) / 2;
    const imgY = offsetY + pageHeight / 4 - imgHeight / 2;
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

    // cafe derecha
    const frijolY = 20 + offsetY;
    doc.addImage(
      frijolimg.src,
      "PNG",
      pageWidth - rightMargin - frijolimg.width,
      frijolY,
      frijolimg.width,
      frijolimg.height
    );

    // Encabezado
    doc.setFont("times", "bold");
    doc.setFontSize(20);
    doc.text("BENEFICIO CAFÉ HENOLA", pageWidth / 2, 60 + offsetY, {
      align: "center",
    });

    doc.setFont("times", "normal");
    doc.setFontSize(14);
    doc.text("COMPROBANTE DE DEPÓSITO", pageWidth / 2, 85 + offsetY, {
      align: "center",
    });
    doc.text("Propietario Enri Lagos", pageWidth / 2, 100 + offsetY, {
      align: "center",
    });
    doc.setFontSize(12);
    doc.text(
      "Teléfono: (504) 3271-3188, (504) 9877-8789",
      pageWidth / 2,
      115 + offsetY,
      {
        align: "center",
      }
    );

    // Cosecha
    doc.setFont("times", "normal");
    doc.text("Cosecha 2025 - 2026", leftMargin, 110 + offsetY);

    // Productor y comprobante alineados
    let startY = topMargin + 70 + offsetY;
    doc.setFont("times", "normal");
    doc.text(`Productor: ${cliente}`, leftMargin, startY);

    doc.setFont("times", "normal");
    const textoBase = "Comprobante No:";
    const anchoTextoBase = doc.getTextWidth(textoBase);
    doc.text(textoBase, pageWidth - rightMargin - 80, startY);

    // Número del comprobante en rojo
    doc.setTextColor(255, 0, 0);
    doc.text(
      `${comprobanteID}`,
      pageWidth - rightMargin - 80 + anchoTextoBase + 5,
      startY
    );
    doc.setTextColor(0, 0, 0);

    // Tabla
    startY += 15;
    const bodyProductos = productos.map((p) => [
      { content: cleanText(p.nombre), styles: { textColor: [255, 0, 0] } },
      { content: formatNumber(p.cantidad), styles: { textColor: [255, 0, 0] } },
    ]);

    autoTable(doc, {
      startY,
      margin: { left: leftMargin, right: rightMargin },
      head: [["Producto", "Cantidad (QQ)"]],
      body: bodyProductos,
      styles: {
        font: "times",
        fontSize: 11,
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

    startY = doc.lastAutoTable.finalY + 20;

    // Cantidad en letras
    doc.setFont("times", "normal");
    doc.setTextColor(0, 0, 0);
    const texto = "Cantidad en Letras:";
    const anchoTexto = doc.getTextWidth(texto);
    doc.text(texto, leftMargin, startY);
    doc.setTextColor(255, 0, 0);
    doc.text(cantidadLetras, leftMargin + anchoTexto + 5, startY);
    doc.setTextColor(0, 0, 0);

    // Observaciones
    startY += 30;
    doc.setFont("times", "bold");
    doc.text("Observaciones:", leftMargin, startY);
    startY += 15;
    doc.setFont("times", "normal");
    doc.text(String(observaciones || ""), leftMargin, startY, {
      maxWidth: pageWidth - leftMargin - rightMargin,
    });

    // Firmas
    startY += 80;
    const firmaWidth = 180;
    doc.line(leftMargin, startY, leftMargin + firmaWidth, startY);
    doc.text("FIRMA", leftMargin + 70, startY + 15);

    // Sello
    doc.addImage(
      selloimg.src,
      "PNG",
      leftMargin + firmaWidth / 2 - selloimg.width / 2,
      startY - selloimg.height + 3,
      selloimg.width,
      selloimg.height
    );

    // Lugar y Fecha
    doc.line(
      pageWidth - rightMargin - (firmaWidth - 25),
      startY,
      pageWidth - rightMargin,
      startY
    );
    doc.setTextColor(255, 0, 0);
    doc.text(`El Paraíso  ${fecha}`, pageWidth - rightMargin - 140, startY - 4);
    doc.setTextColor(0, 0, 0);
    doc.text("LUGAR Y FECHA", pageWidth - rightMargin - 130, startY + 15);

    // Footer
    doc.setFontSize(10);
    doc.text(
      "Beneficio Café Henola - El Paraíso, Honduras",
      pageWidth / 2,
      offsetY + pageHeight / 2 - 15,
      { align: "center" }
    );
  };

  drawComprobante(0);
  drawComprobante(pageHeight / 2);

  // Línea de corte
  doc.setLineDash([5, 3]);
  doc.line(40, pageHeight / 2, pageWidth - 40, pageHeight / 2);
  doc.setLineDash();

  const nombreArchivo = `Deposito_${cliente.replace(
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
