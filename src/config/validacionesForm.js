// Capitaliza la primera letra de cada palabra
export function capitalizarNombre(text) {
  if (!text) return "";
  return text
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Valida Cédula con formato 0703-2001-00798
export function validarCedula(value) {
  const regex = /^\d{4}-\d{4}-\d{5}$/;
  return regex.test(value);
}
// Valida correo electrónico
export function validarEmail(value) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(value);
}


// Valida RTN con formato 0703-2001-0079812 (2 números extra)
export function validarRTN(value) {
  const regex = /^\d{4}-\d{4}-\d{7}$/;
  return regex.test(value);
}
// Valida Teléfono (solo números)
export function validarTelefono(value) {
  const regex = /^\d+$/;
  return regex.test(value);
}

// 🔹 Función utilitaria para formatear números
export const formatNumber = (value) => {
  const num = parseFloat(value);
  return isNaN(num) ? "0" : num.toString();
};

// Valida que sea número entero positivo mayor a 0
export function validarEnteroPositivo(value) {
  return /^\d+$/.test(value) && parseInt(value, 10) > 0;
}

// Valida que sea número entero no negativo (>=0)
export function validarEnteroNoNegativo(value) {
  return /^\d+$/.test(value) && parseInt(value, 10) >= 0;
}
// 🔹 Función genérica para limpiar formulario
/**
 * Limpia un formulario de manera genérica.
 * @param {Object} campos - Objeto con setters y tipo de campo opcional.
 *   Ejemplo: { setCliente: { setter: setCliente, type: 'select' }, setNombre: { setter: setNombre } }
 *   type: 'select' | 'input' (por defecto 'input')
 */
export const limpiarFormulario = (campos) => {
  Object.values(campos).forEach((campo) => {
    if (typeof campo === "function") {
      // Caso simple: le pasaste el setter directo
      campo("");
    } else if (campo && typeof campo.setter === "function") {
      // Caso avanzado: le pasaste { setter, type }
      campo.setter(campo.type === "select" ? null : "");
    }
  });
};

// Enteros positivos (solo dígitos)
export const handleIntegerChange = (setter) => (e) => {
  const value = e.target.value;
  if (/^\d*$/.test(value)) setter(value);
};

// Floats positivos (permitiendo un solo punto decimal)
export const handleFloatChange = (setter) => (e) => {
  const value = e.target.value;
  // Permite números, vacíos, un solo punto y hasta dos decimales
  if (/^\d*\.?\d{0,2}$/.test(value)) setter(value);
};


// Validador de float positivo con hasta 2 decimales
export const validarFloatPositivo = (value) => {
  if (value === "" || value === null) return "Ingrese un valor";

  // Permite números positivos con hasta 2 decimales
  if (!/^\d*\.?\d{0,2}$/.test(value)) return "Ingrese un número válido (máx 2 decimales)";

  if (parseFloat(value) < 0) return "El valor debe ser >= 0";

  return null;
};
