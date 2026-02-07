"use client";

import { useState, useMemo } from "react";
import { Table, Card, Typography, Divider, message } from "antd";
import dayjs from "dayjs";

import ProtectedPage from "@/components/ProtectedPage";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import { useFetchReport } from "@/hook/useFetchReport";

import Filtros from "@/components/Filtros";
import TablaTotales from "@/components/ReportesElement/TablaTotales";
import TarjetaMobile from "@/components/TarjetaMobile";
import EstadisticasCards from "@/components/ReportesElement/DatosEstadisticos";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";

import { formatNumber } from "@/components/Formulario";
import { generarReportePDF } from "@/Doc/Reportes/FormatoDoc";
import { rangoInicial } from "../reporteCliente/page";

const { Title, Text } = Typography;

// --------------------------------------------------------------
// Componente principal
// --------------------------------------------------------------
export default function ReporteClientes() {
  const { mounted, isDesktop } = useClientAndDesktop();
  const [nombreFiltro, setNombreFiltro] = useState("");

  const {
    data,
    loading,
    rangoFechas,
    onFechasChange,
    contextHolder,
    fetchData,
  } = useFetchReport("/api/reportes/reportePrestamos", rangoInicial);

  // Filtrar y calcular totales
  const datosFiltrados = useMemo(() => {
    const clientesArray = data?.clientes ?? [];

    return clientesArray.filter((item) =>
      !nombreFiltro
        ? true
        : item.nombre?.toLowerCase().includes(nombreFiltro.toLowerCase())
    );
  }, [data, nombreFiltro]);

  // Totales globales (ahora incluye los 6 valores)
  const estadisticas = useMemo(() => {
    if (!datosFiltrados.length) return null;
    return datosFiltrados.reduce(
      (acc, c) => {
        acc.totalActivoPrestamo += c.activoPrestamo;
        acc.totalAbonoPrestamo += c.abonoPrestamo;
        acc.totalSaldoPrestamo += c.saldoPrestamo;
        acc.totalActivoAnticipo += c.activoAnticipo;
        acc.totalAbonoAnticipo += c.abonoAnticipo;
        acc.totalSaldoAnticipo += c.saldoAnticipo;
        return acc;
      },
      {
        clientes: 0,
        totalActivoPrestamo: 0,
        totalAbonoPrestamo: 0,
        totalSaldoPrestamo: 0,
        totalActivoAnticipo: 0,
        totalAbonoAnticipo: 0,
        totalSaldoAnticipo: 0,
      }
    );
  }, [datosFiltrados]);

  // Columnas Desktop
  const columnasDesktop = [
    {
      title: "ID Cliente",
      dataIndex: "clienteID",

      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: "Nombre Cliente",
      dataIndex: "nombre",
      render: (v) => <Text style={{ color: "#1677ff" }}>{v}</Text>,
    },
    {
      title: "Préstamos",
      children: [
        {
          title: "Activos",
          dataIndex: "activoPrestamo",
          align: "right",
          render: (v) => "L. " + formatNumber(v),
        },
        {
          title: "Abonos",
          dataIndex: "abonoPrestamo",
          align: "right",
          render: (v) => "L. " + formatNumber(v),
        },
        {
          title: "Saldo",
          dataIndex: "saldoPrestamo",
          align: "right",
          render: (v) => "L. " + formatNumber(v),
        },
      ],
    },
    {
      title: "Anticipos",
      children: [
        {
          title: "Activos",
          dataIndex: "activoAnticipo",
          align: "right",
          render: (v) => "L. " + formatNumber(v),
        },
        {
          title: "Abonos",
          dataIndex: "abonoAnticipo",
          align: "right",
          render: (v) => "L. " + formatNumber(v),
        },
        {
          title: "Saldo",
          dataIndex: "saldoAnticipo",
          align: "right",
          render: (v) => "L. " + formatNumber(v),
        },
      ],
    },
  ];

  // Columnas PDF
  const columnasPDF = [
    { header: "ID", key: "clienteID" },
    { header: "Nombre", key: "nombre" },
    {
      header: "Prest. Activos",
      key: "activoPrestamo",
      format: "moneda",
      isTotal: true,
    },
    {
      header: "Abonos Prest.",
      key: "abonoPrestamo",
      format: "moneda",
      isTotal: true,
    },
    {
      header: "Saldo Prest.",
      key: "saldoPrestamo",
      format: "moneda",
      isTotal: true,
    },
    {
      header: "Antic. Activos",
      key: "activoAnticipo",
      format: "moneda",
      isTotal: true,
    },
    {
      header: "Abonos Antic.",
      key: "abonoAnticipo",
      format: "moneda",
      isTotal: true,
    },
    {
      header: "Saldo Antic.",
      key: "saldoAnticipo",
      format: "moneda",
      isTotal: true,
    },
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
            titulo="Reporte de Préstamos y Anticipos"
            subtitulo="Préstamos, anticipos y movimientos por cliente"
            onRefresh={() =>
              fetchData(
                rangoFechas?.[0]?.toISOString(),
                rangoFechas?.[1]?.toISOString()
              )
            }
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
                { title: "Reporte Prestamos y Anticipos" }
              );
            }}
            disableExport={!datosFiltrados.length}
          />

          <Divider />

          <Filtros
            fields={[
              {
                type: "input",
                placeholder: "Buscar cliente",
                value: nombreFiltro,
                setter: setNombreFiltro,
                allowClear: true,
              },
              { type: "date", value: rangoFechas, setter: onFechasChange },
            ]}
          />

          {estadisticas && (
            <>
              <Divider />
              <EstadisticasCards
                isDesktop={isDesktop}
                data={[
                  {
                    titulo: "Activos Prestamo",
                    valor: formatNumber(estadisticas.totalActivoPrestamo),
                    prefix: "L.",
                    color: "#52c41a",
                  },
                  {
                    titulo: "Abonos Prestamo",
                    valor: formatNumber(estadisticas.totalAbonoPrestamo),
                    prefix: "L.",
                    color: "#1890ff",
                  },
                  {
                    titulo: "Saldo Prestamo",
                    valor: formatNumber(estadisticas.totalSaldoPrestamo),
                    prefix: "L.",
                    color: "#faad14",
                  },
                  {
                    titulo: "Activos Anticipo",
                    valor: formatNumber(estadisticas.totalActivoAnticipo),
                    prefix: "L.",
                    color: "#52c41a",
                  },
                  {
                    titulo: "Abonos Anticipo",
                    valor: formatNumber(estadisticas.totalAbonoAnticipo),
                    prefix: "L.",
                    color: "#1890ff",
                  },
                  {
                    titulo: "Saldo Anticipo",
                    valor: formatNumber(estadisticas.totalSaldoAnticipo),
                    prefix: "L.",
                    color: "#faad14",
                  },
                ]}
              />
            </>
          )}
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Title level={4}>
            Detalle de Préstamos y Anticipos ({datosFiltrados.length})
          </Title>

          <Table
            columns={columnasDesktop}
            dataSource={datosFiltrados}
            rowKey="clienteID"
            loading={loading}
            pagination={false}
            scroll={{ x: "max-content" }}
            bordered
            summary={() => (
              <TablaTotales
                columns={columnasDesktop}
                data={datosFiltrados}
                offset={2} // las primeras 2 columnas son ID y nombre
                formatNumber={formatNumber}
              />
            )}
          />
        </Card>
      </div>
    </ProtectedPage>
  );
}
