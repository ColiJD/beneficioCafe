export const validarDatos = (fields, messageApi, setErrors) => {
  const newErrors = {};

  fields.forEach((f) => {
    if (typeof f.validator === "function") {
      const error = f.validator(f.value);
      if (error) newErrors[f.label] = error;
    }
  });

  setErrors(newErrors);

  if (Object.keys(newErrors).length > 0) {
    messageApi.warning("Complete los campos obligatorios correctamente");
    return false;
  }
  return true;
};
