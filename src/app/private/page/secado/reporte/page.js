"use client";
import { useState, useEffect, useRef } from "react";
import {
  message,
  Button,
  Space,
  Table,
  Tag,
  Card,
  Statistic,
  Typography,
  Row,
  Col,
  DatePicker,
  Select,
  Divider,
  Grid,
} from "antd";
import {
  FileTextOutlined,
  SearchOutlined,
  ClearOutlined,
  DashboardOutlined,
  DropboxOutlined,
  FireOutlined,
  CalendarOutlined,
  NumberOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { obtenerSecadorasSelect } from "@/lib/consultas";
import { exportarSecadoPDF } from "./exportarPDF";
import ProtectedPage from "@/components/ProtectedPage";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

export default function PageReporteSecado() {
  const screens = useBreakpoint();
  const [reportData, setReportData] = useState([]);
  const [secadoras, setSecadoras] = useState([
    { value: "all", label: "Todas las Secadoras" },
  ]);
  const [secadoraId, setSecadoraId] = useState("all");
  const [dateRange, setDateRange] = useState([]);
  const [estado, setEstado] = useState("all");
  const [loading, setLoading] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();
  const messageApiRef = useRef(messageApi);

  const cargarSecadoras = async () => {
    try {
      const data = await obtenerSecadorasSelect(messageApiRef.current);
      setSecadoras([{ value: "all", label: "Todas las Secadoras" }, ...data]);
    } catch (err) {
      console.error(err);
    }
  };

  const generarReporte = async () => {
    setLoading(true);
    let url = `/api/secado/reporte?secadoraId=${secadoraId}&estado=${estado}`;
    if (dateRange && dateRange.length === 2) {
      url += `&startDate=${dateRange[0].startOf("day").toISOString()}&endDate=${dateRange[1].endOf("day").toISOString()}`;
    }

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
        messageApi.success(`${data.length} registros encontrados`);
      } else {
        messageApi.error("Error al obtener datos");
      }
    } catch {
      messageApi.error("Error de red");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSecadoras();
    generarReporte();
  }, [secadoraId, dateRange, estado]);

  const stats = {
    totalQQEntrada: reportData.reduce(
      (acc, r) => acc + (parseFloat(r.cantidadEntradaQQ) || 0),
      0,
    ),
    totalQQSalida: reportData.reduce(
      (acc, r) => acc + (parseFloat(r.cantidadSalidaQQ) || 0),
      0,
    ),
    totalProcesos: reportData.length,
    enProceso: reportData.filter((r) => r.estado === "En Proceso").length,
    finalizados: reportData.filter((r) => r.estado === "Finalizado").length,
  };

  const columnas = [
    {
      title: "#ID",
      dataIndex: "secadoId",
      key: "secadoId",
      width: 70,
      align: "center",
      render: (id) => <Text strong>#{id}</Text>,
    },
    {
      title: "Secadora",
      dataIndex: ["secadora", "nombre"],
      key: "secadora",
      render: (nombre) => <Text strong>{nombre}</Text>,
    },
    {
      title: "Fechas (Inicio / Fin)",
      key: "fechas",
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text small style={{ fontSize: "12px" }}>
            <CalendarOutlined style={{ marginRight: "4px" }} />
            {dayjs(r.fechaInicio).format("DD/MM/YYYY HH:mm")}
          </Text>
          {r.fechaFin ? (
            <Text type="success" style={{ fontSize: "12px" }}>
              <CalendarOutlined style={{ marginRight: "4px" }} />
              {dayjs(r.fechaFin).format("DD/MM/YYYY HH:mm")}
            </Text>
          ) : (
            <Text type="secondary" italic style={{ fontSize: "12px" }}>
              Aún en proceso
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Producto",
      dataIndex: ["producto", "productName"],
      key: "producto",
    },
    {
      title: "Control de Pesos (QQ)",
      key: "pesos",
      align: "right",
      render: (_, r) => (
        <Space direction="vertical" align="end" size={0}>
          <Text strong style={{ color: "#4f46e5" }}>
            Entrada: {r.cantidadEntradaQQ} QQ
          </Text>
          {r.cantidadSalidaQQ && (
            <Text strong style={{ color: "#16a34a" }}>
              Salida: {r.cantidadSalidaQQ} QQ
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Humedad (%)",
      key: "humedad",
      align: "center",
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Tag color="blue">{r.humedadInicial || 0}%</Tag>
          {r.humedadFinal && <Tag color="green">{r.humedadFinal}%</Tag>}
        </Space>
      ),
    },
    {
      title: "Estado",
      dataIndex: "estado",
      key: "estado",
      render: (est) => (
        <Tag
          color={est === "Finalizado" ? "success" : "processing"}
          style={{
            borderRadius: "12px",
            border: "none",
            padding: "0 10px",
            fontWeight: 700,
          }}
        >
          {est.toUpperCase()}
        </Tag>
      ),
    },
  ];

  const handleExportarPDF = () => {
    if (reportData.length === 0) {
      return messageApi.warning("No hay datos para exportar.");
    }
    
    const secadoraLabel = secadoras.find(s => s.value === secadoraId)?.label || "Todas";
    const estadoLabel = estado === "all" ? "Todos (Excl. Anulados)" : 
                       estado === "En Proceso" ? "Solo en Proceso" : "Solo Finalizados";

    exportarSecadoPDF(reportData, { 
      dateRange, 
      secadoraNombre: secadoraLabel,
      estadoLabel: estadoLabel
    });
  };

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA"]}>
      <div
        style={{ padding: "16px", background: "#f8fafc", minHeight: "100vh" }}
      >
        {contextHolder}

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <div>
                <Title
                  level={2}
                  style={{ margin: 0, fontWeight: 900, color: "#1e1b4b" }}
                >
                  Reporte de Secado
                </Title>
                <Text type="secondary">
                  Estadsticas y auditora por secadora y fechas.
                </Text>
              </div>
            </div>
          </Col>

          {/* Filtros */}
          <Col span={24}>
            <Card
              size="small"
              style={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}
            >
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={6}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    Filtrar por Secadora:
                  </Text>
                  <Select
                    style={{ width: "100%" }}
                    options={secadoras}
                    value={secadoraId}
                    onChange={setSecadoraId}
                    placeholder="Todas las Secadoras"
                    allowClear
                  />
                </Col>
                <Col xs={24} md={5}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    Estado:
                  </Text>
                  <Select
                    style={{ width: "100%" }}
                    options={[
                      { value: "all", label: "Todos (Excl. Anulados)" },
                      { value: "En Proceso", label: "Solo en Proceso" },
                      { value: "Finalizado", label: "Solo Finalizados" },
                    ]}
                    value={estado}
                    onChange={setEstado}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Text strong style={{ display: "block", marginBottom: 4 }}>
                    Rango de Fechas (Inicio):
                  </Text>
                  <RangePicker
                    style={{ width: "100%" }}
                    onChange={setDateRange}
                    value={dateRange}
                    placeholder={["Fecha Inicial", "Fecha Final"]}
                  />
                </Col>
                <Col xs={24} md={5}>
                  <Space
                    style={{
                      width: "100%",
                      justifyContent: "flex-end",
                      marginTop: 22,
                    }}
                  >
                    <Button
                      icon={<ClearOutlined />}
                      onClick={() => {
                        setSecadoraId("all");
                        setEstado("all");
                        setDateRange([]);
                      }}
                    >
                      Limpiar
                    </Button>
                    <Button
                      type="primary"
                      icon={<SearchOutlined />}
                      onClick={generarReporte}
                      loading={loading}
                      style={{ background: "#4f46e5" }}
                    >
                      Actualizar
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Estadísticas */}
          <Col span={24}>
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={6}>
                <Card
                  size="small"
                  style={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <Statistic
                    title="Carga Total Entrante"
                    value={stats.totalQQEntrada}
                    suffix="QQ"
                    precision={2}
                    valueStyle={{ color: "#4f46e5", fontWeight: 800 }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card
                  size="small"
                  style={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <Statistic
                    title="Cafe Seco Producido"
                    value={stats.totalQQSalida}
                    suffix="QQ"
                    precision={2}
                    valueStyle={{ color: "#16a34a", fontWeight: 800 }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card
                  size="small"
                  style={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <Statistic
                    title="Eficiencia (Merma)"
                    value={
                      stats.totalQQEntrada > 0
                        ? 100 -
                          (stats.totalQQSalida / stats.totalQQEntrada) * 100
                        : 0
                    }
                    suffix="%"
                    precision={1}
                    valueStyle={{ color: "#f59e0b" }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card
                  size="small"
                  style={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <Statistic
                    title="Total Movimientos"
                    value={stats.totalProcesos}
                    valueStyle={{ fontWeight: 800 }}
                    prefix={<NumberOutlined />}
                  />
                </Card>
              </Col>
            </Row>
          </Col>

          {/* Tabla de Resultados */}
          <Col span={24}>
            <Card
              size="small"
              title={
                <span style={{ fontWeight: 800 }}>
                  <FileTextOutlined /> Resultados del Periodo
                </span>
              }
              extra={
                <Button
                  type="text"
                  icon={<ExportOutlined />}
                  onClick={handleExportarPDF}
                >
                  Exportar PDF
                </Button>
              }
              style={{
                borderRadius: "12px",
                border: "none",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.04)",
              }}
              styles={{ body: { padding: "0" } }}
            >
              <Table
                dataSource={reportData}
                columns={columnas}
                rowKey="secadoId"
                loading={loading}
                pagination={{ pageSize: 20, size: "small" }}
                scroll={{ x: 1000 }}
                style={{ borderRadius: "12px", overflow: "hidden" }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </ProtectedPage>
  );
}
