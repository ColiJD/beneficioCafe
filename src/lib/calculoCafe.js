export function truncarDosDecimalesSinRedondear(numero) {
  const epsilon = 1e-10;
  return Math.floor((numero + epsilon) * 100) / 100;
}

export function calcularCafeDesdeProducto(
  pesoBruto,
  sacosTotales,
  productoSeleccionado,
  precioQQ
) {
  if (!productoSeleccionado || !productoSeleccionado.data) {
    return { oro: "0.00", total: "0.00", retencion: "0.00" };
  }

  const { tara = 0, descuento = 0, factorOro = 1 } = productoSeleccionado.data;

  pesoBruto = Math.max(parseFloat(pesoBruto) || 0, 0);
  sacosTotales = Math.max(parseFloat(sacosTotales) || 0, 0);
  precioQQ = Math.max(parseFloat(precioQQ) || 0, 0);

  const sacos = sacosTotales * tara;
  let pesoNeto = Math.max(pesoBruto - sacos, 0);

  if (descuento) pesoNeto = Math.max(pesoNeto * (1 - descuento), 0);

  let oro = pesoNeto / factorOro;

  // Truncar y formatear a string con 2 decimales
  const oroStr = (oro);

  const total = (precioQQ * oroStr);
  const retencion = (oroStr * 0.96);

  return { oro: oroStr, total, retencion };
}

export function calcularPesoBrutoDesdeOro(
  oro,
  sacosTotales,
  productoSeleccionado
) {
  if (!productoSeleccionado || !productoSeleccionado.data) {
    return { pesoBruto: "0.00" };
  }

  const { tara = 0, descuento = 0, factorOro = 1 } = productoSeleccionado.data;

  oro = Math.max(parseFloat(oro) || 0, 0);
  sacosTotales = Math.max(parseFloat(sacosTotales) || 0, 0);

  // Paso 1: Calcular peso neto necesario para obtener el oro deseado
  let pesoNetoNecesario = oro * factorOro;

  // Paso 2: Revertir el descuento si existe
  if (descuento) {
    pesoNetoNecesario = pesoNetoNecesario / (1 - descuento);
  }

  // Paso 3: Calcular peso bruto (agregando tara por saco)
  const pesoBrutoNecesario = pesoNetoNecesario + sacosTotales * tara;

  return { pesoBruto: Math.round(pesoBrutoNecesario * 100) / 100};
}
