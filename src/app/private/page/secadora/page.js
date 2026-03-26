"use client";
import { useState, useEffect, useRef } from "react";
import {
  message, Button, Space, Popconfirm, Table, Tag,
  Card, Typography, Divider, Badge, Tooltip, Grid, Row, Col
} from "antd";
import {
  PlusCircleOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, ToolOutlined, CloseCircleOutlined,
  SaveOutlined, CloseOutlined, FormOutlined, BuildOutlined,
  InfoCircleOutlined
} from "@ant-design/icons";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import { obtenerSecadorasSelect } from "@/lib/consultas";
import { validarFloatPositivo } from "@/config/validacionesForm";
import { validarDatos } from "@/lib/validacionesForm";
import ProtectedPage from "@/components/ProtectedPage";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const estadoConfig = {
  Disponible: { color: "green", label: "Disponible", icon: <CheckCircleOutlined /> },
  "En Uso":   { color: "blue", label: "Ejerciendo Proceso", icon: <ToolOutlined /> },
  Mantenimiento: { color: "orange", label: "Mantenimiento", icon: <InfoCircleOutlined /> },
};

export default function PageSecadoras() {
  const screens = useBreakpoint();
  const [secadoras, setSecadoras] = useState([]);
  const [selectedSecadora, setSelectedSecadora] = useState(null);

  const [nombre, setNombre] = useState("");
  const [capacidad, setCapacidad] = useState(0);
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState({ label: "Disponible", value: "Disponible" });

  const [errors, setErrors] = useState({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();
  const messageApiRef = useRef(messageApi);

  const cargarSecadoras = async () => {
    try {
      const data = await obtenerSecadorasSelect(messageApiRef.current);
      setSecadoras(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { cargarSecadoras(); }, []);

  const handleRegistrarClick = () => {
    if (validarDatos(fields, messageApi, setErrors)) setPreviewVisible(true);
  };

  const handleConfirmar = async () => {
    setSubmitting(true);
    const payload = {
      nombre: nombre.trim(),
      capacidad: parseFloat(capacidad),
      tipo: tipo.trim(),
      estado: estado?.value || estado
    };

    const url = selectedSecadora ? `/api/secadoras/${selectedSecadora.value}` : "/api/secadoras";
    const method = selectedSecadora ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        messageApiRef.current.success(selectedSecadora ? "Secadora actualizada" : "Secadora registrada");
        setPreviewVisible(false);
        resetForm();
        cargarSecadoras();
      } else {
        const err = await res.json();
        messageApiRef.current.error(err.error || "Error al guardar");
      }
    } catch {
      messageApiRef.current.error("Error de red");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setNombre("");
    setCapacidad(0);
    setTipo("");
    setEstado({ label: "Disponible", value: "Disponible" });
    setSelectedSecadora(null);
    setErrors({});
  };

  const handleEdit = (secadora) => {
    setSelectedSecadora(secadora);
    setNombre(secadora.data.nombre);
    setCapacidad(secadora.data.capacidad || 0);
    setTipo(secadora.data.tipo || "");
    setEstado({ label: secadora.data.estado, value: secadora.data.estado });
    window.scrollTo({ top: 100, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/secadoras/${id}`, { method: "DELETE" });
      if (res.ok) {
        messageApiRef.current.success("Secadora eliminada");
        cargarSecadoras();
        if (selectedSecadora?.value === id) resetForm();
      }
    } catch {
      messageApiRef.current.error("Error de servidor");
    }
  };

  const fields = [
    { label: "Nombre de Secadora", value: nombre, setter: setNombre, type: "text", required: true, error: errors["Nombre de Secadora"] },
    { label: "Capacidad (QQ)", value: capacidad, setter: setCapacidad, type: "Float", required: true, error: errors["Capacidad (QQ)"], validator: validarFloatPositivo },
    { label: "Tipo / Equipo", value: tipo, setter: setTipo, type: "text", placeholder: "Ej: Guardiola #1..." },
    { label: "Estado Operativo", value: estado, setter: setEstado, type: "select", options: [{ label: "Disponible", value: "Disponible" }, { label: "En Uso", value: "En Uso" }, { label: "Mantenimiento", value: "Mantenimiento" }], required: true }
  ];

  const columnas = [
    {
      title: "IDENTIFICACIÓN",
      key: "nombre",
      width: "30%",
      render: (_, r) => (
        <Space size="small">
          <div style={{ padding: "6px", background: "#f3f4f6", borderRadius: "8px" }}>
            <BuildOutlined style={{ fontSize: "16px", color: "#6366f1" }} />
          </div>
          <div>
            <Text strong style={{ fontSize: "14px", color: "#111827", display: "block" }}>{r.data.nombre}</Text>
            <Text type="secondary" style={{ fontSize: "11px" }}>{r.data.tipo || "Sin tipo"}</Text>
          </div>
        </Space>
      )
    },
    {
      title: "CAPACIDAD",
      dataIndex: ["data", "capacidad"],
      key: "capacidad",
      align: "center",
      render: (v) => (
        <div>
          <Text strong style={{ fontSize: "15px", color: "#4f46e5" }}>{v}</Text>
          <Text type="secondary" style={{ marginLeft: "4px", fontSize: "12px" }}>QQ</Text>
        </div>
      )
    },
    {
      title: "ESTADO",
      dataIndex: ["data", "estado"],
      key: "estado",
      align: "center",
      render: (est) => {
        const config = estadoConfig[est] || { color: "default", label: est, icon: null };
        return (
          <Tag
            color={config.color}
            icon={config.icon}
            style={{ padding: "0 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, border: "none" }}
          >
            {config.label.toUpperCase()}
          </Tag>
        );
      }
    },
    {
      title: "ACCIONES",
      key: "acciones",
      align: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Editar">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: "#4f46e5" }} />}
              onClick={() => handleEdit(record)}
              style={{ borderRadius: "6px" }}
            />
          </Tooltip>
          <Popconfirm title="¿Eliminar definitivamente?" onConfirm={() => handleDelete(record.value)} okButtonProps={{ danger: true }}>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.data.estado === "En Uso"}
              style={{ borderRadius: "6px" }}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA"]}>
      <div style={{ padding: "16px", maxWidth: "1400px", margin: "0 auto", background: "#f8fafc", minHeight: "100vh" }}>
        {contextHolder}

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <div>
                <Title level={2} style={{ margin: 0, fontWeight: 900, letterSpacing: "-1px", color: "#1e1b4b" }}>Secadoras</Title>
              </div>
              <Badge count={secadoras.length} color="#6366f1" size="small">
                <div style={{ padding: "6px 16px", background: "white", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
                  <Text strong style={{ fontSize: "12px" }}>Total de Equipos</Text>
                </div>
              </Badge>
            </div>
          </Col>

          {/* FORMULARIO PRIMERO */}
          <Col span={24} style={{ maxWidth: "800px", margin: "0 auto" }}>
            <Card
              size="small"
              title={<span style={{ fontWeight: 800, fontSize: "15px" }}>{selectedSecadora ? "MODIFICAR SECADORA" : "REGISTRAR NUEVA SECADORA"}</span>}
              bordered={false}
              extra={selectedSecadora && <Button type="link" size="small" danger onClick={resetForm}>Cancelar</Button>}
              style={{ borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)", border: selectedSecadora ? "2px solid #6366f1" : "1px solid #e5e7eb" }}
            >
              <Formulario
                fields={fields}
                onSubmit={handleRegistrarClick}
                submitting={submitting}
                button={{ text: selectedSecadora ? "ACTUALIZAR DATOS" : "GUARDAR EQUIPO", onClick: handleRegistrarClick, style: { height: "40px", borderRadius: "8px", width: "100%", fontWeight: 700, fontSize: "14px" } }}
              />
            </Card>
          </Col>

          {/* TABLA DESPUÉS */}
          <Col span={24}>
            <Card
              size="small"
              bordered={false}
              style={{ borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.04)" }}
              styles={{ body: { padding: "0" } }}
            >
              <Table
                dataSource={secadoras}
                columns={columnas}
                rowKey="value"
                pagination={{ pageSize: 10, size: "small" }}
                scroll={{ x: 600 }}
                style={{ borderRadius: "12px", overflow: "hidden" }}
              />
            </Card>
          </Col>
        </Row>

        <PreviewModal
          open={previewVisible}
          title="Verificación de Datos"
          onCancel={() => setPreviewVisible(false)}
          onConfirm={handleConfirmar}
          confirmLoading={submitting}
          fields={fields.map((f) => ({
            label: f.label,
            value: f.type === "select" ? (f.value?.label || f.value) : f.value
          }))}
        />
      </div>
    </ProtectedPage>
  );
}
