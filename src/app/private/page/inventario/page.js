"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Table, Row, Col, message, Button, Divider,
  Card, Typography, Statistic, Space, Tag,
  Input, Grid, Avatar, Tooltip
} from "antd";
import {
  CalendarOutlined, SearchOutlined, ReloadOutlined,
  PlusOutlined, AppstoreOutlined, ShoppingCartOutlined,
  ArrowRightOutlined, HistoryOutlined, DropboxOutlined,
  FilePdfOutlined
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import ProtectedPage from "@/components/ProtectedPage";
import TarjetaMobile from "@/components/TarjetaMobile";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function InventarioActualPage() {
  const screens = useBreakpoint();
  const { mounted, isDesktop } = useClientAndDesktop();
  const [messageApi, contextHolder] = message.useMessage();
  const router = useRouter();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventario/Actual");
      if (!res.ok) throw new Error("Error al cargar inventario");
      const data = await res.json();
      setData(data);
    } catch (error) {
      console.error(error);
      messageApi.error("No se pudieron cargar los datos del inventario");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const filteredData = useMemo(() => {
    if (!searchText) return data;
    return data.filter(item => 
      item.productName.toLowerCase().includes(searchText.toLowerCase()) ||
      item.productoID.toString().includes(searchText)
    );
  }, [data, searchText]);

  const stats = useMemo(() => {
    const totalQQ = filteredData.reduce((acc, curr) => acc + (curr.cantidadQQ || 0), 0);
    return {
      totalItems: filteredData.length,
      totalWeight: totalQQ,
      activeProducts: filteredData.filter(i => i.cantidadQQ > 0).length
    };
  }, [filteredData]);

  const handleExport = () => {
    if (!filteredData.length) return message.warning("No hay datos para exportar");

    const columnsPDF = [
      { header: "ID", key: "productoID" },
      { header: "Producto / Variedad", key: "productName" },
      { header: "Existencia (QQ Oro)", key: "cantidadQQ", format: "numero", isTotal: true },
      { header: "Sacos", key: "cantidadSacos", format: "numero", isTotal: true },
    ];

    const { generarReportePDF } = require("@/Doc/Reportes/FormatoDoc");
    
    generarReportePDF(
      filteredData,
      { nombreFiltro: "GENERAL" },
      columnsPDF,
      {
        title: "Inventario de Existencia Consolidado",
        orientation: "portrait",
      }
    );
  };

  const columns = [
    {
      title: "PRODUCTO",
      key: "producto",
      render: (_, record) => (
        <Space size="middle">
          <Avatar 
            shape="square" 
            size="large" 
            icon={<DropboxOutlined />} 
            style={{ backgroundColor: "#f1f5f9", color: "#4f46e5" }}
          />
          <div>
            <Text strong style={{ fontSize: "14px", display: "block" }}>{record.productName}</Text>
            <Text type="secondary" style={{ fontSize: "12px" }}>ID: #{record.productoID}</Text>
          </div>
        </Space>
      )
    },
    {
      title: "EXISTENCIAS (QQ)",
      dataIndex: "cantidadQQ",
      key: "cantidadQQ",
      align: "right",
      sorter: (a, b) => a.cantidadQQ - b.cantidadQQ,
      render: (val) => (
        <div style={{ textAlign: "right" }}>
          <Text strong style={{ fontSize: "16px", color: val > 0 ? "#1e1b4b" : "#94a3b8" }}>
            {val.toLocaleString("es-HN", { minimumFractionDigits: 2 })}
          </Text>
          <Text type="secondary" style={{ display: "block", fontSize: "10px" }}>QUINTALES ORO</Text>
        </div>
      )
    },
    {
      title: "ESTADO",
      key: "estado",
      align: "center",
      render: (_, record) => (
        <Tag color={record.cantidadQQ > 0 ? "success" : "default"} style={{ borderRadius: "12px", border: "none", padding: "0 10px", fontWeight: 700 }}>
          {record.cantidadQQ > 0 ? "DISPONIBLE" : "SIN STOCK"}
        </Tag>
      )
    },
    {
      title: "ACCIONES",
      key: "acciones",
      align: "right",
      render: (_, record) => (
        <Tooltip title="Ver detalle de movimientos">
          <Button 
            type="text" 
            icon={<ArrowRightOutlined />} 
            onClick={() => router.push(`/private/page/inventario/${record.productoID}`)}
            style={{ color: "#4f46e5" }}
          />
        </Tooltip>
      )
    }
  ];

  const columnsMobile = [
    { label: "Producto", key: "productName", render: (v) => <Text strong>{v}</Text> },
    { label: "ID", key: "productoID" },
    { label: "Existencia", key: "cantidadQQ", render: (v) => <b>{v.toLocaleString()} QQ</b> },
  ];

  if (!mounted) return null;

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "COLABORADORES", "AUDITORES"]}>
      <div style={{ padding: "16px", background: "#f8fafc", minHeight: "100vh" }}>
        {contextHolder}

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <Title level={2} style={{ margin: 0, fontWeight: 900, color: "#1e1b4b" }}>
                <AppstoreOutlined style={{ marginRight: "8px" }} /> Inventario General
              </Title>
              <Space>
                <Button icon={<FilePdfOutlined />} onClick={handleExport} disabled={loading}>EXPORTAR INFO</Button>
                <Button icon={<ReloadOutlined />} onClick={cargarDatos} loading={loading}>ACTUALIZAR</Button>
                <Button 
                  type="primary" 
                  icon={<HistoryOutlined />} 
                  onClick={() => router.push("/private/page/inventario/transferir")}
                  style={{ background: "#4f46e5" }}
                >
                  TRANSFERENCIAS
                </Button>
              </Space>
            </div>
          </Col>

          {/* Estaditicas */}
          <Col span={24}>
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={8}>
                <Card size="small" style={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                  <Statistic title="PRODUCTOS ACTIVOS" value={stats.activeProducts} prefix={<DropboxOutlined />} valueStyle={{ color: "#4f46e5", fontWeight: 800 }} />
                </Card>
              </Col>
              <Col xs={12} sm={8}>
                <Card size="small" style={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                  <Statistic title="VARIEDADES" value={stats.totalItems} prefix={<ShoppingCartOutlined />} />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ borderRadius: "15px", border: "none", background: "#1e1b4b" }}>
                  <Statistic 
                    title={<span style={{ color: "#94a3b8" }}>CARGA TOTAL DISPONIBLE</span>} 
                    value={stats.totalWeight} 
                    suffix="QQ" 
                    precision={2} 
                    valueStyle={{ color: "#fff", fontWeight: 900 }} 
                  />
                </Card>
              </Col>
            </Row>
          </Col>

          {/* Filtros y Tabla */}
          <Col span={24}>
            <Card 
              size="small"
              title={
                <Input
                  placeholder="Buscar producto por nombre o ID..."
                  prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: "100%", maxWidth: "400px", borderRadius: "8px", margin: "8px 0" }}
                  allowClear
                />
              }
              style={{ borderRadius: "12px", border: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
              styles={{ body: { padding: 0 } }}
            >
              {isDesktop ? (
                <Table
                  columns={columns}
                  dataSource={filteredData}
                  rowKey="productoID"
                  loading={loading}
                  pagination={{ pageSize: 20 }}
                  size="middle"
                />
              ) : (
                <div style={{ padding: "12px" }}>
                  <TarjetaMobile
                    data={filteredData}
                    columns={columnsMobile}
                    loading={loading}
                    rowKey="productoID"
                  />
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </ProtectedPage>
  );
}
