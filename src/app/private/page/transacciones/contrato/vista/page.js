"use client";

import { useState, useMemo } from "react";
import { Table, Card, Typography, Divider, message } from "antd";
import EstadisticasCards from "@/components/ReportesElement/DatosEstadisticos";
import dayjs from "dayjs";

import Filtros from "@/components/Filtros";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import { UserOutlined, CalendarOutlined } from "@ant-design/icons";
import { generarReportePDF } from "@/Doc/Reportes/FormatoDoc";
import { formatNumber } from "@/components/Formulario";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import { useFetchReport } from "@/hook/useFetchReport";
import ProtectedPage from "@/components/ProtectedPage";
import { rangoInicial } from "../../../informe/reporteCliente/page";

const { Title, Text } = Typography;

export default function ReporteContratosPendientes() {
  const hoy = [dayjs().startOf("day"), dayjs().endOf("day")];
  const { mounted, isDesktop } = useClientAndDesktop();
  const [nombreFiltro, setNombreFiltro] = useState("");
  const { data, loading, contextHolder, fetchData } = useFetchReport(
    "/api/contratos/vista",
    rangoInicial
  );

  const datosFiltrados = useMemo(() => {
    const items = Array.isArray(data) ? data : data?.pendientes || [];

    const mapClientes = new Map();

    items.forEach((item, idx) => {
      const clienteCompleto = [item.clienteNombre, item.clienteApellido]
        .filter(Boolean)
        .join(" ");
      const keyCliente = item.clienteID || clienteCompleto;

      const contrato = {
        ...item,
        key: idx,
        cliente: clienteCompleto,
        tipoCafe: item.tipoCafe || "N/A", // <- Aquí usamos el campo ya enviado por la API
      };

      if (!mapClientes.has(keyCliente)) {
        mapClientes.set(keyCliente, {
          cliente: clienteCompleto,
          clienteID: item.clienteID || idx,
          totalCantidadContrato: 0,
          totalContrato: 0,
          totalEntradas: 0,
          totalEntregado: 0,
          totalPendienteQQ: 0,
          totalPendienteLps: 0,
          contratos: [],
        });
      }

      const clienteData = mapClientes.get(keyCliente);

      clienteData.totalCantidadContrato += contrato.cantidadContrato || 0;
      clienteData.totalContrato += contrato.totalContrato || 0;
      clienteData.totalEntradas += contrato.entradas || 0;
      clienteData.totalEntregado += contrato.totalEntregado || 0;
      clienteData.totalPendienteQQ += contrato.pendiente || 0;
      clienteData.totalPendienteLps += contrato.totalPendiente || 0;

      clienteData.contratos.push(contrato);
    });

    return Array.from(mapClientes.values()).filter((cliente) =>
      !nombreFiltro
        ? true
        : cliente.cliente.toLowerCase().includes(nombreFiltro.toLowerCase())
    );
  }, [data, nombreFiltro]);

  const estadisticas = useMemo(() => {
    if (!datosFiltrados.length) return null;

    return datosFiltrados.reduce(
      (acc, cliente) => {
        acc.totalClientes += 1;

        acc.totalContratoLps += cliente.totalContrato || 0;
        acc.totalEntregadoLps += cliente.totalEntregado || 0;
        acc.totalPendienteQQ += cliente.totalPendienteQQ || 0;
        acc.totalPendienteLps += cliente.totalPendienteLps || 0;
        return acc;
      },
      {
        totalClientes: 0,

        totalContratoLps: 0,
        totalEntregadoLps: 0,
        totalPendienteQQ: 0,
        totalPendienteLps: 0,
      }
    );
  }, [datosFiltrados]);

  // -----------------------
  // Columnas principales (Clientes)
  // -----------------------
  const columnasClientes = [
    {
      title: "Cliente",
      dataIndex: "cliente",
      width: 200,
      render: (text) => <Text style={{ color: "#1890ff" }}>{text}</Text>,
    },

    {
      title: "Cantidad Total (QQ)",
      dataIndex: "totalCantidadContrato",
      align: "right",
      render: (_, r) => <Text>{formatNumber(r.totalCantidadContrato)}</Text>,
    },
    {
      title: "Total Contratos (Lps)",
      dataIndex: "totalContrato",
      align: "right",
      render: (_, r) => <Text>L. {formatNumber(r.totalContrato)}</Text>,
    },
    {
      title: "Pendientes (QQ)",
      dataIndex: "totalPendienteQQ",
      align: "right",
      render: (_, r) => (
        <Text
          strong
          style={{ color: r.totalPendienteQQ > 0 ? "#faad14" : "#52c41a" }}
        >
          {formatNumber(r.totalPendienteQQ)}
        </Text>
      ),
    },
    {
      title: "Total Pendiente (Lps)",
      dataIndex: "totalPendienteLps",
      align: "right",
      render: (_, r) => <Text>L. {formatNumber(r.totalPendienteLps)}</Text>,
    },
  ];

  // -----------------------
  // Columnas expandibles (Contratos de cada cliente)
  // -----------------------
  const columnasContratos = [
    {
      title: "ID Contrato",
      dataIndex: "contratoID",
      width: 100,
      align: "center",
      render: (text) => <Text strong>{text}</Text>,
    },
    { title: "Tipo de Café", dataIndex: "tipoCafe" },
    {
      title: "Cantidad (QQ)",
      dataIndex: "cantidadContrato",
      align: "right",
      render: (_, r) => <Text>{formatNumber(r.cantidadContrato)}</Text>,
    },
    {
      title: "Precio (Lps)",
      dataIndex: "precio",
      align: "right",
      render: (_, r) => <Text>L. {formatNumber(r.precio)}</Text>,
    },
    {
      title: "Total Contrato (Lps)",
      dataIndex: "totalContrato",
      align: "right",
      render: (_, r) => <Text>L. {formatNumber(r.totalContrato)}</Text>,
    },
    {
      title: "Entradas (QQ)",
      dataIndex: "entradas",
      align: "right",
      render: (_, r) => <Text>{formatNumber(r.entradas)}</Text>,
    },
    {
      title: "Total Entregado (Lps)",
      dataIndex: "totalEntregado",
      align: "right",
      render: (_, r) => <Text>L. {formatNumber(r.totalEntregado)}</Text>,
    },
    {
      title: "Pendiente (QQ)",
      dataIndex: "pendiente",
      align: "right",
      render: (_, r) => (
        <Text strong style={{ color: r.pendiente > 0 ? "#faad14" : "#52c41a" }}>
          {formatNumber(r.pendiente)}
        </Text>
      ),
    },
    {
      title: "Total Pendiente (Lps)",
      dataIndex: "totalPendiente",
      align: "right",
      render: (_, r) => <Text>L. {formatNumber(r.totalPendiente)}</Text>,
    },
  ];

  if (!mounted) return null;

  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS", "AUDITORES"]}
    >
      <div
        style={{
          padding: isDesktop ? 24 : 12,
          background: "#f5f5f5",
          minHeight: "100vh",
        }}
      >
        {contextHolder}

        <Card>
          <SectionHeader
            isDesktop={isDesktop}
            loading={loading}
            icon={<CalendarOutlined />}
            titulo="Reporte de Contratos Pendientes"
            subtitulo="Contratos donde aún falta entregar café"
            onRefresh={() => fetchData()}
            onExportPDF={() => {
              if (!datosFiltrados.length) {
                message.warning("No hay datos para exportar");
                return;
              }

              // Preparar todos los contratos de todos los clientes
              const datosContratos = datosFiltrados.flatMap((cliente) =>
                cliente.contratos.map((c) => ({
                  cliente: cliente.cliente,
                  contratoID: c.contratoID,
                  tipoCafe: c.tipoCafe,
                  cantidadContrato: Number(c.cantidadContrato),
                  totalContrato: Number(c.totalContrato),
                  entradas: Number(c.entradas),
                  totalEntregado: Number(c.totalEntregado),
                  pendiente: Number(c.pendiente),
                  totalPendiente: Number(c.totalPendiente),
                }))
              );

              // Generar PDF
              generarReportePDF(
                datosContratos,
                { nombreFiltro },
                [
                  { header: "Cliente", key: "cliente" },
                  { header: "Contrato", key: "contratoID" },
                  { header: "Tipo de Café", key: "tipoCafe" },
                  {
                    header: "Cantidad (QQ)",
                    key: "cantidadContrato",
                    format: "numero",
                    isCantidad: true,
                  },
                  {
                    header: "Total Contrato (Lps)",
                    key: "totalContrato",
                    format: "moneda",
                    isTotal: true,
                  },
                  {
                    header: "Entradas (QQ)",
                    key: "entradas",
                    format: "numero",
                    isCantidad: true,
                  },
                  {
                    header: "Total Entregado (Lps)",
                    key: "totalEntregado",
                    format: "moneda",
                    isTotal: true,
                  },
                  {
                    header: "Pendiente (QQ)",
                    key: "pendiente",
                    format: "numero",
                    isCantidad: true,
                  },
                  {
                    header: "Total Pendiente (Lps)",
                    key: "totalPendiente",
                    format: "moneda",
                    isTotal: true,
                  },
                ],
                { title: "Reporte de Contratos Pendientes" }
              );
            }}
            disableExport={!datosFiltrados.length}
          />

          <Divider />

          <Filtros
            fields={[
              {
                type: "input",
                placeholder: "Buscar por nombre de cliente",
                value: nombreFiltro,
                setter: setNombreFiltro,
                allowClear: true,
              },
            ]}
          />

          {estadisticas && (
            <>
              <Divider />
              <EstadisticasCards
                isDesktop={isDesktop}
                data={[
                  {
                    titulo: "Total Pendiente (QQ)",
                    valor: formatNumber(estadisticas.totalPendienteQQ),
                    prefix: "QQ.",
                    color: "#faad14",
                  },
                  {
                    titulo: "Total Pendiente (Lps)",
                    valor: formatNumber(estadisticas.totalPendienteLps),
                    prefix: "L.",
                    color: "#faad14",
                  },
                  {
                    titulo: "Total Entregado (Lps)",
                    valor: formatNumber(estadisticas.totalEntregadoLps),
                    prefix: "L.",
                    color: "#52c41a",
                  },
                  {
                    titulo: "Total Contratos (Lps)",
                    valor: formatNumber(estadisticas.totalContratoLps),
                    prefix: "L.",
                    color: "#1890ff",
                  },
                ]}
              />
            </>
          )}
        </Card>

        <Card style={{ borderRadius: 6, marginTop: 16 }}>
          <Table
            columns={columnasClientes}
            dataSource={datosFiltrados} // array de clientes con sus contratos
            rowKey="clienteID"
            expandable={{
              expandedRowRender: (cliente) => (
                <Table
                  columns={columnasContratos}
                  dataSource={cliente.contratos} // los contratos de ese cliente
                  pagination={false}
                  rowKey={(c) => c.contratoID}
                  size="small"
                />
              ),
            }}
            loading={loading}
            pagination={false}
            bordered
            scroll={{ x: "max-content" }}
            size="small"
          />
        </Card>
      </div>
    </ProtectedPage>
  );
}
