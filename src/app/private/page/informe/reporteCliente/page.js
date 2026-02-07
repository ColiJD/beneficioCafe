"use client";

import { useState, useMemo } from "react";
import { Table, Card, Typography, Divider } from "antd";
import EstadisticasCards from "@/components/ReportesElement/DatosEstadisticos";
import dayjs from "dayjs";
import TarjetaMobile from "@/components/TarjetaMobile";
import Filtros from "@/components/Filtros";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import { UserOutlined, CalendarOutlined } from "@ant-design/icons";
import { generarReportePDF } from "@/Doc/Reportes/FormatoDoc";
import { formatNumber } from "@/components/Formulario";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import { useFetchReport } from "@/hook/useFetchReport";
import TablaTotales from "@/components/ReportesElement/TablaTotales";

import ProtectedPage from "@/components/ProtectedPage";

const { Title, Text } = Typography;

export function calcularTotalesCliente(cliente = {}) {
  const depositoPendienteQQ =
    (parseFloat(cliente.totalDepositosQQ) || 0) -
    (parseFloat(cliente.depositoCantidadQQ) || 0);

  const totalQQ =
    (parseFloat(cliente.compraCantidadQQ) || 0) +
    (parseFloat(cliente.contratoCantidadQQ) || 0) +
    (parseFloat(cliente.depositoCantidadQQ) || 0) +
    depositoPendienteQQ;

  const totalLps =
    (parseFloat(cliente.compraTotalLps) || 0) +
    (parseFloat(cliente.contratoTotalLps) || 0) +
    (parseFloat(cliente.depositoTotalLps) || 0);

  const promedio = totalLps / totalQQ;

  return { totalQQ, totalLps, promedio, depositoPendienteQQ };
}
const inicioAnio = dayjs().subtract(1, "year").startOf("year");
const finAnio = dayjs().endOf("year");

export const rangoInicial = [inicioAnio, finAnio];
export default function ReporteClientesEntradas() {
  const { mounted, isDesktop } = useClientAndDesktop();
  const [nombreFiltro, setNombreFiltro] = useState("");
  const {
    data,
    loading,
    rangoFechas,
    onFechasChange,
    contextHolder,
    fetchData,
  } = useFetchReport("/api/reportes/reporteCliente", rangoInicial);

  const datosFiltrados = useMemo(() => {
    return data
      .filter((item) =>
        !nombreFiltro
          ? true
          : item.nombre?.toLowerCase().includes(nombreFiltro.toLowerCase())
      )
      .map((item) => {
        const { totalQQ, totalLps, depositoPendienteQQ } =
          calcularTotalesCliente(item);

        // Promedio por cliente = totalLps / totalQQ (si hay cantidad)
        const promediocalculado =
          totalQQ && totalQQ > 0 ? totalLps / totalQQ : 0;

        return {
          ...item,
          totalQQ,
          totalLps,
          promediocalculado,
          depositoPendienteQQ,
        };
      });
  }, [data, nombreFiltro]);

  const estadisticas = useMemo(() => {
    if (!datosFiltrados.length) return null;

    const resultado = datosFiltrados.reduce(
      (acc, cliente) => {
        const { totalQQ, totalLps } = calcularTotalesCliente(cliente);

        acc.totalClientes += 1;
        acc.totalQQ += totalQQ;
        acc.totalLps += totalLps;

        return acc;
      },
      { totalClientes: 0, totalQQ: 0, totalLps: 0 }
    );

    // Promedio general ponderado
    resultado.promedioGeneral =
      resultado.totalQQ > 0 ? resultado.totalLps / resultado.totalQQ : 0;

    return resultado;
  }, [datosFiltrados]);

  // utils/totalesCliente.js

  // Estilo compartido para encabezados
  const headerStyle = {
    backgroundColor: "#1890ff",
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  };

  const onHeaderCell = () => ({ style: headerStyle });

  const columnasDesktop = [
    {
      title: "ID Cliente",
      dataIndex: "clienteID",
      width: 100,
      align: "center",
      fixed: "left",
      render: (text) => <Text strong>{text}</Text>,
      onHeaderCell,
    },
    {
      title: "Nombre Cliente",
      dataIndex: "nombre",
      width: 150,
      render: (text) => <Text style={{ color: "#1890ff" }}>{text}</Text>,
      onHeaderCell,
    },
    {
      title: <span style={{ color: "#fff" }}>Totales</span>,
      align: "center",
      onHeaderCell,
      children: [
        {
          title: "QQ",
          key: "totalQQ",
          dataIndex: "totalQQ",
          align: "right",
          onHeaderCell,
          render: (_, r) => {
            const { totalQQ } = calcularTotalesCliente(r);
            return (
              <Text strong type={totalQQ > 0 ? "success" : "secondary"}>
                {formatNumber(totalQQ)}
              </Text>
            );
          },
        },
        {
          title: "Lps",
          key: "totalLps",
          dataIndex: "totalLps",
          align: "right",
          onHeaderCell,
          render: (_, r) => {
            const { totalLps } = calcularTotalesCliente(r);
            return (
              <Text strong type={totalLps > 0 ? "success" : "secondary"}>
                L. {formatNumber(totalLps)}
              </Text>
            );
          },
        },
        {
          title: "Promedio",
          key: "promedio",
          align: "right",
          dataIndex: "promediocalculado",
          onHeaderCell,
          render: (_, r) => {
            const { promedio } = calcularTotalesCliente(r);
            return (
              <Text strong type={promedio > 0 ? "success" : "secondary"}>
                L. {formatNumber(promedio)}
              </Text>
            );
          },
        },
      ],
    },
    {
      title: <span style={{ color: "#fff" }}>Compra</span>,
      onHeaderCell,
      children: [
        {
          title: "QQ",
          dataIndex: "compraCantidadQQ",
          align: "right",
          onHeaderCell,
          render: (_, r) => (
            <Text type={r.compraCantidadQQ > 0 ? "success" : "secondary"}>
              {formatNumber(r.compraCantidadQQ)}
            </Text>
          ),
        },
        {
          title: "Total Lps",
          dataIndex: "compraTotalLps",
          align: "right",
          onHeaderCell,
          render: (_, r) => (
            <Text strong type={r.compraTotalLps > 0 ? "success" : "secondary"}>
              L. {formatNumber(r.compraTotalLps)}
            </Text>
          ),
        },
      ],
    },
    {
      title: <span style={{ color: "#fff" }}>Contrato</span>,
      onHeaderCell,
      children: [
        {
          title: "QQ",
          dataIndex: "contratoCantidadQQ",
          align: "right",
          onHeaderCell,
          render: (_, r) => (
            <Text type={r.contratoCantidadQQ > 0 ? "success" : "secondary"}>
              {formatNumber(r.contratoCantidadQQ)}
            </Text>
          ),
        },
        {
          title: "Total Lps",
          dataIndex: "contratoTotalLps",
          align: "right",
          onHeaderCell,
          render: (_, r) => (
            <Text
              strong
              type={r.contratoTotalLps > 0 ? "success" : "secondary"}
            >
              L. {formatNumber(r.contratoTotalLps)}
            </Text>
          ),
        },
      ],
    },
    {
      title: <span style={{ color: "#fff" }}>Depósito</span>,
      onHeaderCell,
      children: [
        {
          title: "QQ",
          dataIndex: "depositoCantidadQQ",
          align: "right",
          onHeaderCell,
          render: (_, r) => (
            <Text type={r.depositoCantidadQQ > 0 ? "success" : "secondary"}>
              {formatNumber(r.depositoCantidadQQ)}
            </Text>
          ),
        },
        {
          title: "Total Lps",
          dataIndex: "depositoTotalLps",
          align: "right",
          onHeaderCell,
          render: (_, r) => (
            <Text
              strong
              type={r.depositoTotalLps > 0 ? "success" : "secondary"}
            >
              L. {formatNumber(r.depositoTotalLps)}
            </Text>
          ),
        },
      ],
    },
    {
      title: <span style={{ color: "#fff" }}>Depósito Pendiente</span>,
      onHeaderCell,
      children: [
        {
          title: "QQ",
          dataIndex: "depositoPendienteQQ",
          align: "left",
          onHeaderCell,
          render: (_, r) => (
            <Text type={r.depositoPendienteQQ > 0 ? "success" : "secondary"}>
              {formatNumber(r.depositoPendienteQQ)}
            </Text>
          ),
          onCell: () => ({
            style: { backgroundColor: "#fff0f6", fontWeight: "bold" },
          }),
        },
      ],
    },
  ];

  const columnasMobile = [
    { label: "ID Cliente", key: "clienteID" },
    { label: "Nombre", key: "nombre" },
    {
      label: "Compra QQ",
      key: "compraCantidadQQ",
      render: (v) => formatNumber(v),
    },
    {
      label: "Compra Lps",
      key: "compraTotalLps",
      render: (v) => formatNumber(v),
    },
    {
      label: "Contrato QQ",
      key: "contratoCantidadQQ",
      render: (v) => formatNumber(v),
    },
    {
      label: "Contrato Lps",
      key: "contratoTotalLps",
      render: (v) => formatNumber(v),
    },
    {
      label: "Depósito QQ",
      key: "depositoCantidadQQ",
      render: (v) => formatNumber(v),
    },
    {
      label: "Depósito Lps",
      key: "depositoTotalLps",
      render: (v) => formatNumber(v),
    },
    {
      label: "Depósito Pendiente QQ",
      key: "depositoPendienteQQ",
      render: (v) => formatNumber(v),
    },
    { label: "Total QQ", key: "totalQQ", render: (v) => formatNumber(v) },
    { label: "Total Lps", key: "totalLps", render: (v) => formatNumber(v) },
  ];

  if (!mounted) return null;

  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS", "AUDITORES"]}
    >
      <div
        style={{
          padding: isDesktop ? "24px" : "12px",
          background: "#f5f5f5",
          minHeight: "100vh",
        }}
      >
        {/* Context Holder de message */}
        {contextHolder}

        {/* Header */}
        <Card>
          <SectionHeader
            isDesktop={isDesktop}
            loading={loading}
            icon={<CalendarOutlined />}
            titulo="Reporte de Entradas"
            subtitulo="Resumen de actividades por cliente"
            onRefresh={() => {
              if (rangoFechas && rangoFechas[0] && rangoFechas[1]) {
                fetchData(
                  rangoFechas[0].startOf("day").toISOString(),
                  rangoFechas[1].endOf("day").toISOString()
                );
              } else {
                fetchData();
              }
            }}
            onExportPDF={() => {
              if (!datosFiltrados.length) {
                // Mensaje opcional
                message.warning("No hay datos para exportar");
                return;
              }
              generarReportePDF(
                datosFiltrados,
                {
                  fechaInicio: rangoFechas?.[0]?.toISOString(),
                  fechaFin: rangoFechas?.[1]?.toISOString(),
                  nombreFiltro,
                },
                [
                  { header: "ID Cliente", key: "clienteID" },
                  { header: "Nombre", key: "nombre" },

                  {
                    header: "Total QQ",
                    key: "totalQQ",
                    format: "numero",
                    isCantidad: true,
                  },
                  {
                    header: "Total Lps",
                    key: "totalLps",
                    format: "moneda",
                    isTotal: true,
                  },
                  {
                    header: "Promedio",
                    key: "promediocalculado",
                    format: "moneda",
                  },
                ],
                { title: "Reporte de Entradas" }
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
              {
                type: "date",
                value: rangoFechas,
                setter: onFechasChange,
                placeholder: "Seleccionar rango de fechas",
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
                    titulo: "Clientes",
                    valor: formatNumber(estadisticas.totalClientes),
                    icon: <UserOutlined style={{ color: "#1890ff" }} />,
                    color: "#1890ff",
                  },
                  {
                    titulo: "Total Quintales",
                    valor: formatNumber(estadisticas.totalQQ),
                    prefix: "QQ.",
                    color: "#52c41a",
                  },
                  {
                    titulo: "Total Lempiras",
                    valor: formatNumber(estadisticas.totalLps),
                    prefix: "L.",
                    color: "#1890ff",
                  },
                  {
                    titulo: "Promedio General",
                    valor: formatNumber(estadisticas.promedioGeneral),
                    prefix: "L.",
                    color: "#faad14",
                  },
                ]}
              />
            </>
          )}
        </Card>

        <Card style={{ borderRadius: 6 }}>
          <div style={{ marginBottom: isDesktop ? 16 : 12 }}>
            <Title
              level={4}
              style={{ margin: 0, fontSize: isDesktop ? 16 : 14 }}
            >
              Detalle por Cliente ({datosFiltrados.length} registros)
            </Title>
            <Text type="secondary" style={{ fontSize: isDesktop ? 14 : 12 }}>
              {rangoFechas?.[0] &&
                rangoFechas?.[1] &&
                `Período: ${rangoFechas[0].format(
                  "DD/MM/YYYY"
                )} - ${rangoFechas[1].format("DD/MM/YYYY")}`}
            </Text>
          </div>

          {isDesktop ? (
            <Table
              columns={columnasDesktop}
              dataSource={datosFiltrados}
              rowKey="clienteID"
              loading={loading}
              pagination={false}
              bordered
              scroll={{ x: "max-content" }}
              size="small"
              summary={() => (
                <TablaTotales
                  columns={columnasDesktop}
                  data={datosFiltrados}
                  offset={2} // columnas ID y Nombre no suman
                  formatNumber={formatNumber}
                />
              )}
            />
          ) : (
            <TarjetaMobile
              data={datosFiltrados}
              columns={columnasMobile}
              loading={loading}
            />
          )}
        </Card>
      </div>
    </ProtectedPage>
  );
}
