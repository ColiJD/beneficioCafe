"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Table, Button, Row, Col, message, Grid, 
  Card, Typography, Space, Tag, Divider, 
  Statistic, Breadcrumb, Avatar
} from "antd";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeftOutlined, FilePdfOutlined, ReloadOutlined,
  DropboxOutlined, RiseOutlined, FallOutlined,
  SwapOutlined, HistoryOutlined
} from "@ant-design/icons";
import { truncarDosDecimalesSinRedondear } from "@/lib/calculoCafe";
import { FiltrosTarjetas } from "@/lib/FiltrosTarjetas";
import TarjetaMobile from "@/components/TarjetaMobile";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import customParseFormat from "dayjs/plugin/customParseFormat";
import ProtectedPage from "@/components/ProtectedPage";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(customParseFormat);

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function DetalleCafePage() {
  const { id } = useParams();
  const router = useRouter();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nombreCafe, setNombreCafe] = useState("");

  const [rangoFecha, setRangoFecha] = useState([dayjs().startOf("year"), dayjs()]);
  const [movimientoFiltro, setMovimientoFiltro] = useState("");

  const cargarMovimientos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventario/movimientos/${id}`);
      if (!res.ok) throw new Error("No se pudieron cargar los movimientos");
      const json = await res.json();
      setData(json);
      setFilteredData(json);
      if (json.length > 0) setNombreCafe(json[0].tipoCafe);
    } catch (error) {
      console.error(error);
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarMovimientos();
  }, [id]);

  useEffect(() => {
    const filtros = { tipoMovimiento: movimientoFiltro };
    const filtrados = FiltrosTarjetas(data, filtros, rangoFecha, "fecha");
    setFilteredData(filtrados);
  }, [movimientoFiltro, rangoFecha, data]);

  const stats = useMemo(() => {
    const entradas = data.filter(m => m.tipoMovimiento === "Entrada").reduce((acc, c) => acc + (parseFloat(c.cantidadQQ) || 0), 0);
    const salidas = data.filter(m => m.tipoMovimiento === "Salida").reduce((acc, c) => acc + (parseFloat(c.cantidadQQ) || 0), 0);
    return {
      totalEntradas: entradas,
      totalSalidas: salidas,
      balance: entradas - salidas
    };
  }, [data]);

  const handleExport = () => {
    if (!filteredData.length) return message.warning("No hay datos para exportar");

    const columnsPDF = [
      { header: "Fecha", key: "fecha" },
      { header: "Movimiento", key: "tipoMovimiento" },
      { header: "Entradas (QQ)", key: "entrada", format: "numero" },
      { header: "Salidas (QQ)", key: "salida", format: "numero" },
      { header: "Sujeto / Ref", key: "referenciaTipo" },
    ];

    const dataPDF = filteredData.map(m => ({
      ...m,
      fecha: dayjs(m.fecha).format("DD/MM/YYYY"),
      entrada: m.tipoMovimiento === "Entrada" ? m.cantidadQQ : 0,
      salida: m.tipoMovimiento === "Salida" ? m.cantidadQQ : 0,
      referenciaTipo: `${m.clienteNombre} ${m.clienteApellido} (${m.referenciaTipo || 'N/A'})`
    }));

    const { generarReportePDF } = require("@/Doc/Reportes/FormatoDoc");
    
    generarReportePDF(
      dataPDF,
      { nombreFiltro: nombreCafe },
      columnsPDF,
      {
        title: `Kardex Detallado: ${nombreCafe}`,
        orientation: "portrait",
      }
    );
  };

  const columns = [
    {
      title: "FECHA",
      dataIndex: "fecha",
      key: "fecha",
      render: (val) => <Text style={{ fontSize: "13px" }}>{dayjs(val).format("DD/MM/YYYY")}</Text>,
      sorter: (a, b) => dayjs(a.fecha).unix() - dayjs(b.fecha).unix(),
    },
    {
      title: "MOVIMIENTO",
      dataIndex: "tipoMovimiento",
      key: "tipoMovimiento",
      render: (tipo) => (
        <Tag 
          color={tipo === "Entrada" ? "success" : "volcano"} 
          icon={tipo === "Entrada" ? <RiseOutlined /> : <FallOutlined />}
          style={{ borderRadius: "10px", border: "none", fontWeight: 700 }}
        >
          {tipo.toUpperCase()}
        </Tag>
      )
    },
    {
      title: "PRODUCTOR / CLIENTE",
      key: "cliente",
      render: (_, r) => (
        <Space size="small">
          <Avatar size="small" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>{r.clienteNombre?.[0]}</Avatar>
          <Text strong style={{ fontSize: "13px" }}>{r.clienteNombre} {r.clienteApellido}</Text>
        </Space>
      )
    },
    {
      title: "REFERENCIA",
      dataIndex: "referenciaTipo",
      key: "referenciaTipo",
      render: (t) => <Text type="secondary" style={{ fontSize: "12px" }}>{t || "Ajuste Directo"}</Text>
    },
    {
      title: "CANTIDAD (QQ)",
      dataIndex: "cantidadQQ",
      key: "cantidadQQ",
      align: "right",
      render: (val, r) => (
        <Text strong style={{ fontSize: "15px", color: r.tipoMovimiento === "Entrada" ? "#10b981" : "#ef4444" }}>
          {r.tipoMovimiento === "Entrada" ? "+" : "-"} {truncarDosDecimalesSinRedondear(val)}
        </Text>
      )
    }
  ];

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "COLABORADORES"]}>
      <div style={{ padding: "16px", background: "#f8fafc", minHeight: "100vh" }}>
        
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Breadcrumb items={[
              { title: <a onClick={() => router.push("/private/page/inventario")}>Inventario</a> },
              { title: nombreCafe || "Cargando..." }
            ]} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/private/page/inventario")} shape="circle" />
                <Title level={3} style={{ margin: 0, fontWeight: 900 }}>Kardex de Producto: {nombreCafe}</Title>
              </Space>
              <Button 
                icon={<FilePdfOutlined />} 
                type="primary" 
                onClick={handleExport}
                style={{ background: "#4f46e5" }}
              >
                Exportar PDF
              </Button>
            </div>
          </Col>

          {/* Estadsticas de este caf */}
          <Col span={24}>
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={8}>
                <Card size="small" style={{ borderRadius: "12px", border: "none" }}>
                  <Statistic title="TOTAL ENTRADAS" value={stats.totalEntradas} suffix="QQ" precision={2} valueStyle={{ color: "#10b981" }} prefix={<RiseOutlined />} />
                </Card>
              </Col>
              <Col xs={12} sm={8}>
                <Card size="small" style={{ borderRadius: "12px", border: "none" }}>
                  <Statistic title="TOTAL SALIDAS" value={stats.totalSalidas} suffix="QQ" precision={2} valueStyle={{ color: "#ef4444" }} prefix={<FallOutlined />} />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ borderRadius: "15px", border: "none", background: "#1e1b4b" }}>
                  <Statistic 
                    title={<span style={{ color: "#94a3b8" }}>SALDO ACTUAL EN BODEGA</span>} 
                    value={stats.balance} 
                    suffix="QQ" 
                    precision={2} 
                    valueStyle={{ color: "#fff", fontWeight: 900 }} 
                    prefix={<DropboxOutlined />}
                  />
                </Card>
              </Col>
            </Row>
          </Col>

          <Col span={24}>
            <Card 
              size="small" 
              title={<span style={{ fontWeight: 800 }}><HistoryOutlined /> Historial de Movimientos</span>}
              extra={<Button icon={<ReloadOutlined />} onClick={cargarMovimientos} type="text" />}
              style={{ borderRadius: "12px", border: "none" }}
              styles={{ body: { padding: 0 } }}
            >
              {isMobile ? (
                <div style={{ padding: "12px" }}>
                   <TarjetaMobile 
                    data={filteredData} 
                    loading={loading} 
                    columns={[
                      { label: "Fecha", key: "fecha", render: v => dayjs(v).format("DD/MM/YYYY") },
                      { label: "Tipo", key: "tipoMovimiento" },
                      { label: "Cant.", key: "cantidadQQ", render: v => <b>{v} QQ</b> }
                    ]}
                   />
                </div>
              ) : (
                <Table 
                  dataSource={filteredData} 
                  columns={columns} 
                  rowKey="movimientoID" 
                  loading={loading} 
                  pagination={{ pageSize: 15 }}
                />
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </ProtectedPage>
  );
}
