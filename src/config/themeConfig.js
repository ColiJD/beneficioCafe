// Tema "cafetal": fondo neutro (sin beige), verde de cafeto como color principal y café para acentos.
// El rojo queda solo para errores y acciones destructivas. Los mismos valores viven en globals.css (:root).
// Contrastes verificados con WCAG 2.1 AA: texto ≥ 4.5:1 sobre su fondo; bordes de controles y foco ≥ 3:1.
const tinta = "#1C1917"; // texto (17.5:1 sobre blanco)
const suave = "#57534E"; // texto secundario (7.6:1)
const fondo = "#F3F2EF"; // fondo de la aplicación
const superficie = "#FFFFFF"; // tarjetas, tablas, formularios
const linea = "#E2DFDA"; // divisores y bordes decorativos
const borde = "#8C857D"; // borde de inputs y selects (3.6:1, WCAG 1.4.11)
const primario = "#1F6B4A"; // verde cafeto: botones, enlaces, foco (6.4:1)
const lomo = "#33200F"; // menú lateral (café espresso)

const theme = {
  token: {
    // 🎨 Colores
    colorPrimary: primario,
    colorSuccess: primario,
    colorWarning: "#B54708",
    colorError: "#B42318",
    colorInfo: "#1E5A8A",
    colorLink: primario,
    colorLinkHover: "#18573C",
    colorLinkActive: "#124430",
    colorTextBase: tinta,
    colorTextSecondary: suave,
    colorTextPlaceholder: "#6E6862",
    colorBgBase: superficie,
    colorBgLayout: fondo,
    colorBgContainer: superficie,
    colorBgElevated: superficie,
    colorBorder: borde,
    colorBorderSecondary: linea,
    colorSplit: linea,

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
      darkItemColor: "#E7E2DC",
      darkItemHoverBg: "rgba(255,255,255,0.08)",
      darkItemHoverColor: "#FFFFFF",
      darkItemSelectedBg: primario,
      darkItemSelectedColor: "#FFFFFF",
    },
    Table: {
      headerBg: "#F5F4F1",
      headerColor: tinta,
      borderColor: linea,
      rowHoverBg: "#F0EEEA",
    },
    Card: { colorBgContainer: superficie, colorBorderSecondary: linea },
    Button: { primaryShadow: "0 2px 0 rgba(18,68,48,0.25)", fontWeight: 600 },
  },
};

export default theme;
