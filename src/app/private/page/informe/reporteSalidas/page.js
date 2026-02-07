"use client";

import { useState, useMemo } from "react";
import { Table, Card, Typography, Divider, message } from "antd";
import EstadisticasCards from "@/components/ReportesElement/DatosEstadisticos";
import dayjs from "dayjs";
import TarjetaMobile from "@/components/TarjetaMobile";
import Filtros from "@/components/Filtros";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import { UserOutlined, CalendarOutlined } from "@ant-design/icons";
import { formatNumber } from "@/components/Formulario";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import { useFetchReport } from "@/hook/useFetchReport";
import TablaTotales from "@/components/ReportesElement/TablaTotales";
import ProtectedPage from "@/components/ProtectedPage";
import { generarReportePDF } from "@/Doc/Reportes/FormatoDocCustom";
import { rangoInicial } from "../reporteCliente/page";

const { Title, Text } = Typography;

// ---------------------------------------
// Totales con COMPRAS + SALIDAS
// ---------------------------------------
export function calcularTotalesComprador(comprador = {}) {
  const compraQQ = parseFloat(comprador.compraCantidadQQ) || 0;
  const compraLps = parseFloat(comprador.compraTotalLps) || 0;

  const salidaQQ = parseFloat(comprador.salidaCantidadQQ) || 0;
  const salidaLps = parseFloat(comprador.salidaTotalLps) || 0;

  const contratoQQ = parseFloat(comprador.contratoCantidadQQ) || 0;
  const contratoLps = parseFloat(comprador.contratoTotalLps) || 0;

  // Nuevos cálculos de pendiente
  // Pendiente Salida (ConfirmacionVenta) = Compromiso (salidaCantidadQQ) - Ejecutado (salidaEjecutadaQQ)
  const pendienteSalida =
    (parseFloat(comprador.salidaCantidadQQ) || 0) -
    (parseFloat(comprador.salidaEjecutadaQQ) || 0);

  // Según solicitud: "no tomes lo pendiente de contrato solo los de salida"
  const pendienteQQ = pendienteSalida; // + pendienteContrato;

  // Total QQ = Ejecutado (Restando pendiente)
  const totalQQ = compraQQ + salidaQQ + contratoQQ - pendienteQQ;

  // Total Lps = Comprometido (Sin restar pendiente, según solicitud "7,000,000")
  const totalLps = compraLps + salidaLps + contratoLps;

  const promedio =
    totalQQ + pendienteQQ > 0 ? totalLps / (totalQQ + pendienteQQ) : 0;

  return {
    compraQQ,
    compraLps,
    salidaQQ,
    salidaLps,
    contratoQQ,
    contratoLps,
    totalQQ,
    totalLps,
    promedio,
    pendienteQQ,
  };
}

// ---------------------------------------
// Componente principal
// ---------------------------------------
export default function ReporteCompradoresSalidas() {
  const hoy = [dayjs().startOf("day"), dayjs().endOf("day")];
  const { mounted, isDesktop } = useClientAndDesktop();
  const [nombreFiltro, setNombreFiltro] = useState("");

  const {
    data,
    loading,
    rangoFechas,
    onFechasChange,
    contextHolder,
    fetchData,
  } = useFetchReport("/api/reportes/reporteSalidas", rangoInicial);

  // ---------------------------------------
  // Filtrado + Totales
  // ---------------------------------------
  const datosFiltrados = useMemo(() => {
    return data
      .filter((item) =>
        !nombreFiltro
          ? true
          : item.nombre?.toLowerCase().includes(nombreFiltro.toLowerCase())
      )
      .map((item) => {
        const totales = calcularTotalesComprador(item);
        return { ...item, ...totales };
      });
  }, [data, nombreFiltro]);

  // ---------------------------------------
  // Estadísticas globales
  // ---------------------------------------
  const estadisticas = useMemo(() => {
    if (!datosFiltrados.length) return null;

    const resultado = datosFiltrados.reduce(
      (acc, r) => {
        acc.totalCompradores += 1;
        acc.totalQQ += r.totalQQ;
        acc.totalLps += r.totalLps;
        acc.pendienteQQ += r.pendienteQQ;
        return acc;
      },
      { totalCompradores: 0, totalQQ: 0, totalLps: 0, pendienteQQ: 0 }
    );

    resultado.promedioGeneral =
      resultado.totalQQ + resultado.pendienteQQ > 0
        ? resultado.totalLps / (resultado.totalQQ + resultado.pendienteQQ)
        : 0;

    return resultado;
  }, [datosFiltrados]);

  // ---------------------------------------
  // Columnas Desktop
  // ---------------------------------------

  const headerStyle = {
    backgroundColor: "#1890ff",
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  };

  const onHeaderCell = () => ({ style: headerStyle });

  const columnasDesktop = [
    {
      title: "ID Comprador",
      dataIndex: "compradorId",
      width: 100,
      align: "center",
      fixed: "left",
      render: (text) => <Text strong>{text}</Text>,
      onHeaderCell,
    },
    {
      title: "Nombre Comprador",
      dataIndex: "nombre",
      width: 200,
      render: (text) => <Text style={{ color: "#1890ff" }}>{text}</Text>,
      onHeaderCell,
    },
    {
      title: <span style={{ color: "#fff" }}>Totales</span>,
      onHeaderCell,
      children: [
        {
          title: "QQ",
          dataIndex: "totalQQ",
          align: "right",
          render: (_, r) => formatNumber(r.totalQQ),
          onHeaderCell,
        },
        {
          title: "Lps",
          dataIndex: "totalLps",
          align: "right",
          render: (_, r) => "L. " + formatNumber(r.totalLps),
          onHeaderCell,
        },
        {
          title: "Promedio",
          dataIndex: "promedio",
          align: "right",
          render: (_, r) => "L. " + formatNumber(r.promedio),
          onHeaderCell,
        },
      ],
    },

    // ✅ Compras
    {
      title: <span style={{ color: "#fff" }}>Venta Directa</span>,
      onHeaderCell,
      children: [
        {
          title: "QQ",
          dataIndex: "compraCantidadQQ",
          align: "right",
          render: (_, r) => formatNumber(r.compraQQ),
          onHeaderCell,
        },
        {
          title: "Total Lps",
          dataIndex: "compraTotalLps",
          align: "right",
          render: (_, r) => "L. " + formatNumber(r.compraLps),
          onHeaderCell,
        },
      ],
    },
    {
      title: <span style={{ color: "#fff" }}>Contratos</span>,
      onHeaderCell,
      children: [
        {
          title: "QQ",
          dataIndex: "contratoCantidadQQ",
          align: "right",
          render: (_, r) => formatNumber(r.contratoQQ),
          onHeaderCell,
        },
        {
          title: "Lps",
          dataIndex: "contratoTotalLps",
          align: "right",
          render: (_, r) => "L. " + formatNumber(r.contratoLps),
          onHeaderCell,
        },
      ],
    },

    // ✅ Salidas / Compromisos
    {
      title: <span style={{ color: "#fff" }}>ConfirmacionVenta</span>,
      onHeaderCell,
      children: [
        {
          title: "QQ",
          dataIndex: "salidaCantidadQQ",
          align: "right",
          render: (_, r) => formatNumber(r.salidaQQ),
          onHeaderCell,
        },
        {
          title: "Lps",
          dataIndex: "salidaTotalLps",
          align: "right",
          render: (_, r) => "L. " + formatNumber(r.salidaLps),
          onHeaderCell,
        },
      ],
    },

    // ✅ Pendiente (Nuevo)
    {
      title: <span style={{ color: "#fff" }}>Pendiente</span>,
      onHeaderCell,
      children: [
        {
          title: "QQ",
          dataIndex: "pendienteQQ",
          align: "left",
          render: (_, r) => (
            <Text type={r.pendienteQQ > 0 ? "warning" : "secondary"}>
              {r.pendienteQQ > 0 ? "-" : ""}
              {formatNumber(r.pendienteQQ)}
            </Text>
          ),
          onHeaderCell,
          onCell: () => ({
            style: { backgroundColor: "#fff0f6", fontWeight: "bold" },
          }),
        },
      ],
    },

    // ✅ Totales globales
  ];

  // ---------------------------------------
  // Columnas Mobile
  // ---------------------------------------
  const columnasMobile = [
    { label: "ID Comprador", key: "compradorId" },
    { label: "Nombre", key: "nombre" },

    // Compras
    { label: "Venta QQ", key: "compraQQ", render: (v) => formatNumber(v) },
    { label: "Venta Lps", key: "compraLps", render: (v) => formatNumber(v) },

    // Contratos
    { label: "Contrato QQ", key: "contratoQQ", render: (v) => formatNumber(v) },
    {
      label: "Contrato Lps",
      key: "contratoLps",
      render: (v) => formatNumber(v),
    },

    // Salidas
    {
      label: "ConfirmacionVenta QQ",
      key: "salidaQQ",
      render: (v) => formatNumber(v),
    },
    {
      label: "ConfirmacionVenta Lps",
      key: "salidaLps",
      render: (v) => formatNumber(v),
    },

    // Pendiente
    {
      label: "Pendiente QQ",
      key: "pendienteQQ",
      render: (v) => formatNumber(v),
    },

    // Totales
    { label: "Total QQ", key: "totalQQ", render: (v) => formatNumber(v) },
    { label: "Total Lps", key: "totalLps", render: (v) => formatNumber(v) },
    { label: "Promedio", key: "promedio", render: (v) => formatNumber(v) },
  ];

  // ---------------------------------------
  // Columnas PDF
  // ---------------------------------------
  const columnasPDF = [
    { header: "ID", key: "compradorId" },
    { header: "Nombre", key: "nombre" },

    { header: "Total QQ", key: "totalQQ", format: "numero", isCantidad: true },
    { header: "Total Lps", key: "totalLps", format: "moneda", isTotal: true },

    { header: "Promedio", key: "promedio", format: "moneda" },
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
        {contextHolder}

        <Card>
          <SectionHeader
            isDesktop={isDesktop}
            loading={loading}
            icon={<CalendarOutlined />}
            titulo="Reporte de Salidas"
            subtitulo="Resumen de ventas directas y compromisos por comprador"
            onRefresh={() => {
              fetchData(
                rangoFechas?.[0]?.startOf("day").toISOString(),
                rangoFechas?.[1]?.endOf("day").toISOString()
              );
            }}
            onExportPDF={() => {
              if (!datosFiltrados.length)
                return message.warning("No hay datos para exportar");

              generarReportePDF(
                datosFiltrados,
                {
                  fechaInicio: rangoFechas?.[0]?.toISOString(),
                  fechaFin: rangoFechas?.[1]?.toISOString(),
                  nombreFiltro,
                },
                columnasPDF,
                {
                  title: "Reporte de Salidas",
                  customPromedio: estadisticas?.promedioGeneral,
                }
              );
            }}
            disableExport={!datosFiltrados.length}
          />
          <Divider />

          <Filtros
            fields={[
              {
                type: "input",
                placeholder: "Buscar por nombre",
                value: nombreFiltro,
                setter: setNombreFiltro,
                allowClear: true,
              },
              {
                type: "date",
                value: rangoFechas,
                setter: onFechasChange,
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
                    titulo: "Compradores",
                    valor: formatNumber(estadisticas.totalCompradores),
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
            <Title level={4} style={{ margin: 0 }}>
              Detalle por Comprador ({datosFiltrados.length})
            </Title>
          </div>

          {isDesktop ? (
            <Table
              columns={columnasDesktop}
              dataSource={datosFiltrados}
              rowKey="compradorId"
              loading={loading}
              pagination={false}
              bordered
              scroll={{ x: "max-content" }}
              size="small"
              summary={() => {
                const flattenColumns = (cols) => {
                  let result = [];
                  cols.forEach((col) => {
                    if (col.children && col.children.length) {
                      result = result.concat(flattenColumns(col.children));
                    } else {
                      result.push(col);
                    }
                  });
                  return result;
                };

                const leafColumns = flattenColumns(columnasDesktop).slice(2);
                const totales = {};

                datosFiltrados.forEach((row) => {
                  leafColumns.forEach((col) => {
                    const key = col.dataIndex;
                    if (!key || key === "promedio") return;
                    const value = parseFloat(row[key]);
                    if (!isNaN(value))
                      totales[key] = (totales[key] || 0) + value;
                  });
                });

                const totalQQ = totales.totalQQ || 0;
                const totalLps = totales.totalLps || 0;
                const pendienteQQ = totales.pendienteQQ || 0;
                const promedioGeneral =
                  totalQQ + pendienteQQ > 0
                    ? totalLps / (totalQQ + pendienteQQ)
                    : 0;

                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Text strong>Total</Text>
                    </Table.Summary.Cell>
                    {leafColumns.map((col, idx) => {
                      const key = col.dataIndex;
                      let value = totales[key];

                      if (key === "promedio") {
                        value = promedioGeneral;
                      }

                      return (
                        <Table.Summary.Cell
                          key={idx}
                          index={idx + 2}
                          align="right"
                        >
                          <Text strong>
                            {col.title &&
                            col.title.toString().toLowerCase().includes("lps")
                              ? "L. "
                              : ""}
                            {formatNumber(value)}
                          </Text>
                        </Table.Summary.Cell>
                      );
                    })}
                  </Table.Summary.Row>
                );
              }}
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
