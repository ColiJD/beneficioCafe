import { Drawer, Button, InputNumber, Form, Input, Select } from "antd";
import { useState, useMemo } from "react";

export default function LiquidacionDrawer({
  visible,
  onClose,
  comprador,
  detalles = [],
  onLiquidar,
  messageApi,
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);

  const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

  // Obtener productos únicos de los detalles pendientes
  const productosDisponibles = useMemo(() => {
    const map = new Map();
    detalles.forEach((d) => {
      if (!map.has(d.productoID)) {
        map.set(d.productoID, d.productName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [detalles]);

  // Cantidad pendiente para el producto seleccionado
  const cantidadPendienteProducto = useMemo(() => {
    if (!productoSeleccionado) return 0;
    return detalles
      .filter((d) => d.productoID === productoSeleccionado)
      .reduce((sum, d) => sum + Number(d.cantidadPendiente || 0), 0);
  }, [detalles, productoSeleccionado]);

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();

      if (values.cantidadLiquidar > roundToTwo(cantidadPendienteProducto)) {
        messageApi.error(
          `La cantidad excede lo pendiente para este producto (${cantidadPendienteProducto.toFixed(2)} QQ)`,
        );
        return;
      }

      setSubmitting(true);

      await onLiquidar({
        productoID: values.productoID,
        cantidadLiquidar: values.cantidadLiquidar,
        descripcion: values.descripcion,
      });

      form.resetFields();
      setProductoSeleccionado(null);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      title={`Liquidar Salida - ${comprador?.label || ""}`}
      width={450}
      onClose={onClose}
      open={visible}
      footer={
        <div style={{ textAlign: "right" }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} type="primary" loading={submitting}>
            Liquidar
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Producto a Liquidar"
          name="productoID"
          rules={[{ required: true, message: "Seleccione un producto" }]}
        >
          <Select
            options={productosDisponibles}
            placeholder="Seleccione el producto"
            onChange={(val) => setProductoSeleccionado(val)}
          />
        </Form.Item>

        <p>
          <strong>Pendiente para este producto:</strong>{" "}
          {Number(cantidadPendienteProducto).toFixed(2)} QQ
        </p>

        <Form.Item
          label="Cantidad a liquidar"
          name="cantidadLiquidar"
          rules={[
            { required: true, message: "Ingrese cantidad" },
            {
              type: "number",
              min: 0.01,
              message: "Cantidad debe ser mayor a 0",
            },
          ]}
        >
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="Descripción" name="descripcion">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
