"use client";
import { useState, useEffect, useRef } from "react";
import { message, Button, Space, Popconfirm, Table, Tooltip } from "antd";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import { obtenerProductosSelect } from "@/lib/consultas";
import {
  limpiarFormulario,
  validarFloatPositivo,
} from "@/config/validacionesForm";
import { validarDatos } from "@/lib/validacionesForm";
import ProtectedPage from "@/components/ProtectedPage";
export default function FormProducto() {
  const [productos, setProductos] = useState([]);
  const [selectedProducto, setSelectedProducto] = useState(null);

  const [productName, setProductName] = useState("");
  const [tara, setTara] = useState(0);
  const [descuento, setDescuento] = useState(0);
  const [factorOro, setFactorOro] = useState(1);

  const [errors, setErrors] = useState({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();
  const messageApiRef = useRef(messageApi);

  // Cargar productos existentes
  useEffect(() => {
    async function cargarProductos() {
      try {
        const opciones = await obtenerProductosSelect(messageApiRef.current);
        setProductos(opciones);
      } catch (err) {
        console.error(err);
        messageApiRef.current.error("Error cargando productos");
      }
    }
    cargarProductos();
  }, []);
  // 👇 agrega este useEffect dentro de tu componente
  useEffect(() => {
    if (!productName.trim()) {
      // limpiar todo si el nombre queda vacío
      limpiarFormulario({
        setProductName,
        setTara,
        setDescuento,
        setFactorOro,
        setErrors,
      });
      setSelectedProducto(null); // vuelve a modo "Agregar"
    }
  }, [productName]);

  // Manejar clic de registro / actualización
  const handleRegistrarClick = () => {
    if (validarDatos(fields, messageApi, setErrors)) {
      setPreviewVisible(true);
    }
  };

  const handleConfirmar = async () => {
    setSubmitting(true);
    const payload = {
      productName: productName.trim(),
      tara: parseFloat(tara),
      descuento: parseFloat(descuento),
      factorOro: parseFloat(factorOro),
    };

    const url = selectedProducto
      ? `/api/productos/${selectedProducto.value}`
      : "/api/productos";
    const method = selectedProducto ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        messageApiRef.current.success(
          selectedProducto ? "Producto actualizado" : "Producto agregado"
        );
        setPreviewVisible(false);
        limpiarFormulario({
          setProductName,
          setTara,
          setDescuento,
          setFactorOro,
          setErrors,
        });
        setSelectedProducto(null);
        const opciones = await obtenerProductosSelect(messageApiRef.current);
        setProductos(opciones);
      } else {
        const err = await res.json();
        messageApiRef.current.error(
          err.error || "Error al guardar el producto"
        );
      }
    } catch {
      messageApiRef.current.error("Error de red o servidor");
    } finally {
      setSubmitting(false);
    }
  };
  // Definición de campos — se reconstruye en cada render para capturar los estados actuales
  const fields = [
    {
      label: "Nombre del Producto",
      value: productName,
      setter: setProductName,
      type: "text",
      required: true,
      error: errors["Nombre del Producto"],
      validator: (v) => (v?.trim() ? null : "Ingrese el nombre del producto"),
    },
    {
      label: "Tara (%)",
      tooltip:
        "Porcentaje del peso de los sacos que se descuenta : 0 → nada, 0.5 → mitad , 1 → totalidad de los sacos .",
      value: tara,
      setter: setTara,
      type: "Float",
      required: true,
      error: errors["Tara (%)"],
      validator: validarFloatPositivo,
    },
    {
      label: "Descuento (%)",
      value: descuento,
      setter: setDescuento,
      type: "Float",
      required: true,
      error: errors["Descuento (%)"],
      validator: validarFloatPositivo,
      tooltip:
        " Porcentaje de descuento sobre el peso neto : 0 → nada, 0.5 → mitad , 1 → totalidad del peso neto .",
    },
    {
      label: "Factor Oro",
      value: factorOro,
      setter: setFactorOro,
      type: "Float",
      required: true,
      error: errors["Factor Oro"],
      tooltip: " Multiplicador que determina los quintales de oro obtenidos .",
      validator: validarFloatPositivo,
    },
  ];

  // Editar producto
  const handleEdit = (producto) => {
    setSelectedProducto(producto);
    setProductName(producto.data.productName);
    setTara(producto.data.tara);
    setDescuento(producto.data.descuento);
    setFactorOro(producto.data.factorOro);

    messageApiRef.current.info("Modo edición activado");
  };

  // Eliminar producto
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/productos/${id}`, { method: "DELETE" });
      if (res.ok) {
        messageApiRef.current.success("Producto eliminado");
        setProductos(productos.filter((p) => p.value !== id));
        if (selectedProducto?.value === id) {
          limpiarFormulario({
            setProductName,
            setTara,
            setDescuento,
            setFactorOro,
            setErrors,
          });
          setSelectedProducto(null);
        }
      } else {
        const err = await res.json();
        messageApiRef.current.error(
          err.error || "Error al eliminar el producto"
        );
      }
    } catch {
      messageApiRef.current.error("Error de red o servidor");
    }
  };
  // Columnas para Ant Design Table
  const columnas = [
    { title: "Nombre", dataIndex: ["data", "productName"], key: "productName" },
    { title: "Tara (%)", dataIndex: ["data", "tara"], key: "tara" },
    {
      title: "Descuento (%)",
      dataIndex: ["data", "descuento"],
      key: "descuento",
    },
    { title: "Factor Oro", dataIndex: ["data", "factorOro"], key: "factorOro" },
    {
      title: "Acciones",
      key: "acciones",
      render: (_, record) => (
        <Space size="middle">
          <Button type="primary" onClick={() => handleEdit(record)}>
            Editar
          </Button>
          <Popconfirm
            title="¿Seguro que deseas eliminar este producto?"
            onConfirm={() => handleDelete(record.value)}
            okText="Sí"
            cancelText="No"
          >
            <Button danger>Eliminar</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS"]}>
      <>
        {contextHolder}

        <Formulario
          title={selectedProducto ? "Editar Producto" : "Agregar Producto"}
          fields={fields}
          onSubmit={handleRegistrarClick}
          submitting={submitting}
          button={{
            text: selectedProducto ? "Actualizar Producto" : "Guardar Producto",
            onClick: handleRegistrarClick,
            type: "primary",
          }}
        />

        <PreviewModal
          open={previewVisible}
          title="Previsualización del Producto"
          onCancel={() => setPreviewVisible(false)}
          onConfirm={handleConfirmar}
          confirmLoading={submitting}
          fields={fields.map((f) => ({ label: f.label, value: f.value }))}
        />

        <Table
          dataSource={productos}
          columns={columnas}
          rowKey="value"
          pagination={{ pageSize: 3 }}
          bordered
          style={{ marginTop: 24 }}
        />
      </>
    </ProtectedPage>
  );
}
