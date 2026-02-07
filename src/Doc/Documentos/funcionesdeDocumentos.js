// utils/numeroALetras.js
export function numeroALetras(num, unidad = "Lempiras") {
  if (isNaN(num)) return "";

  const unidades = [
    "",
    "uno",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve",
    "diez",
    "once",
    "doce",
    "trece",
    "catorce",
    "quince",
    "dieciséis",
    "diecisiete",
    "dieciocho",
    "diecinueve",
  ];

  const decenas = [
    "",
    "diez",
    "veinte",
    "treinta",
    "cuarenta",
    "cincuenta",
    "sesenta",
    "setenta",
    "ochenta",
    "noventa",
  ];

  const centenas = [
    "",
    "cien",
    "doscientos",
    "trescientos",
    "cuatrocientos",
    "quinientos",
    "seiscientos",
    "setecientos",
    "ochocientos",
    "novecientos",
  ];

  function convertirMenor1000(n) {
    let texto = "";
    if (n === 0) return "";
    if (n < 20) {
      texto = unidades[n];
    } else if (n < 100) {
      texto = decenas[Math.floor(n / 10)];
      if (n % 10 !== 0) texto += ` y ${unidades[n % 10]}`;
    } else {
      texto = centenas[Math.floor(n / 100)];
      if (n % 100 > 0) {
        if (Math.floor(n / 100) === 1 && n % 100 === 0) {
          texto = "cien";
        } else {
          texto += ` ${convertirMenor1000(n % 100)}`;
        }
      }
    }
    return texto;
  }

  function convertirMiles(n) {
    if (n === 0) return "cero";
    if (n < 1000) return convertirMenor1000(n);

    if (n < 1000000) {
      const miles = Math.floor(n / 1000);
      const resto = n % 1000;
      let milesTexto = miles === 1 ? "mil" : `${convertirMenor1000(miles)} mil`;
      if (resto > 0) milesTexto += ` ${convertirMenor1000(resto)}`;
      return milesTexto;
    }

    const millones = Math.floor(n / 1000000);
    const resto = n % 1000000;
    let millonesTexto =
      millones === 1 ? "un millón" : `${convertirMenor1000(millones)} millones`;
    if (resto > 0) millonesTexto += ` ${convertirMiles(resto)}`;
    return millonesTexto;
  }

  const entero = Math.floor(num);
  const decimales = Math.round((num - entero) * 100);

  let resultado = `${convertirMiles(entero)} ${unidad}`;
  if (decimales > 0) {
    resultado += ` con ${decimales.toString().padStart(2, "0")}/100`;
  }

  return resultado.charAt(0).toUpperCase() + resultado.slice(1);
}

/** Limpia texto de emojis y caracteres extraños */
export function cleanText(text) {
  if (!text) return "";
  return text.replace(/[\p{Emoji_Presentation}\p{Emoji}\u200d]+/gu, "").trim();
}

/** Convierte una imagen a blanco y negro con opacidad */
export async function processImageToGray(imgUrl, opacity = 0.15) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imgUrl;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    // const r = imageData.data[i];
    // const g = imageData.data[i + 1];
    // const b = imageData.data[i + 2];
    // const gray = 0.3 * r + 0.59 * g + 0.11 * b;
    // imageData.data[i] = gray;
    // imageData.data[i + 1] = gray;
    // imageData.data[i + 2] = gray;
    imageData.data[i + 3] = 255 * opacity; // opacidad
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}

/** Escala una imagen manteniendo proporciones dentro de un tamaño máximo */
export async function getLogoScaled(imgUrl, targetWidth, targetHeight) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imgUrl;
  await img.decode();

  const aspectRatio = img.width / img.height;
  let width = targetWidth;
  let height = targetHeight;

  if (width / height > aspectRatio) {
    width = height * aspectRatio;
  } else {
    height = width / aspectRatio;
  }

  return { src: imgUrl, width, height };
}
