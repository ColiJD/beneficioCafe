import { Tag } from "antd";
import { formatNumber } from "@/components/Formulario";
import dayjs from "dayjs";

// ----- Helpers -----
const renderNumber = (v) => formatNumber(v, 2);
const renderMoney = (v) => "L. " + formatNumber(v, 2);
const renderDate = (v) => dayjs(v).format("DD/MM/YYYY");
const renderTag = (v) => <Tag color={v === "Sí" ? "green" : "red"}>{v}</Tag>;

export const columnasPorTipo = {
  Contrato: [
    { title: "ID", dataIndex: "contratoID", fixed: "left" },
    {
      title: "Fecha",
      sorter: (a, b) => dayjs(a.fecha).unix() - dayjs(b.fecha).unix(),
      dataIndex: "fecha",
      render: renderDate,
    },
    { title: "Descripción", dataIndex: "descripcion", width: 200 },
    {
      title: "QQ Pendientes",
      dataIndex: "totalQQPorLiquidar",
      align: "center",
      render: (v) => (
        <span style={{ color: "orange" }}>{formatNumber(v, 2)}</span>
      ),
    },
    {
      title: "Inicial QQ",
      dataIndex: "cantidadContrato",
      align: "center",
      width: 120,
      render: renderNumber,
    },
    {
      title: "Entregado QQ",
      dataIndex: "totalQQ",
      align: "center",
      render: renderNumber,
    },
    {
      title: "Precio",
      dataIndex: "precioQQ",
      align: "center",
      render: renderMoney,
    },
    {
      title: "Entregado Lps",
      dataIndex: "totalLps",
      align: "center",
      render: renderMoney,
    },

    {
      title: "Completado",
      dataIndex: "liquidado",
      align: "center",
      render: renderTag,
    },
  ],
  ConfirmacionVenta: [
    { title: "ID", dataIndex: "id" },

    {
      title: "Fecha",
      sorter: (a, b) => dayjs(a.fecha).unix() - dayjs(b.fecha).unix(),
      dataIndex: "fecha",
      render: renderDate,
    },

    { title: "Descripción", dataIndex: "descripcion" },

    {
      title: "QQ Pendientes",
      dataIndex: "totalQQPorLiquidar",
      align: "center",
      render: (v) => (
        <span style={{ color: "orange" }}>{formatNumber(v, 2)}</span>
      ),
    },

    {
      title: "Inicial QQ",
      dataIndex: "cantidadQQ",
      align: "center",
      render: renderNumber,
    },

    {
      title: "Entregado QQ",
      dataIndex: "totalQQ",
      align: "center",
      render: renderNumber,
    },

    {
      title: "Precio",
      dataIndex: "precioQQ",
      align: "center",
      render: renderMoney,
    },

    {
      title: "Entregado Lps",
      dataIndex: "totalLps",
      align: "center",
      render: renderMoney,
    },

    {
      title: "Completado",
      dataIndex: "liquidado",
      align: "center",
      render: renderTag,
    },
  ],

  Venta: [
    { title: "ID", dataIndex: "compraId" }, // Mapeado a compraId
    {
      title: "Fecha",
      sorter: (a, b) => dayjs(a.fecha).unix() - dayjs(b.fecha).unix(),
      dataIndex: "fecha",
      render: renderDate,
    },
    { title: "Producto", dataIndex: "producto" },
    {
      title: "Cantidad QQ",
      dataIndex: "cantidadQQ",
      align: "center",
      render: renderNumber,
    },
    {
      title: "Precio QQ",
      dataIndex: "precioQQ",
      align: "center",
      render: renderMoney,
    },
    {
      title: "Total Lps",
      dataIndex: "totalLps",
      align: "center",
      render: renderMoney,
    },
  ],
};

export const columns = [
  {
    title: "Tipo",
    dataIndex: "tipo",
    key: "tipo",
    render: (tipo) => <Tag color="blue">{tipo}</Tag>,
  },
  {
    title: "QQ Pendientes",
    dataIndex: "totalQQPorLiquidar",
    key: "totalQQPorLiquidar",
    align: "center",
    render: (v, record) =>
      record.tipo === "Contrato" || record.tipo === "ConfirmacionVenta"
        ? formatNumber(v || 0, 2)
        : null,
  },
  {
    title: "Entregado QQ",
    dataIndex: "totalQQ",
    key: "totalQQ",
    align: "center",
    render: (v) => formatNumber(v, 2),
  },
  {
    title: "Entregado Lps",
    dataIndex: "totalLps",
    key: "totalLps",
    align: "center",
    render: (v) => "L. " + formatNumber(v, 2),
  },
  {
    title: "Promedio Precio",
    dataIndex: "promedioPrecio",
    key: "promedioPrecio",
    align: "center",
    render: (v) => "L. " + formatNumber(v, 2),
  },
];
