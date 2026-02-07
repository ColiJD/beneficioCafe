"use client";

import { useState, useMemo } from "react";
import { Table, Card, Typography, Divider } from "antd";
import { UserOutlined, CalendarOutlined } from "@ant-design/icons";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import Filtros from "@/components/Filtros";
import EstadisticasCards from "@/components/ReportesElement/DatosEstadisticos";
import TarjetaMobile from "@/components/TarjetaMobile";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import { useFetchReport } from "@/hook/useFetchReport";
import { exportPDFClientes } from "@/Doc/Reportes/ClientesRegistrados";
import ProtectedPage from "@/components/ProtectedPage";

const { Title, Text } = Typography;

export default function ReporteClientes() {
  const { mounted, isDesktop } = useClientAndDesktop();
  const [nombreFiltro, setNombreFiltro] = useState("");

  // Hook para traer clientes
  const {
    data,
    loading,
    rangoFechas,
    onFechasChange,
    contextHolder,
    fetchData,
  } = useFetchReport("/api/clientes");

  // Filtrado por nombre
  const datosFiltrados = useMemo(() => {
    return data.filter((item) =>
      !nombreFiltro
        ? true
        : `${item.clienteNombre} ${item.clienteApellido}`
            ?.toLowerCase()
            .includes(nombreFiltro.toLowerCase())
    );
  }, [data, nombreFiltro]);

  // Estadísticas simples
  const estadisticas = useMemo(() => {
    if (!datosFiltrados.length) return null;
    return {
      totalClientes: datosFiltrados.length,
    };
  }, [datosFiltrados]);

  // Columnas principales visibles
  const columnasDesktop = [
    {
      title: "ID Cliente",
      dataIndex: "clienteID",
      width: 90,
      align: "center",
      fixed: "left",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "Nombre",
      render: (_, r) => (
        <Text style={{ color: "#1890ff" }}>
          {r.clienteNombre} {r.clienteApellido}
        </Text>
      ),
    },
    { title: "Teléfono", dataIndex: "clienteTelefono" },
    { title: "Cédula", dataIndex: "clienteCedula" },
    { title: "Departamento", dataIndex: "clienteDepartament" },
  ];

  // Configuración para expandir y mostrar más info
  const expandable = {
    expandedRowRender: (record) => (
      <div style={{ padding: "8px 16px" }}>
        <p>
          <b>RTN:</b> {record.clienteRTN || "N/A"}
        </p>
        <p>
          <b>Dirección:</b> {record.clienteDirecion || "N/A"}
        </p>
        <p>
          <b>Municipio:</b> {record.clienteMunicipio || "N/A"}
        </p>
        <p>
          <b>IHCAFE:</b> {record.claveIHCAFE || "N/A"}
        </p>
      </div>
    ),
    rowExpandable: (record) =>
      record.clienteRTN ||
      record.clienteDirecion ||
      record.clienteMunicipio ||
      record.claveIHCAFE,
  };

  // Versión mobile: mostramos los mismos principales
  const columnasMobile = [
    { label: "ID", key: "clienteID" },
    { label: "Nombre", key: "clienteNombre" },
    { label: "Apellido", key: "clienteApellido" },
    { label: "Teléfono", key: "clienteTelefono" },
    { label: "Cédula", key: "clienteCedula" },
    { label: "Departamento", key: "clienteDepartament" },
  ];

  if (!mounted) return null;

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS"]}>
      <div
        style={{
          padding: isDesktop ? "24px" : "12px",
          background: "#f5f5f5",
          minHeight: "100vh",
        }}
      >
        {contextHolder}

        {/* Header */}
        <Card>
          <SectionHeader
            isDesktop={isDesktop}
            loading={loading}
            icon={<CalendarOutlined />}
            titulo="Clientes Registrados"
            subtitulo="Listado completo de clientes"
            onRefresh={() => fetchData()}
            onExportPDF={() =>
              exportPDFClientes(
                datosFiltrados,
                {
                  nombreFiltro,
                },
                columnasDesktop,
                { title: "Clientes Registrados" }
              )
            }
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
                    titulo: "Clientes",
                    valor: estadisticas.totalClientes,
                    icon: <UserOutlined style={{ color: "#1890ff" }} />,
                    color: "#1890ff",
                  },
                ]}
              />
            </>
          )}
        </Card>

        {/* Tabla */}
        <Card style={{ borderRadius: 6 }}>
          <div style={{ marginBottom: isDesktop ? 16 : 12 }}>
            <Title
              level={4}
              style={{ margin: 0, fontSize: isDesktop ? 16 : 14 }}
            >
              Detalle de Clientes ({datosFiltrados.length} registros)
            </Title>
          </div>

          {isDesktop ? (
            <Table
              columns={columnasDesktop}
              dataSource={datosFiltrados}
              rowKey="clienteID"
              loading={loading}
              bordered
              scroll={{ x: "max-content" }}
              size="small"
              expandable={expandable}
              pagination={{
                showTotal: (total, range) => (
                  <Text type="secondary">
                    {range[0]}-{range[1]} de {total} registros
                  </Text>
                ),
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
