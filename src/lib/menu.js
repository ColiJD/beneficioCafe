import {
  HomeOutlined,
  ShoppingCartOutlined,
  MinusCircleOutlined,
  AppstoreOutlined,
  SettingOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { signOut } from "next-auth/react";

// Ilustraciones de las tarjetas del menú (SVG propios, tema café)
import img_admin from "@/img/tarjetas/admin.svg";
import img_clientes from "@/img/tarjetas/clientes.svg";
import img_compra from "@/img/tarjetas/compra.svg";
import img_compradores from "@/img/tarjetas/compradores.svg";
import img_contrato from "@/img/tarjetas/contrato.svg";
import img_cosecha from "@/img/tarjetas/cosecha.svg";
import img_deposito from "@/img/tarjetas/deposito.svg";
import img_empresa from "@/img/tarjetas/empresa.svg";
import img_entrega from "@/img/tarjetas/entrega.svg";
import img_informe from "@/img/tarjetas/informe.svg";
import img_inventario from "@/img/tarjetas/inventario.svg";
import img_liquidacion from "@/img/tarjetas/liquidacion.svg";
import img_prestamo from "@/img/tarjetas/prestamo.svg";
import img_producto from "@/img/tarjetas/producto.svg";
import img_reporte from "@/img/tarjetas/reporte.svg";
import img_salida from "@/img/tarjetas/salida.svg";
import img_secado from "@/img/tarjetas/secado.svg";
import img_secadora from "@/img/tarjetas/secadora.svg";


const RutaTransaccion = "/private/page/transacciones";
const Ruta = "/private/page";

// ✅ Estructura base con imágenes y rutas
export const menuItems = [
  {
    id: 4,
    name: "Informe",
    image: img_informe,
    subItems: [
      {
        id: 400,
        name: "General",
        href: Ruta + "/informe/general",
        image: img_informe,
      },

      {
        id: 402,
        name: "Registro de Entradas",
        href: Ruta + "/informe/reporteCliente",
        image: img_reporte,
      },
      {
        id: 403,
        name: "Registro de Salidas",
        href: Ruta + "/informe/reporteSalidas",
        image: img_reporte,
      },
      {
        id: 404,
        name: "Por Cliente",
        href: Ruta + "/informe/porCliente",
        image: img_clientes,
      },
      {
        id: 405,
        name: "Por Comprador",
        href: Ruta + "/informe/porComprador",
        image: img_compradores,
      },

      {
        id: 401,
        name: "Saldo Por Deposito",
        href: RutaTransaccion + "/deposito/vista",
        image: img_deposito,
      },
      {
        id: 406,
        name: "Saldo Por Contrato",
        href: RutaTransaccion + "/contrato/vista",
        image: img_contrato,
      },
      {
        id: 40,
        name: "Saldo Prestamo y  Anticipo ",
        href: Ruta + "/informe/reportePrestamo",
        image: img_prestamo,
      },
      {
        id: 803,
        name: "Reporte de Secado",
        href: Ruta + "/secado/reporte",
        image: img_secado,
      },
    ],
  },
  {
    id: 1,
    name: "Entradas",
    image: img_compra,
    subItems: [
      {
        id: 101,
        name: "Compra Directa",
        href: RutaTransaccion + "/compra/",
        image: img_compra,
      },
      {
        id: 102,
        name: "Deposito",
        href: RutaTransaccion + "/deposito",
        image: img_deposito,
      },
      {
        id: 103,
        name: "Liquidar Deposito",
        href: RutaTransaccion + "/deposito/liqDeposito",
        image: img_liquidacion,
      },
      {
        id: 104,
        name: "Contrato",
        href: RutaTransaccion + "/contrato",
        image: img_contrato,
      },
      {
        id: 105,
        name: "Entregar Contrato",
        href: RutaTransaccion + "/contrato/entrega",
        image: img_entrega,
      },
    ],
  },
  {
    id: 2,
    name: "Salidas",
    image: img_salida,
    subItems: [
      {
        id: 201,
        name: "Venta Directa",
        href: RutaTransaccion + "/venta",
        image: img_salida,
      },
      {
        id: 202,
        name: "Confirmacion De Venta",
        href: RutaTransaccion + "/salidas",
        image: img_liquidacion,
      },
      {
        id: 203,
        name: "Contrato",
        href: RutaTransaccion + "/contratoSalida",
        image: img_contrato,
      },
      {
        id: 204,
        name: "Entrega Contrato",
        href: RutaTransaccion + "/contratoSalida/entrega",
        image: img_entrega,
      },
    ],
  },
  {
    id: 5,
    name: "Registros",
    image: img_reporte,
    subItems: [
      { id: 501, name: "Productos", href: Ruta + "/producto", image: img_producto },
      { id: 502, name: "Clientes", href: Ruta + "/cliente", image: img_clientes },
      {
        id: 503,
        name: "Compradores",
        href: Ruta + "/compradores",
        image: img_compradores,
      },
      {
        id: 505,
        name: "Registros de clientes",
        href: Ruta + "/cliente/Registros",
        image: img_reporte,
      },
      {
        id: 506,
        name: "Central de registros",
        href: Ruta + "/registros",
        image: img_reporte,
      },
    ],
  },
  {
    id: 7,
    name: "Prestamos y Anticipos",
    image: img_prestamo,
    subItems: [
      {
        id: 701,
        name: "Clientes",
        href: RutaTransaccion + "/prestamos",
        image: img_clientes,
      },
      {
        id: 702,
        name: "Compradores",
        href: RutaTransaccion + "/prestamosCompradores",
        image: img_compradores,
      },
    ],
  },

  {
    id: 3,
    name: "Inventario",
    image: img_inventario,
    href: Ruta + "/inventario",
  },
  {
    id: 8,
    name: "Secado",
    image: img_secado,
    subItems: [
      {
        id: 801,
        name: "Control de Secado",
        href: Ruta + "/secado",
        image: img_secado,
      },
      {
        id: 802,
        name: "Secadoras",
        href: Ruta + "/secadora",
        image: img_secadora,
      },
    ],
  },
  {
    id: 9,
    name: "Administración",
    image: img_admin,
    subItems: [
      { id: 504, name: "Usuarios", href: Ruta + "/user", image: img_admin },
      { id: 507, name: "Roles y permisos", href: Ruta + "/roles", image: img_admin },
      { id: 508, name: "Cosechas", href: Ruta + "/cosechas", image: img_cosecha },
      { id: 509, name: "Empresa", href: Ruta + "/empresa", image: img_empresa },
    ],
  },
];

// 🧠 Mapa de iconos por categoría principal (puedes ajustar a gusto)
const iconMap = {
  Entradas: <ShoppingCartOutlined />,
  Salidas: <MinusCircleOutlined />,
  Inventario: <AppstoreOutlined />,
  Informe: <FileTextOutlined />,
  "Prestamos y Anticipos": <FileTextOutlined />,
  Registros: <SettingOutlined />,
  Administración: <UserOutlined />,
  Listado: <UserOutlined />,
  Secado: <AppstoreOutlined />,
};

// 🔁 Función para transformar menuItems → menuItem
export const menuItem = [
  {
    key: "inicio",
    icon: <HomeOutlined />,
    label: "Inicio",
    route: "/private", // directo: "/" sale del layout privado y recarga todo el menú
  },
  ...menuItems.map((item) => ({
    key: item.name.toLowerCase(),
    icon: iconMap[item.name] || <AppstoreOutlined />,
    label: item.name,
    ...(item.subItems
      ? {
          children: item.subItems.map((sub) => ({
            key: sub.id.toString(),
            label: sub.name,
            route: sub.href,
          })),
        }
      : { route: item.href }),
  })),
  {
    key: "logout",
    icon: <LogoutOutlined />,
    label: "Cerrar Sesión",
    onClick: () => signOut({ callbackUrl: "/login" }),
  },
];
