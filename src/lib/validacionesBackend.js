// Capitaliza la primera letra de cada palabra
export function capitalizarNombre(text = "") {
  return text
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Validar Cédula (ej. 0703-2001-00798)
export function validarCedula(value) {
  if (!value) return "La cédula es obligatoria";
  const regex = /^\d{4}-\d{4}-\d{5}$/;
  return regex.test(value)
    ? null
    : "La cédula no tiene el formato válido (0000-0000-00000)";
}

// Validar RTN (ej. 0703-2001-0079812)
export function validarRTN(value) {
  if (!value) return null; // RTN puede ser opcional
  const regex = /^\d{4}-\d{4}-\d{7}$/;
  return regex.test(value)
    ? null
    : "El RTN no tiene el formato válido (0000-0000-0000000)";
}

// Validar teléfono (solo números, mínimo 8 dígitos)
export function validarTelefono(value) {
  if (!value) return "El teléfono es obligatorio";

  // Permite opcional + al inicio, seguido solo de números
  const regex = /^\+?\d+$/;
  if (!regex.test(value))
    return "El teléfono solo debe contener números y opcionalmente iniciar con +";

  // Contar solo los dígitos (sin el +)
  const digitos = value.replace(/\D/g, "");
  if (digitos.length < 8) return "El teléfono debe tener al menos 8 dígitos";

  return null;
}

// Validar email
export function validarEmail(value) {
  if (!value) return "El correo es obligatorio";
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(value) ? null : "El correo no tiene un formato válido";
}

// Validar número entero positivo (>0)
export function validarEnteroPositivo(value) {
  if (!/^\d+$/.test(value)) return "Debe ser un número entero";
  if (parseInt(value, 10) <= 0) return "Debe ser mayor a 0";
  return null;
}

// Validar número entero no negativo (>=0)
export function validarEnteroNoNegativo(value) {
  if (!/^\d+$/.test(value)) return "Debe ser un número entero";
  if (parseInt(value, 10) < 0) return "Debe ser mayor o igual a 0";
  return null;
}

// Validar float positivo (hasta 2 decimales, >=0)
export function validarFloatPositivo(value) {
  if (value === "" || value === null || value === undefined)
    return "Ingrese un valor";
  if (!/^\d*\.?\d{0,2}$/.test(value))
    return "Ingrese un número válido (máx 2 decimales)";
  if (parseFloat(value) < 0) return "El valor debe ser mayor o igual a 0";
  return null;
}

// Validar campo requerido (string, number)
export function validarRequerido(value, nombreCampo = "Campo") {
  if (value === undefined || value === null || value.toString().trim() === "") {
    return `${nombreCampo} es obligatorio`;
  }
  return null;
}

// Validación genérica para un objeto según reglas
// rules = { campo: [funcionValidadora1, funcionValidadora2, ...] }
export function validarDatosGenerico(obj, rules) {
  const errores = {};
  let valido = true;

  for (const campo in rules) {
    const value = obj[campo];
    for (const fn of rules[campo]) {
      const error = fn(value);
      if (error) {
        errores[campo] = error;
        valido = false;
        break; // solo primer error por campo
      }
    }
  }

  return { valido, errores };
}
