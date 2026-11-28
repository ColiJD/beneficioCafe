import JsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNumber } from "@/components/Formulario";
import { getEmpresaPDF } from "@/Doc/Documentos/funcionesdeDocumentos";
import cafe from "@/img/imagenfrijoles.png";
import tasa from "@/img/tasa.png";
import {
  numeroALetras,
  cleanText,
  processImageToGray,
  getLogoScaled,
  matricial,
  MATRICIAL,
  logoBlancoNegro,
} from "@/Doc/Documentos/funcionesdeDocumentos";

// Arma las filas del recibo de una compra ya registrada (reimpresión desde el registro): café, rebaja, flete, abono y total a pagar.
export const datosReciboCompra = (r) => {
  const qq = parseFloat(r.compraCantidadQQ) || 0;
  const precio = parseFloat(r.compraPrecioQQ) || 0;
  const bruto = qq * precio;
  const flete = Number(r.compraFlete) || 0;
  const abono = Number(r.compraAbono) || 0;
  const total = Number(r.compraTotal) || 0;
  // compraTotal = QQ × precio − rebaja − flete: lo que sobre sin explicar es la rebaja de Café Uva
  const rebaja = Math.round((bruto - flete - total) * 100) / 100;
  const menos = (nombre, monto) => ({ nombre, cantidad: "", precio: "", total: -monto });
  return {
    productos: [
      { nombre: r.tipoCafeNombre, cantidad: qq, precio, total: bruto },
      ...(rebaja > 0.01 ? [menos("Menos rebaja Café Uva", rebaja)] : []),
      ...(flete > 0 ? [menos("Menos flete", flete)] : []),
      ...(abono > 0 ? [menos(`Menos abono a ${r.compraAbonoTipo === "ANTICIPO" ? "anticipo" : "préstamo"}`, abono)] : []),
    ],
    total: total - abono,
    filaTotal: true,
  };
};

export const exportCompraDirecta = async (formState) => {
  const empresa = await getEmpresaPDF();
  // Impresora matricial (forma continua 9.5 x 5.5 pulg): un solo recibo por hoja, Courier en negro y sin fondo ni rejilla
  const mat = matricial(empresa);
  const fuente = mat ? "courier" : "times";
  const peso = mat ? "bold" : "normal";
  const rojo = mat ? [0, 0, 0] : [255, 0, 0];
  const doc = mat ? new JsPDF({ unit: "pt", format: [684, 396], orientation: "landscape" }) : new JsPDF({ unit: "pt", format: "letter" });
  const leftMargin = mat ? MATRICIAL.izquierda : 50;
  const rightMargin = 50;
  const topMargin = 50;
  const pageWidth = mat ? MATRICIAL.ancho : doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const fondoGray = mat ? null : await processImageToGray(empresa.logo, 0.15);

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

  const logoMat = mat ? await logoBlancoNegro(empresa.logo, 34) : null;
  const scale = mat ? 0.9 : 1.1;
  const logo = await getLogoScaled(tasa.src, 80 * scale, 80 * scale);
  const cafeimg = await getLogoScaled(cafe.src, 80 * scale, 80 * scale);

  const cliente = formState?.cliente?.label || "Cliente";
  const productos = formState?.productos || [];
  const observaciones = formState?.observaciones || "N/A";
  const comprobanteID = formState?.comprobanteID || "0000";
  const cantidadLetras = numeroALetras(formState?.total || 0);
  const formaPago = formState?.formaPago || "";

  // FUNCIÓN PRINCIPAL DE DIBUJO
  const drawComprobante = (offsetY = 0) => {
    // Fondo
    const imgWidth = pageWidth * 0.6 * scale;
    const imgHeight = pageHeight * 0.45 * scale;
    const imgX = (pageWidth - imgWidth) / 2;
    const imgY = offsetY + pageHeight * 0.05;
    if (logoMat) doc.addImage(logoMat.src, "PNG", leftMargin, 10 + offsetY, logoMat.width, logoMat.height);
    if (fondoGray) doc.addImage(fondoGray, "PNG", imgX, imgY, imgWidth, imgHeight);

    // // Logo izquierda
    // doc.addImage(
    //   logo.src,
    //   "PNG",
    //   leftMargin,
    //   20 + offsetY,
    //   logo.width,
    //   logo.height,
    // );

    // logo derecha
    // const cafeY = 20 + offsetY;
    // doc.addImage(
    //   cafeimg.src,
    //   "PNG",
    //   pageWidth - rightMargin - cafeimg.width,
    //   cafeY,
    //   cafeimg.width,
    //   cafeimg.height,
    // );

    //  Cosecha
    doc.setFont(fuente, peso);
    doc.setFontSize(11 * scale);
    doc.setTextColor(0, 0, 0);

    doc.text(empresa.cosecha ? `Cosecha ${empresa.cosecha.nombre}` : "", leftMargin, (mat ? 66 : topMargin + 80) + offsetY - 18);

    //Encabezado central
    doc.setFont(fuente, "bold");
    doc.setFontSize(16 * scale);
    doc.text(empresa.nombre.toUpperCase(), pageWidth / 2, (mat ? 28 : 50) + offsetY, {
      align: "center",
    });

    doc.setFont(fuente, peso);
    doc.setFontSize(12 * scale);
    doc.text("COMPROBANTE DE COMPRA DIRECTA", pageWidth / 2, (mat ? 44 : 70) + offsetY, {
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

    //Tabla de productos
    const bodyProductos = productos.map((p) => [
      { content: cleanText(p.nombre), styles: { textColor: rojo } },
      { content: p.cantidad === "" ? "" : formatNumber(p.cantidad), styles: { textColor: rojo } },
      {
        content: p.precio === "" ? "" : `L. ${formatNumber(p.precio)}`,
        styles: { textColor: rojo },
      },
      {
        content: p.total < 0 ? `- L. ${formatNumber(Math.abs(p.total))}` : `L. ${formatNumber(p.total)}`,
        styles: { textColor: rojo },
      },
    ]);

    // Fila final con lo que realmente se paga al cliente (después de rebajas, flete y abono)
    if (formState?.filaTotal) {
      const bold = { textColor: rojo, fontStyle: "bold" };
      bodyProductos.push([
        { content: "TOTAL A PAGAR", colSpan: 3, styles: { ...bold, halign: "right" } },
        { content: `L. ${formatNumber(formState.total || 0)}`, styles: bold },
      ]);
    }

    // Con más filas la tabla se compacta y se acorta el espacio de las firmas: cada copia debe caber en su mitad de la hoja
    const filas = bodyProductos.length;
    const compacto = filas > 2;

    autoTable(doc, {
      startY,
      margin: { left: leftMargin, right: rightMargin },
      head: [["Producto", "Cantidad (QQ)", "Precio (LPS)", "Total (LPS)"]],
      body: bodyProductos,
      styles: {
        font: fuente,
        fontStyle: peso,
        fontSize: (compacto ? 9 : 10) * scale,
        cellPadding: compacto ? 3 : 5,
        lineColor: [0, 0, 0],
        lineWidth: mat ? 0 : 0.5,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: mat ? 0 : 0.5,
        fontStyle: "bold",
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

    // Forma de pago
    doc.text("Forma de Pago:", leftMargin, startY);
    const formas = ["Efectivo", "Transferencia", "Cheque"];
    // Posiciones según el ancho real del texto: con Courier (más ancho) las opciones no se encimaban
    let x = leftMargin + doc.getTextWidth("Forma de Pago:") + 14;
    formas.forEach((f) => {
      doc.rect(x, startY - 7, 10, 10);
      if (formaPago === f) doc.text("X", x + 2, startY + 1);
      doc.text(f, x + 15, startY + 1);
      x += 15 + doc.getTextWidth(f) + 22;
    });

    startY += 25;

    doc.setFont(fuente, "bold");
    doc.text("Observaciones:", leftMargin, startY);
    startY += 12;
    doc.setFont(fuente, peso);
    const lineasObs = doc.splitTextToSize(String(observaciones || ""), pageWidth - leftMargin - rightMargin);
    doc.text(lineasObs, leftMargin, startY);
    startY += (lineasObs.length - 1) * doc.getLineHeight();

    startY += mat ? 28 : filas <= 2 ? 70 : Math.max(80 - 20 * (filas - 2), 30);

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

    doc.setFont(fuente, peso);
    doc.setTextColor(...rojo);
    doc.text(`${empresa.ciudad}  ${fecha}`, lugarX + firmaWidth / 2 - 45, firmaY - 4);
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(8 * scale);
    doc.text(
      `${empresa.nombre} - ${empresa.ciudad}, ${empresa.pais}`,
      pageWidth / 2,
      mat ? pageHeight - 14 : offsetY + pageHeight * 0.45,
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

  const nombreArchivo = `CompraDirecta_${cliente.replace(
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
