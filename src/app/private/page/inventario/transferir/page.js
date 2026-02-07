"use client";
import { useState, useEffect } from "react";
import { Table, message, Spin } from "antd";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import { obtenerProductosSelect } from "@/lib/consultas";
import ProtectedPage from "@/components/ProtectedPage";
import dayjs from "dayjs";
import { limpiarFormulario } from "@/config/validacionesForm";
import { FloatingButton } from "@/components/Button";
import { PlusOutlined } from "@ant-design/icons";

export default function ConvertirCafe() {
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loadingDatos, setLoadingDatos] = useState(true);
  const [loadingMovimientos, setLoadingMovimientos] = useState(true);

  const [fromProducto, setFromProducto] = useState(null);
  const [toProducto, setToProducto] = useState(null);
  const [cantidadQQ, setCantidadQQ] = useState("");
  const [nota, setNota] = useState("");

  const [errors, setErrors] = useState({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();

  // 🔹 Cargar productos para selects
  useEffect(() => {
    async function cargarProductos() {
      setLoadingDatos(true);
      try {
        const productosData = await obtenerProductosSelect(messageApi);
        setProductos(productosData);
      } catch (err) {
        console.error(err);
        messageApi.error("Error cargando productos");
      } finally {
        setLoadingDatos(false);
      }
    }
    cargarProductos();
  }, [messageApi]);

  // 🔹 Cargar movimientos de tipo "Transferencia"
  useEffect(() => {
    async function cargarMovimientos() {
      setLoadingMovimientos(true);
      try {
        const res = await fetch("/api/inventario/transferir");
        const data = await res.json();
        setMovimientos(data || []);
      } catch (err) {
        console.error(err);
        messageApi.error("Error cargando movimientos");
      } finally {
        setLoadingMovimientos(false);
      }
    }
    cargarMovimientos();
  }, [messageApi, submitting]); // recarga cuando se haga una conversión

  // 🔹 Validar campos y abrir preview
  const handleRegistrarClick = () => {
    const newErrors = {};
    if (!fromProducto) newErrors.fromProducto = "Seleccione producto origen";
    if (!toProducto) newErrors.toProducto = "Seleccione producto destino";
    if (!cantidadQQ || cantidadQQ <= 0)
      newErrors.cantidadQQ = "Ingrese cantidad válida";

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) setPreviewVisible(true);
    else messageApi.warning("Complete los campos obligatorios correctamente");
  };

  // 🔹 Confirmar conversión
  const handleConfirmar = async () => {
    setSubmitting(true);
    const payload = {
      fromProductID: fromProducto.value,
      toProductID: toProducto.value,
      cantidadQQ,
      nota,
    };

    try {
      const res = await fetch("/api/inventario/transferir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        messageApi.success("Conversión realizada correctamente!");
        setPreviewVisible(false);
        limpiarFormulario({
          setFromProducto,
          setToProducto,
          setCantidadQQ,
          setNota,
          setErrors,
        });
      } else {
        messageApi.error(data.error || "Error en la conversión");
      }
    } catch (err) {
      console.error(err);
      messageApi.error("Error de red o servidor");
    } finally {
      setSubmitting(false);
    }
  };

  const fields = [
    {
      label: "Producto Origen",
      value: fromProducto,
      setter: setFromProducto,
      type: "select",
      options: productos,
      required: true,
      error: errors.fromProducto,
    },
    {
      label: "Cantidad a Convertir (QQ)",
      value: cantidadQQ,
      setter: setCantidadQQ,
      type: "Float",
      required: true,
      error: errors.cantidadQQ,
    },
    {
      label: "Producto Destino",
      value: toProducto,
      setter: setToProducto,
      type: "select",
      options: productos,
      required: true,
      error: errors.toProducto,
    },
    {
      label: "Nota",
      value: nota,
      setter: setNota,
      type: "textarea",
    },
  ];

  // 🔹 Columnas de la tabla de movimientos
  const columnas = [
    { title: "ID", dataIndex: "movimientoID", key: "movimientoID" },

    {
      title: "Tipo Movimiento",
      dataIndex: "tipoMovimiento",
      key: "tipoMovimiento",
    },
    { title: "Cantidad QQ", dataIndex: "cantidadQQ", key: "cantidadQQ" },
    { title: "Nota", dataIndex: "nota", key: "nota" },
    { title: "Referencia", dataIndex: "referenciaTipo", key: "referenciaTipo" },
    {
      title: "Fecha",
      dataIndex: "fecha",
      key: "fecha",
      render: (val) => dayjs(val).format("DD/MM/YYYY HH:mm"),
    },
  ];

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS"]}>
      <>
        {contextHolder}
        {loadingDatos ? (
          <div
            style={{
              minHeight: "16rem",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Spin size="large" />
          </div>
        ) : (
          <>
            <Formulario
              title="Conversión de Café"
              fields={fields}
              onSubmit={handleRegistrarClick}
              submitting={submitting}
              button={{
                text: "Realizar Conversión",
                onClick: handleRegistrarClick,
                type: "primary",
              }}
              button2={{
                text: "Transferencia",
                onClick: () => {},
                type: "default",
                hidden: true,
              }}
            />

            <PreviewModal
              open={previewVisible}
              title="Previsualización de Conversión"
              onCancel={() => setPreviewVisible(false)}
              onConfirm={handleConfirmar}
              confirmLoading={submitting}
              fields={fields.map((f) => ({
                label: f.label,
                value:
                  f.type === "select" ? f.value?.label || "-" : f.value || "-",
              }))}
            />

            <div style={{ marginTop: "2rem" }}>
              <h3>Movimientos de Tipo Transferencia</h3>
              {loadingMovimientos ? (
                <Spin />
              ) : (
                <Table
                  dataSource={movimientos}
                  columns={columnas}
                  rowKey="movimientoID"
                  pagination={{ pageSize: 10 }}
                />
              )}
            </div>
          </>
        )}
      </>
    </ProtectedPage>
  );
}
