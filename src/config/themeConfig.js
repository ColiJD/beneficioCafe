// Tema "cuaderno de beneficio": papel pergamino, tinta tostada, rojo cereza y verde hoja.
// Solo estilo: no cambia estructura ni funciones. Los mismos valores viven en globals.css (:root).
const tinta = "#2A1A10";
const papel = "#F7F1E3"; // superficies (tarjetas, tablas, formularios)
const campo = "#FFFCF5"; // fondo de inputs
const fondo = "#E4D9BF"; // fondo de la aplicación
const linea = "#CDBB94";
const cereza = "#A6232B";
const lomo = "#33200F"; // menú lateral

const theme = {
  token: {
    // 🎨 Colores
    colorPrimary: cereza,
    colorSuccess: "#2F5A3B", // verde hoja
    colorWarning: "#8A5A12", // ámbar
    colorError: "#9B1C1C",
    colorInfo: "#5B4636",
    colorLink: cereza,
    colorTextBase: tinta,
    colorBgBase: papel,
    colorBgLayout: fondo,
    colorBgContainer: papel,
    colorBgElevated: campo,
    colorBorder: linea,
    colorBorderSecondary: "#E0D3B4",
    colorTextSecondary: "#6A5640",
    colorTextPlaceholder: "#8A7760",

    // 🖌️ Tipografía
    fontFamily: "var(--font-cuerpo), Arial, Helvetica, sans-serif",
    fontFamilyCode: "var(--font-mono), ui-monospace, monospace",
    borderRadius: 6,
    controlHeight: 38,
  },
  components: {
    Layout: { siderBg: lomo, bodyBg: fondo, triggerBg: lomo },
    Menu: {
      darkItemBg: lomo,
      darkSubMenuItemBg: "#2A190B",
      darkItemColor: "#E3D6BB",
      darkItemHoverBg: "rgba(255,255,255,0.07)",
      darkItemHoverColor: "#FFF8EC",
      darkItemSelectedBg: "rgba(255,255,255,0.1)",
      darkItemSelectedColor: "#FFF8EC",
    },
    Table: {
      headerBg: "#EFE4C8",
      headerColor: tinta,
      borderColor: linea,
      rowHoverBg: "#F1E7CF",
    },
    Card: { colorBgContainer: papel, colorBorderSecondary: linea },
    Input: { colorBgContainer: campo },
    InputNumber: { colorBgContainer: campo },
    Select: { colorBgContainer: campo },
    DatePicker: { colorBgContainer: campo },
    Button: { primaryShadow: "0 2px 0 rgba(30,16,8,0.3)", fontWeight: 600 },
  },
};

export default theme;
