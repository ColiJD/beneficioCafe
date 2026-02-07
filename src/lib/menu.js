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

import Compras from "@/img/Compras.png";
import Depo from "@/img/depo.png";
import LiqDepo from "@/img/liqD.png";
import prestamo from "@/img/co.png";
import Contrato from "@/img/Contratos.png";
import Reportes from "@/img/Reportes.png";
import producto from "@/img/cliente.png";
import cliente from "@/img/product.png";
import deposito from "@/img/deposito.png";
import contrato from "@/img/contrato.png";
import eventos from "@/img/eventos.png";

const RutaTransaccion = "/private/page/transacciones";
const Ruta = "/private/page";

// ✅ Estructura base con imágenes y rutas
export const menuItems = [
  {
    id: 4,
    name: "Informe",
    image: eventos,
    subItems: [
      {
        id: 400,
        name: "General",
        href: Ruta + "/informe/general",
        image: deposito,
      },

      {
        id: 402,
        name: "Registro de Entradas",
        href: Ruta + "/informe/reporteCliente",
        image: Reportes,
      },
      {
        id: 403,
        name: "Registro de Salidas",
        href: Ruta + "/informe/reporteSalidas",
        image: prestamo,
      },
      {
        id: 404,
        name: "Por Cliente",
        href: Ruta + "/informe/porCliente",
        image: cliente,
      },
      {
        id: 405,
        name: "Por Comprador",
        href: Ruta + "/informe/porComprador",
        image: producto,
      },

      {
        id: 401,
        name: "Saldo Por Deposito",
        href: RutaTransaccion + "/deposito/vista",
        image: contrato,
      },
      {
        id: 406,
        name: "Saldo Por Contrato",
        href: RutaTransaccion + "/contrato/vista",
        image: contrato,
      },
      {
        id: 40,
        name: "Saldo Prestamo y  Anticipo ",
        href: Ruta + "/informe/reportePrestamo",
        image: contrato,
      },
    ],
  },
  {
    id: 1,
    name: "Entradas",
    image: Compras,
    subItems: [
      {
        id: 101,
        name: "Compra Directa",
        href: RutaTransaccion + "/compra/",
        image: Compras,
      },
      {
        id: 102,
        name: "Deposito",
        href: RutaTransaccion + "/deposito",
        image: Depo,
      },
      {
        id: 103,
        name: "Liquidar Deposito",
        href: RutaTransaccion + "/deposito/liqDeposito",
        image: LiqDepo,
      },
      {
        id: 104,
        name: "Contrato",
        href: RutaTransaccion + "/contrato",
        image: prestamo,
      },
      {
        id: 105,
        name: "Entregar Contrato",
        href: RutaTransaccion + "/contrato/entrega",
        image: Contrato,
      },
    ],
  },
  {
    id: 2,
    name: "Salidas",
    image: deposito,
    subItems: [
      {
        id: 201,
        name: "Venta Directa",
        href: RutaTransaccion + "/venta",
        image: Compras,
      },
      {
        id: 202,
        name: "Confirmacion De Venta",
        href: RutaTransaccion + "/salidas",
        image: deposito,
      },
      {
        id: 203,
        name: "Contrato",
        href: RutaTransaccion + "/contratoSalida",
        image: prestamo,
      },
      {
        id: 204,
        name: "Entrega Contrato",
        href: RutaTransaccion + "/contratoSalida/entrega",
        image: Contrato,
      },
    ],
  },
  {
    id: 5,
    name: "Registros",
    image: Reportes,
    subItems: [
      { id: 501, name: "Productos", href: Ruta + "/producto", image: cliente },
      { id: 502, name: "Clientes", href: Ruta + "/cliente", image: producto },
      {
        id: 503,
        name: "Compradores",
        href: Ruta + "/compradores",
        image: prestamo,
      },
      { id: 504, name: "Usuarios", href: Ruta + "/user", image: eventos },
      {
        id: 505,
        name: "Registros de clientes",
        href: Ruta + "/cliente/Registros",
        image: Reportes,
      },
    ],
  },
  {
    id: 7,
    name: "Prestamo",
    href: RutaTransaccion + "/prestamos",
    image: Contrato,
  },

  {
    id: 3,
    name: "Inventario",
    image: producto,
    href: Ruta + "/inventario",
  },
];

// 🧠 Mapa de iconos por categoría principal (puedes ajustar a gusto)
const iconMap = {
  Entradas: <ShoppingCartOutlined />,
  Salidas: <MinusCircleOutlined />,
  Inventario: <AppstoreOutlined />,
  Informe: <FileTextOutlined />,
  Prestamo: <FileTextOutlined />,
  Registros: <SettingOutlined />,
  Listado: <UserOutlined />,
};

// 🔁 Función para transformar menuItems → menuItem
export const menuItem = [
  {
    key: "inicio",
    icon: <HomeOutlined />,
    label: "Inicio",
    route: "/",
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
