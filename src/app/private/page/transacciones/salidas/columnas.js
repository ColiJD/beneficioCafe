export const columnas = [
  { label: "ID", key: "salidaID" },
  { label: "Fecha", key: "salidaFecha", type: "date" },
  { label: "Comprador", key: "compradorNombre" },

  {
    label: "QQ",
    key: "salidaCantidadQQ",
    type: "number",
    isCantidad: true,
  },
  { label: "Precio", key: "salidaPrecio", type: "money" },
  {
    label: "Total Lps",
    key: "totalLps",
    type: "money",
    isTotal: true,
  },
  {
    label: "Promedio",
    key: "promedioPonderado",
    type: "money",
  },

  { label: "Descripción", key: "salidaDescripcion" },
];
