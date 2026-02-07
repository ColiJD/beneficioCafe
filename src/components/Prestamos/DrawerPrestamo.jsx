"use client";

import { useState, useEffect } from "react";
import {
  Drawer,
  Form,
  InputNumber,
  Input,
  DatePicker,
  Button,
  Space,
  Select,
} from "antd";

export const moneyFormatter = {
  formatter: (value) =>
    value ? `L. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "L. 0",
  parser: (value) => value.replace(/L\.\s?|(,*)/g, ""),
};

export const percentFormatter = {
  formatter: (value) => `${value}%`,
  parser: (value) => value.replace("%", ""),
};

export default function DrawerPrestamo({
  open,
  onClose,
  onSubmit,
  cliente,
  formRef,
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState("PRESTAMO");

  // Pasamos el form al padre
  useEffect(() => {
    if (formRef) formRef.current = form;
  }, [form, formRef]);
  // Inicializamos el tipo de movimiento al abrir el Drawer
  useEffect(() => {
    if (open) {
      const tipoActual = form.getFieldValue("tipo");
      // Solo establecer PRESTAMO si no hay tipo definido
      if (!tipoActual) {
        setTipoMovimiento("PRESTAMO");
        form.setFieldsValue({ tipo: "PRESTAMO" });
      } else {
        setTipoMovimiento(tipoActual); // conserva la elección anterior
      }
    }
  }, [open, form]);

  const handleFinish = async (values) => {
    setLoading(true);
    try {
      await onSubmit({
        ...values,
        tipo: tipoMovimiento,
        clienteID: cliente?.clienteID,
      });
      // ❌ NO resetear ni cerrar aquí
    } catch (err) {
      console.error("Error al guardar:", err);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: "100%" };

  const camposPorTipo = {
    PRESTAMO: (
      <>
        <Form.Item
          label="Monto del préstamo"
          name="monto"
          rules={[{ required: true, message: "Ingrese el monto del préstamo" }]}
        >
          <InputNumber
            {...moneyFormatter}
            min={0}
            step={100}
            style={inputStyle}
          />
        </Form.Item>

        <Form.Item
          label="Tasa de interés (%)"
          name="tasa_interes"
          rules={[{ required: true, message: "Ingrese la tasa de interés" }]}
        >
          <InputNumber
            min={0}
            step={0.1}
            style={inputStyle}
            {...percentFormatter}
          />
        </Form.Item>
      </>
    ),
    ANTICIPO: (
      <Form.Item
        label="Monto del anticipo"
        name="monto"
        rules={[{ required: true, message: "Ingrese el monto del anticipo" }]}
      >
        <InputNumber
          {...moneyFormatter}
          min={0}
          step={100}
          style={inputStyle}
        />
      </Form.Item>
    ),
    ABONO: (
      <Form.Item
        label="Monto del abono a capital"
        name="monto"
        rules={[{ required: true, message: "Ingrese el monto del abono" }]}
      >
        <InputNumber
          {...moneyFormatter}
          min={0}
          step={100}
          style={inputStyle}
        />
      </Form.Item>
    ),
    PAGO_INTERES: (
      <Form.Item
        label="Monto del pago de interés"
        name="monto"
        rules={[{ required: true, message: "Ingrese el monto del pago" }]}
      >
        <InputNumber
          {...moneyFormatter}
          min={0}
          step={100}
          style={inputStyle}
        />
      </Form.Item>
    ),
    ABONO_ANTICIPO: (
      <Form.Item
        label="Monto del abono al anticipo"
        name="monto"
        rules={[{ required: true, message: "Ingrese el monto del abono" }]}
      >
        <InputNumber
          {...moneyFormatter}
          min={0}
          step={100}
          style={inputStyle}
        />
      </Form.Item>
    ),
    INTERES_ANTICIPO: (
      <Form.Item
        label="Monto del pago de anticipo"
        name="monto"
        rules={[{ required: true, message: "Ingrese el monto del pago" }]}
      >
        <InputNumber
          {...moneyFormatter}
          min={0}
          step={100}
          style={inputStyle}
        />
      </Form.Item>
    ),
  };

  return (
    <Drawer
      title={`Nuevo Registro - ${cliente?.clienteNombre || ""} ${
        cliente?.clienteApellido || ""
      }`}
      width={400}
      onClose={onClose}
      open={open}
      placement="left"
      maskClosable
      mask={false}
    >
      <Form
        layout="vertical"
        form={form}
        onFinish={handleFinish}
        initialValues={{ tipo: "PRESTAMO" }}
      >
        <Form.Item
          label="Tipo de movimiento"
          name="tipo"
          rules={[{ required: true, message: "Seleccione un tipo" }]}
        >
          <Select
            value={tipoMovimiento}
            onChange={(val) => {
              setTipoMovimiento(val);
              // Solo limpiar campos que solo aplican a Préstamo
              if (val === "PRESTAMO") {
                form.resetFields(["monto", "tasa_interes"]);
              } else {
                form.resetFields(["monto"]);
              }
            }}
          >
            <Select.Option value="PRESTAMO">Préstamo</Select.Option>
            <Select.Option value="ANTICIPO">Anticipo</Select.Option>
            <Select.Option value="ABONO">Abono a Capital</Select.Option>
            <Select.Option value="PAGO_INTERES">Pago de Interés</Select.Option>
            <Select.Option value="ABONO_ANTICIPO">
              Abono a Anticipo
            </Select.Option>
            <Select.Option value="INTERES_ANTICIPO">
              Interes de Anticipo
            </Select.Option>
          </Select>
        </Form.Item>

        {camposPorTipo[tipoMovimiento]}

        <Form.Item
          label="Fecha del movimiento"
          name="fecha"
          rules={[{ required: true, message: "Seleccione una fecha" }]}
        >
          <DatePicker style={inputStyle} format="YYYY-MM-DD" />
        </Form.Item>

        <Form.Item label="Observación" name="observacion">
          <Input.TextArea
            rows={3}
            placeholder="Ejemplo: pago parcial, préstamo nuevo, etc."
          />
        </Form.Item>

        <Space style={{ display: "flex", justifyContent: "end" }}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Guardar
          </Button>
        </Space>
      </Form>
    </Drawer>
  );
}
