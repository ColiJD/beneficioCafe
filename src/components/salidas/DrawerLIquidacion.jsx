"use client";

import { Drawer, Button, InputNumber, Form, Input, message } from "antd";
import { useState } from "react";

export default function LiquidacionDrawer({
  visible,
  onClose,
  comprador,
  cantidadPendiente,
  onLiquidar,
  messageApi,
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const roundToTwo = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();

      if (values.cantidadLiquidar > roundToTwo(cantidadPendiente)) {
        messageApi.error("La cantidad a liquidar excede lo pendiente");
        return;
      }

      setSubmitting(true);

      await onLiquidar({
        cantidadLiquidar: values.cantidadLiquidar,
        descripcion: values.descripcion,
      });

      form.resetFields();
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
      width={400}
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
      <p>
        <strong>Total pendiente:</strong> {Number(cantidadPendiente).toFixed(2)}{" "}
        QQ
      </p>

      <Form form={form} layout="vertical">
        <Form.Item
          label="Cantidad a liquidar"
          name="cantidadLiquidar"
          rules={[{ required: true, message: "Ingrese cantidad" }]}
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
