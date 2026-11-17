"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Table, Row, Col, message, Button, Divider,
  Card, Typography, Statistic, Space, Tag,
  Input, Grid, Avatar, Tooltip, Modal, Form, Select, InputNumber, Popconfirm
} from "antd";
import {
  EditOutlined, DeleteOutlined, UnorderedListOutlined,
  CalendarOutlined, SearchOutlined, ReloadOutlined,
  PlusOutlined, AppstoreOutlined, ShoppingCartOutlined,
  ArrowRightOutlined, HistoryOutlined, DropboxOutlined,
  FilePdfOutlined
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import ProtectedPage from "@/components/ProtectedPage";
import ProtectedButton from "@/components/ProtectedButton";
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

  // Inventario inicial: cada botón y su API exigen el permiso del módulo inventario-inicial
  // (ver la lista, crear, editar, eliminar)
  const [modalInicial, setModalInicial] = useState(false);
  const [editando, setEditando] = useState(null); // carga que se está editando; null = carga nueva
  const [modalLista, setModalLista] = useState(false);
  const [cargas, setCargas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [formInicial] = Form.useForm();

  const cargarCargas = async () => {
    try {
      const res = await fetch("/api/inventario/inicial");
      if (!res.ok) throw new Error();
      setCargas(await res.json());
    } catch {
      messageApi.error("No se pudieron cargar las cargas iniciales");
    }
  };

  const abrirLista = () => {
    setModalLista(true);
    cargarCargas();
  };

  const anularCarga = async (carga) => {
    try {
      const res = await fetch(`/api/inventario/inicial/${carga.movimientoID}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al anular");
      messageApi.success("Carga anulada");
      cargarCargas();
      cargarDatos();
    } catch (error) {
      messageApi.error(error.message);
    }
  };

  const abrirInicial = async (carga = null) => {
    setEditando(carga);
    setModalInicial(true);
    try {
      const res = await fetch("/api/productos");
      if (!res.ok) throw new Error();
      setProductos(await res.json());
    } catch {
      messageApi.error("No se pudieron cargar los productos");
    }
  };

  const guardarInicial = async (values) => {
    setGuardando(true);
    try {
      const res = await fetch(
        editando ? `/api/inventario/inicial/${editando.movimientoID}` : "/api/inventario/inicial",
        {
          method: editando ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al guardar");
      messageApi.success(editando ? "Carga actualizada" : "Inventario inicial registrado");
      setModalInicial(false);
      setEditando(null);
      formInicial.resetFields();
      if (modalLista) cargarCargas();
      cargarDatos();
    } catch (error) {
      messageApi.error(error.message);
    } finally {
      setGuardando(false);
    }
  };

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
            style={{ backgroundColor: "#F0EEEA", color: "#8A4B1F" }}
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
          <Text strong style={{ fontSize: "16px", color: val > 0 ? "#33200F" : "#6E6862" }}>
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
            style={{ color: "#8A4B1F" }}
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
      <div style={{ padding: "16px", background: "#FFFFFF", minHeight: "100vh" }}>
        {contextHolder}

        <Modal
          title="Cargas del inventario inicial"
          open={modalLista}
          onCancel={() => setModalLista(false)}
          footer={null}
          width={720}
          destroyOnHidden
        >
          <Table
            size="small"
            rowKey="movimientoID"
            dataSource={cargas}
            pagination={{ pageSize: 8 }}
            columns={[
              { title: "Fecha", dataIndex: "fecha", render: (f) => new Date(f).toLocaleDateString("es-HN") },
              { title: "Café", dataIndex: "productName" },
              { title: "QQ", dataIndex: "cantidadQQ", align: "right", render: (v) => v.toLocaleString("es-HN", { minimumFractionDigits: 2 }) },
              { title: "Nota", dataIndex: "nota", ellipsis: true },
              {
                title: "",
                key: "acc",
                align: "right",
                render: (_, c) => (
                  <Space>
                    <ProtectedButton accion="editar" modulo="inventario-inicial">
                      <Tooltip title="Editar"><Button size="small" icon={<EditOutlined />} onClick={() => abrirInicial(c)} /></Tooltip>
                    </ProtectedButton>
                    <ProtectedButton accion="eliminar" modulo="inventario-inicial">
                      <Popconfirm
                        title="¿Anular esta carga?"
                        description="Se resta del inventario. Si ese café ya se usó, no se podrá anular."
                        okText="Anular"
                        cancelText="Cancelar"
                        onConfirm={() => anularCarga(c)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </ProtectedButton>
                  </Space>
                ),
              },
            ]}
          />
        </Modal>

        <Modal
          title={editando ? "Editar carga inicial" : "Inventario inicial"}
          open={modalInicial}
          onCancel={() => { setModalInicial(false); setEditando(null); }}
          onOk={() => formInicial.submit()}
          okText={editando ? "Guardar" : "Registrar"}
          cancelText="Cancelar"
          confirmLoading={guardando}
          destroyOnHidden
        >
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            Suma café que ya existe en el almacén, sin crear una compra. Registra el peso real y en el estado en que está hoy.
          </Text>
          <Form
            form={formInicial}
            layout="vertical"
            onFinish={guardarInicial}
            initialValues={editando ? { productoID: editando.productoID, cantidadQQ: editando.cantidadQQ, nota: editando.nota } : undefined}
          >
            <Form.Item name="productoID" label="Tipo de café" rules={[{ required: true, message: "Seleccione el tipo de café" }]}>
              <Select
                disabled={!!editando}
                showSearch
                optionFilterProp="label"
                placeholder="Seleccione"
                options={productos.map((p) => ({ value: p.productID, label: p.productName }))}
              />
            </Form.Item>
            <Form.Item name="cantidadQQ" label="Cantidad (QQ)" rules={[{ required: true, message: "Ingrese la cantidad" }]}>
              <InputNumber min={0.01} step={0.01} precision={2} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="nota" label="Nota (opcional)">
              <Input maxLength={200} />
            </Form.Item>
          </Form>
        </Modal>

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <Title level={2} style={{ margin: 0, fontWeight: 900, color: "#33200F" }}>
                <AppstoreOutlined style={{ marginRight: "8px" }} /> Inventario General
              </Title>
              <Space>
                <Button icon={<FilePdfOutlined />} onClick={handleExport} disabled={loading}>EXPORTAR INFO</Button>
                <Button icon={<ReloadOutlined />} onClick={cargarDatos} loading={loading}>ACTUALIZAR</Button>
                <ProtectedButton accion="crear" modulo="inventario-inicial">
                  <Button icon={<PlusOutlined />} onClick={() => abrirInicial()}>INVENTARIO INICIAL</Button>
                </ProtectedButton>
                <ProtectedButton accion="ver" modulo="inventario-inicial">
                  <Button icon={<UnorderedListOutlined />} onClick={abrirLista}>CARGAS INICIALES</Button>
                </ProtectedButton>
                <Button 
                  type="primary" 
                  icon={<HistoryOutlined />} 
                  onClick={() => router.push("/private/page/inventario/transferir")}
                  style={{ background: "#8A4B1F" }}
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
                  <Statistic title="PRODUCTOS ACTIVOS" value={stats.activeProducts} prefix={<DropboxOutlined />} valueStyle={{ color: "#8A4B1F", fontWeight: 800 }} />
                </Card>
              </Col>
              <Col xs={12} sm={8}>
                <Card size="small" style={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                  <Statistic title="VARIEDADES" value={stats.totalItems} prefix={<ShoppingCartOutlined />} />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ borderRadius: "15px", border: "none", background: "#33200F" }}>
                  <Statistic 
                    title={<span style={{ color: "#6E6862" }}>CARGA TOTAL DISPONIBLE</span>} 
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
                  prefix={<SearchOutlined style={{ color: "#6E6862" }} />}
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
