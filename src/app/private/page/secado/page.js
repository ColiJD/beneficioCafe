"use client";
import { useState, useEffect, useRef } from "react";
import {
  message, Button, Space, Popconfirm, Table, Tag,
  Modal, InputNumber, Card, Statistic, Typography,
  Divider, Alert, Grid, Badge, Tooltip, Row, Col, Input
} from "antd";
import {
  PlayCircleOutlined, CheckSquareOutlined,
  StopOutlined, DropboxOutlined, FireOutlined,
  ArrowRightOutlined, InfoCircleOutlined,
  SearchOutlined, NumberOutlined
} from "@ant-design/icons";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import { obtenerSecadorasSelect, obtenerProductosSelect, obtenerSecados } from "@/lib/consultas";
import { validarFloatPositivo } from "@/config/validacionesForm";
import { calcularPesoSecado } from "@/lib/calculoCafe";
import ProtectedPage from "@/components/ProtectedPage";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function PageSecado() {
  const screens = useBreakpoint();
  const [registros, setRegistros] = useState([]);
  const [secadoras, setSecadoras] = useState([]);
  const [productos, setProductos] = useState([]);
  
  const [searchText, setSearchText] = useState("");

  const [secadoraId, setSecadoraId] = useState(null);
  const [productoId, setProductoId] = useState(null);
  const [productoIdDestino, setProductoIdDestino] = useState(null);
  const [cantidadEntradaQQ, setCantidadEntradaQQ] = useState(0);
  const [humedadInicial, setHumedadInicial] = useState(45);
  const [observaciones, setObservaciones] = useState("");

  const [finalizarModal, setFinalizarModal] = useState(false);
  const [selectedSecado, setSelectedSecado] = useState(null);
  const [humedadFinal, setHumedadFinal] = useState(12);
  const [cantidadSalidaQQ, setCantidadSalidaQQ] = useState(0);
  const [calculadoSugerido, setCalculadoSugerido] = useState(0);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();
  const messageApiRef = useRef(messageApi);

  const cargarDatos = async () => {
    try {
      const sec = await obtenerSecadorasSelect(messageApiRef.current);
      setSecadoras(sec.filter(s => s.data.estado === "Disponible"));
      const prod = await obtenerProductosSelect(messageApiRef.current);
      setProductos(prod);

      const productoSeco = prod.find(p =>
        p.label.toLowerCase().includes("cafe seco") ||
        p.label.toLowerCase().includes("pergamino seco")
      );
      if (productoSeco) setProductoIdDestino(productoSeco);

      const reg = await obtenerSecados();
      setRegistros(reg);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  useEffect(() => {
    if (selectedSecado) {
      const sugerido = calcularPesoSecado(
        selectedSecado.cantidadEntradaQQ,
        selectedSecado.humedadInicial || 0,
        humedadFinal
      );
      setCalculadoSugerido(sugerido);
      if (cantidadSalidaQQ === 0 || cantidadSalidaQQ === calculadoSugerido) {
        setCantidadSalidaQQ(sugerido);
      }
    }
  }, [humedadFinal, selectedSecado]);

  const handleIniciarSecado = () => {
    if (!secadoraId || !productoId || cantidadEntradaQQ <= 0) {
      return messageApi.warning("Complete todos los datos obligatorios.");
    }
    const capacidadMax = parseFloat(secadoraId.data?.capacidad || 0);
    if (capacidadMax > 0 && parseFloat(cantidadEntradaQQ) > capacidadMax) {
      return messageApi.error(`Exceso de capacidad. Máximo: ${capacidadMax} QQ.`);
    }
    setPreviewVisible(true);
  };

  const confirmarInicio = async () => {
    setSubmitting(true);
    const payload = {
      secadoraId: secadoraId?.value || secadoraId,
      productoId: productoId?.value || productoId,
      productoIdDestino: productoIdDestino?.value || productoIdDestino,
      cantidadEntradaQQ,
      humedadInicial,
      observaciones
    };
    try {
      const res = await fetch("/api/secado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        messageApi.success("Secado iniciado correctamente");
        setPreviewVisible(false);
        resetForm();
        cargarDatos();
      } else {
        const err = await res.json();
        messageApi.error(err.error || "Error al iniciar proceso");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenFinalizar = (record) => {
    setSelectedSecado(record);
    const sugerido = calcularPesoSecado(record.cantidadEntradaQQ, record.humedadInicial || 0, 12);
    setCalculadoSugerido(sugerido);
    setCantidadSalidaQQ(sugerido);
    setHumedadFinal(12);
    setFinalizarModal(true);
  };

  const confirmarFinalización = async () => {
    setSubmitting(true);
    const payload = { humedadFinal, cantidadSalidaQQ, fechaFin: new Date(), estado: "Finalizado" };
    try {
      const res = await fetch(`/api/secado/${selectedSecado.secadoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        messageApi.success("Proceso de secado culminado");
        setFinalizarModal(false);
        cargarDatos();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSecadoraId(null);
    setProductoId(null);
    setProductoIdDestino(null);
    setCantidadEntradaQQ(0);
    setHumedadInicial(45);
    setObservaciones("");
  };

  const enProceso = registros.filter(r => r.estado === "En Proceso").length;

  const registrosFiltrados = registros.filter(r => {
    const term = searchText.trim();
    if (term !== "") {
      return String(r.secadoId).includes(term) && r.estado !== "Anulado";
    }
    return r.estado === "En Proceso";
  });

  const columns = [
    {
      title: "#ID",
      dataIndex: "secadoId",
      key: "id",
      width: "80px",
      align: "center",
      render: (id) => <Text strong style={{ color: "#1e1b4b" }}>{id}</Text>
    },
    {
      title: "EQUIPO / PRODUCTO",
      key: "equipo",
      width: "25%",
      render: (_, r) => (
        <Space size="middle">
          <div style={{ padding: "6px", background: r.estado === "En Proceso" ? "#fef3c7" : "#f1f5f9", borderRadius: "8px" }}>
            <FireOutlined style={{ fontSize: "16px", color: r.estado === "En Proceso" ? "#f59e0b" : "#64748b" }} />
          </div>
          <div>
            <Text strong style={{ fontSize: "14px", color: "#111827", display: "block" }}>{r.secadora?.nombre || "—"}</Text>
            <Text type="secondary" style={{ fontSize: "11px" }}>{r.producto?.productName || "—"}</Text>
          </div>
        </Space>
      )
    },
    {
      title: "CARGA INICIAL",
      key: "carga",
      align: "center",
      render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: "15px", color: "#4f46e5", display: "block" }}>{r.cantidadEntradaQQ} QQ</Text>
          <Tag color="cyan" style={{ border: "none", borderRadius: "8px", fontSize: "10px", lineHeight: "1.5" }}>{r.humedadInicial || "—"}% HUM</Tag>
        </div>
      )
    },
    {
      title: "ESTADO",
      key: "estado",
      align: "center",
      render: (_, r) => (
        <Tag
          color={r.estado === "En Proceso" ? "orange" : "green"}
          style={{ borderRadius: "12px", fontWeight: 700, padding: "0 8px", fontSize: "11px", border: "none" }}
        >
          {r.estado.toUpperCase()}
        </Tag>
      )
    },
    {
      title: "SALIDA FINAL",
      key: "salida",
      align: "center",
      render: (_, r) => r.cantidadSalidaQQ ? (
        <div>
          <Text strong style={{ fontSize: "15px", color: "#16a34a", display: "block" }}>{r.cantidadSalidaQQ} QQ</Text>
          <Tag color="green" style={{ border: "none", borderRadius: "8px", fontSize: "10px", lineHeight: "1.5" }}>{r.humedadFinal}% HUM</Tag>
        </div>
      ) : (
        <Text type="secondary" style={{ fontSize: "11px" }} italic>En proceso...</Text>
      )
    },
    {
      title: "ACCIONES",
      key: "acciones",
      align: "right",
      render: (_, record) => {
        // SEGURIDAD: Solo mostrar botones si se está realizando una búsqueda por ID específica
        if (searchText.trim() === "") {
          return <Text type="secondary" style={{ fontSize: "10px" }} italic>Busque ID para operar</Text>;
        }
        
        return (
          <Space size="small">
            {record.estado === "En Proceso" && (
              <Button
                type="primary"
                size="small"
                onClick={() => handleOpenFinalizar(record)}
                style={{ borderRadius: "6px", fontWeight: 600, fontSize: "12px", background: "#10b981", border: "none" }}
              >
                FINALIZAR
              </Button>
            )}
            <Popconfirm
              title="¿Confirma anulación?"
              onConfirm={async () => {
                const res = await fetch(`/api/secado/${record.secadoId}`, { method: "DELETE" });
                if (res.ok) {
                  messageApi.success("Proceso anulado");
                  cargarDatos();
                  setSearchText(""); // Limpiar búsqueda después de operar
                }
              }}
            >
              <Tooltip title="Anular Registro">
                <Button type="text" danger icon={<StopOutlined />} style={{ borderRadius: "6px", fontSize: "12px" }} />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      }
    }
  ];

  const fields = [
    { label: "Secadora Disponible", value: secadoraId, setter: setSecadoraId, type: "select", options: secadoras, required: true },
    { label: "Tipo de Café a Procesar", value: productoId, setter: setProductoId, type: "select", options: productos, required: true },
    { label: "Cantidad (Quintales)", value: cantidadEntradaQQ, setter: setCantidadEntradaQQ, type: "Float", required: true, validator: validarFloatPositivo },
    { label: "Humedad Inicial (%)", value: humedadInicial, setter: setHumedadInicial, type: "Float" },
    { label: "Observaciones Generales", value: observaciones, setter: setObservaciones, type: "text" }
  ];

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "COLABORADORES"]}>
      <div style={{ padding: "16px", maxWidth: "1600px", margin: "0 auto", background: "#f8fafc", minHeight: "100vh" }}>
        {contextHolder}

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Title level={2} style={{ margin: 0, fontWeight: 900, letterSpacing: "-1px", color: "#1e1b4b" }}>Control de Secado</Title>
          </Col>

          {/* FORMULARIO */}
          <Col span={24} style={{ maxWidth: "800px", margin: "0 auto" }}>
            <Card
              size="small"
              title={<span style={{ fontWeight: 800, fontSize: "14px" }}><PlayCircleOutlined /> REGISTRAR INICIO DE SECADO</span>}
              bordered={false}
              style={{ borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)", border: "1px solid #e5e7eb" }}
            >
              <Formulario
                fields={fields}
                onSubmit={handleIniciarSecado}
                submitting={submitting}
                button={{ text: "INICIAR PROCESO", onClick: handleIniciarSecado, style: { height: "40px", borderRadius: "8px", width: "100%", fontWeight: 700, fontSize: "14px", background: "#4f46e5" } }}
              />
            </Card>
          </Col>

          {/* BUSCADOR POR ID */}
          <Col span={24}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", background: "white", padding: "10px 16px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontWeight: 800, fontSize: "15px", color: "#4b5563" }}><NumberOutlined /> PROCESOS ACTIVOS</span>
                <Badge count={enProceso} overflowCount={99} color="#f59e0b" size="small" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Text type="secondary" style={{ fontSize: "12px" }}>Para finalizar o anular un registro:</Text>
                <Input 
                  placeholder="Introduzca ID..." 
                  prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                  style={{ width: "250px", height: "36px", borderRadius: "8px", border: "1px solid #4f46e5" }}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  allowClear
                />
              </div>
            </div>
            
            <Card
              size="small"
              bordered={false}
              style={{ borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.04)" }}
              styles={{ body: { padding: "0" } }}
            >
              <Table
                dataSource={registrosFiltrados}
                columns={columns}
                rowKey="secadoId"
                pagination={{ pageSize: 12, size: "small" }}
                scroll={{ x: 800 }}
                style={{ borderRadius: "12px", overflow: "hidden" }}
                locale={{ emptyText: searchText ? `El ID #${searchText} no existe o no tiene relación activa` : "No hay secados en curso" }}
              />
            </Card>
          </Col>
        </Row>

        <PreviewModal
          open={previewVisible}
          title="Verificación de Inicio"
          onCancel={() => setPreviewVisible(false)}
          onConfirm={confirmarInicio}
          confirmLoading={submitting}
          fields={fields.map(f => ({
            label: f.label,
            value: f.type === "select" ? (f.value?.label || f.value) : f.value
          }))}
        />

        <Modal
          title={<b>FINALIZAR PROCESO</b>}
          open={finalizarModal}
          onCancel={() => setFinalizarModal(false)}
          onOk={confirmarFinalización}
          confirmLoading={submitting}
          width={600}
          centered
          okText="Finalizar y Liberar Máquina"
          okButtonProps={{ style: { height: "40px", borderRadius: "8px", fontWeight: 700, background: "#10b981" } }}
          bodyStyle={{ padding: "16px" }}
        >
          {selectedSecado && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ padding: "8px 16px", background: "#f3f4f6", borderRadius: "8px" }}>
                <Text type="secondary">ID de Registro: </Text>
                <Text strong>#{selectedSecado.secadoId}</Text>
              </div>
              <Row gutter={12}>
                <Col span={12}>
                  <Card size="small" style={{ background: "#f8fafc", borderRadius: "8px" }}>
                    <Statistic title="Peso Inicial" value={selectedSecado.cantidadEntradaQQ} suffix="QQ" valueStyle={{ fontSize: "18px" }} />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" style={{ background: "#f8fafc", borderRadius: "8px" }}>
                    <Statistic title="Humedad Inicial" value={selectedSecado.humedadInicial || 0} suffix="%" valueStyle={{ fontSize: "18px" }} />
                  </Card>
                </Col>
              </Row>

              <div style={{ padding: "16px", background: "white", border: "1px solid #f1f5f9", borderRadius: "12px" }}>
                <Row gutter={16} align="middle">
                  <Col span={12}>
                    <Text strong style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>HUMEDAD FINAL (%)</Text>
                    <InputNumber
                      style={{ width: "100%", height: "36px", borderRadius: "6px" }}
                      value={humedadFinal}
                      onChange={setHumedadFinal}
                      max={100} min={0}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="SUGERIDO"
                      value={calculadoSugerido}
                      precision={2}
                      suffix="QQ"
                      valueStyle={{ color: "#4f46e5", fontWeight: 900, fontSize: "20px" }}
                    />
                  </Col>
                </Row>
                <Divider style={{ margin: "12px 0" }} />
                <Text strong style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>PESO FINAL REAL (QQ)</Text>
                <InputNumber
                  style={{ width: "100%", height: "40px", borderRadius: "6px", fontSize: "16px", fontWeight: 700 }}
                  value={cantidadSalidaQQ}
                  onChange={setCantidadSalidaQQ}
                  min={0}
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
    </ProtectedPage>
  );
}
