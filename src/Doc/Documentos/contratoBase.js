import JsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNumber } from "@/components/Formulario";
import {
  getEmpresaPDF,
  numeroALetras,
  cleanText,
  processImageToGray,
} from "@/Doc/Documentos/funcionesdeDocumentos";

// Texto del contrato: no menciona ninguna localidad, tasa ni condición propia de un cliente.
// Lo que cambia de un cliente a otro (identidad, domicilio, fecha de entrega, intereses) va en blanco o en Observaciones.
// tipo "compra": la empresa compra al productor. tipo "venta": la empresa vende al comprador.
export function textoContrato(tipo, empresa) {
  const compra = tipo === "compra";
  const V = compra ? "EL PRODUCTOR" : "EL VENDEDOR"; // quien entrega el café
  const C = "EL COMPRADOR"; // quien lo recibe y paga
  const sitio = compra ? C : V; // la entrega es en las instalaciones de la empresa
  const ley = empresa.pais || "la República";
  const lugar = [empresa.ciudad, empresa.pais].filter(Boolean).join(", ");
  return {
    titulo: compra ? "CONTRATO DE COMPRA-VENTA DE CAFÉ" : "CONTRATO DE VENTA DE CAFÉ",
    rolEmpresa: compra ? C : V,
    rolCliente: compra ? V : C,
    clausulas: [
      `1. OBJETO. ${V} vende y ${C} compra la cantidad de café indicada en el cuadro anterior, en la calidad y presentación que se compruebe al recibirlo.`,
      "2. PRECIO. El precio por quintal es el indicado en el cuadro y se mantiene fijo mientras dure este contrato, aunque el precio del mercado suba o baje.",
      `3. ENTREGA. El café se entrega en las instalaciones de ${sitio}, o en el lugar que las partes acuerden por escrito, a más tardar el ____ de ______________ de ______.`,
      `4. PESO Y CALIDAD. El valor final se calcula con el peso y la calidad comprobados al recibir el café, al precio pactado. ${V} puede estar presente en el pesaje.`,
      `5. PAGO. ${C} paga al recibir el café, en efectivo, transferencia o cheque, según acuerden las partes. Los anticipos entregados antes de la entrega se descuentan del valor final. Si se pactan intereses u otras condiciones sobre un anticipo, deben anotarse en Observaciones.`,
      "6. INCUMPLIMIENTO Y CASO FORTUITO. Si una parte no cumple, la otra puede exigir el cumplimiento o dar por terminado el contrato y reclamar los daños y perjuicios. Ninguna parte responde por no cumplir cuando se deba a caso fortuito o fuerza mayor (clima extremo, plagas, cierre de vías u otros hechos fuera de su control), siempre que avise a la otra parte apenas ocurra.",
      "7. MODIFICACIONES. Cualquier cambio a este contrato debe constar por escrito y estar firmado por ambas partes.",
      `8. LEY Y CONTROVERSIAS. Las partes procurarán resolver cualquier diferencia de forma amistosa. Si no se logra, se someten a los tribunales competentes de ${lugar || "su domicilio"} y a las leyes de ${ley}.`,
      "9. EJEMPLARES. Este contrato se firma en dos ejemplares del mismo valor, uno para cada parte.",
    ],
  };
}

/** Genera el PDF del contrato (compra o venta de café) y lo manda a imprimir */
export const generarContrato = async (tipo, formState) => {
  const empresa = await getEmpresaPDF();
  const texto = textoContrato(tipo, empresa);
  const doc = new JsPDF({ unit: "pt", format: "letter" });
  const leftMargin = 50;
  const rightMargin = 50;
  const ancho = doc.internal.pageSize.getWidth() - leftMargin - rightMargin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const interlinea = 13;

  const fondoGray = await processImageToGray(empresa.logo, 0.15);

  const fechaInput = formState?.fecha ? new Date(formState.fecha) : new Date();
  const fechaLarga = fechaInput.toLocaleDateString("es-HN", { year: "numeric", month: "long", day: "numeric" });

  const cliente = formState?.cliente?.label || formState?.comprador?.label || (tipo === "compra" ? "Productor" : "Comprador");
  // La lista de productos agrega "(Dispo: …)" al nombre: no va en el contrato.
  const producto = (formState?.producto?.label || "Producto").replace(/ *[(]Dispo.*$/i, "");
  const cantidadQQ = formatNumber(formState?.contratoCantidadQQ || 0);
  const precioQQ = formatNumber(formState?.contratoPrecio || 0);
  const totalLps = formatNumber(formState?.contratoTotalLps || 0);
  const descripcion = formState?.contratoDescripcion || "";
  const contratoID = formState?.contratoID || "0000";
  const cantidadLetras = numeroALetras(formState?.contratoTotalLps || 0);

  // Fondo con el logo
  const imgWidth = pageWidth * 0.66;
  const imgHeight = pageHeight * 0.5;
  doc.addImage(fondoGray, "PNG", (pageWidth - imgWidth) / 2, pageHeight * 0.05, imgWidth, imgHeight);

  // Si el siguiente bloque no cabe, pasa a una hoja nueva
  let y = 50;
  const hay = (alto) => {
    if (y + alto > pageHeight - 52) {
      doc.addPage();
      y = 50;
    }
  };
  const parrafo = (t, alto = interlinea) => {
    const lineas = doc.splitTextToSize(t, ancho);
    hay(lineas.length * alto);
    doc.text(lineas, leftMargin, y);
    y += lineas.length * alto;
  };

  // Encabezado
  doc.setFont("times", "bold");
  doc.setFontSize(17);
  doc.text(empresa.nombre.toUpperCase(), pageWidth / 2, y, { align: "center" });
  y += 20;
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text(texto.titulo, pageWidth / 2, y, { align: "center" });
  y += 15;
  if (empresa.propietario) {
    doc.text(`Propietario: ${empresa.propietario}`, pageWidth / 2, y, { align: "center" });
    y += 15;
  }
  if (empresa.telefono) {
    doc.text(`Teléfono: ${empresa.telefono}`, pageWidth / 2, y, { align: "center" });
    y += 15;
  }

  y += 4;
  doc.setFontSize(10.5);
  if (empresa.cosecha || tipo === "venta") {
    doc.setFont("times", "bold");
    if (empresa.cosecha) doc.text(`Cosecha ${empresa.cosecha.nombre}`, leftMargin, y);
    if (tipo === "venta") doc.text(`Contrato No: ${contratoID}`, pageWidth - rightMargin, y, { align: "right" });
    y += 20;
  }

  // Lugar, fecha y partes (sin "departamento": cada empresa está en un lugar distinto)
  doc.setFont("times", "normal");
  const lugar = [empresa.ciudad, empresa.pais].filter(Boolean).join(", ");
  parrafo(`${lugar ? `En ${lugar}, a ` : "A "}${fechaLarga}, se celebra este contrato entre:`);
  y += 8;
  const quien = empresa.propietario ? `${empresa.nombre.toUpperCase()}, representada por ${empresa.propietario}` : empresa.nombre.toUpperCase();
  parrafo(`${quien}, en adelante "${texto.rolEmpresa}"; y`);
  y += 8;
  hay(3 * interlinea);
  // El nombre va en rojo como el resto de los datos que se llenan en el sistema
  doc.setTextColor(255, 0, 0);
  doc.text(cliente, leftMargin, y);
  doc.setTextColor(0, 0, 0);
  y += interlinea + 3;
  parrafo(`con identidad No. ________________________ y domicilio en ______________________________________, en adelante "${texto.rolCliente}".`);

  // Cuadro con lo pactado
  hay(90);
  autoTable(doc, {
    startY: y + 12,
    margin: { left: leftMargin, right: rightMargin },
    head: [["Producto", "Cantidad (QQ)", "Precio por QQ (Lps)", "Total (Lps)"]],
    body: [[cleanText(producto), cantidadQQ, `L. ${precioQQ}`, `L. ${totalLps}`]],
    styles: { font: "times", fontSize: 10.5, lineColor: [0, 0, 0], lineWidth: 0.5 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.5 },
    bodyStyles: { textColor: [255, 0, 0] },
  });
  y = doc.lastAutoTable.finalY + 16;

  doc.setFont("times", "normal");
  doc.setTextColor(0, 0, 0);
  parrafo(`Cantidad en letras: ${cantidadLetras}`);
  y += 8;
  doc.setFont("times", "bold");
  parrafo("Observaciones:");
  doc.setFont("times", "normal");
  if (descripcion) parrafo(String(descripcion));
  else {
    parrafo("______________________________________________________________________________");
  }

  // Cláusulas
  y += 8;
  doc.setFont("times", "bold");
  parrafo("CLÁUSULAS");
  y += 4;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  texto.clausulas.forEach((c) => {
    parrafo(c, 12);
    y += 3;
  });

  // Firmas: cada parte con su nombre
  hay(80);
  y += 36;
  const firmaWidth = 190;
  const izq = leftMargin + 10;
  const der = pageWidth - rightMargin - firmaWidth - 10;
  doc.setFontSize(10.5);
  doc.line(izq, y, izq + firmaWidth, y);
  doc.line(der, y, der + firmaWidth, y);
  doc.setFont("times", "bold");
  doc.text(texto.rolCliente, izq + firmaWidth / 2, y + 13, { align: "center" });
  doc.text(texto.rolEmpresa, der + firmaWidth / 2, y + 13, { align: "center" });
  doc.setFont("times", "normal");
  doc.text(doc.splitTextToSize(cliente, firmaWidth), izq + firmaWidth / 2, y + 26, { align: "center" });
  doc.text(doc.splitTextToSize(empresa.propietario || empresa.nombre, firmaWidth), der + firmaWidth / 2, y + 26, { align: "center" });

  // Pie en cada hoja
  const hojas = doc.getNumberOfPages();
  for (let i = 1; i <= hojas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text([empresa.nombre, lugar].filter(Boolean).join(" - ") + (hojas > 1 ? `   (hoja ${i} de ${hojas})` : ""), pageWidth / 2, pageHeight - 30, { align: "center" });
  }

  const pdfURL = URL.createObjectURL(doc.output("blob"));

  // Móvil: se abre el PDF y se imprime desde el visor. Escritorio: imprime directo.
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    if (!window.open(pdfURL, "_blank")) alert("Por favor permite las ventanas emergentes para poder ver el documento.");
  } else {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = pdfURL;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
  }
};
