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

import usePermisos from "@/components/usePermisos";
import { puedeEnModulo } from "@/lib/modulos";

// tipo de movimiento → módulo que lo autoriza (préstamos y anticipos son independientes)
const TIPOS = [
  ["PRESTAMO", "Préstamo", "p"], ["ANTICIPO", "Anticipo", "a"],
  ["ABONO", "Abono a Capital", "p"], ["PAGO_INTERES", "Pago de Interés", "p"],
  ["ABONO_ANTICIPO", "Abono a Anticipo", "a"], ["INTERES_ANTICIPO", "Interes de Anticipo", "a"],
];

export default function DrawerPrestamo({
  open,
  onClose,
  onFinish,
  clienteSeleccionado,
  compradorSeleccionado,
  formRef,
  tipoPersona = "cliente",
}) {
  const [form] = Form.useForm();
  const acc = usePermisos();
  const mod = tipoPersona === "comprador"
    ? { p: "prestamosCompradores", a: "anticiposCompradores" }
    : { p: "prestamos", a: "anticipos" };
  const permitidos = TIPOS.filter(([, , k]) => puedeEnModulo(acc, mod[k], "crear"));
  const [loading, setLoading] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState("PRESTAMO");
  const personaSeleccionada =
    tipoPersona === "comprador" ? compradorSeleccionado : clienteSeleccionado;

  // Pasamos el form al padre
  useEffect(() => {
    if (formRef) formRef.current = form;
  }, [form, formRef]);
  useEffect(() => {
    const t = form.getFieldValue("tipo");
    if (permitidos.length && !permitidos.some(([v]) => v === t)) {
      setTipoMovimiento(permitidos[0][0]);
      form.setFieldsValue({ tipo: permitidos[0][0] });
    }
  }, [open, acc]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const payload = {
        ...values,
        tipo: tipoMovimiento,
        tipo_movimiento: tipoMovimiento,
      };

      // Manejar dinámicamente según el tipo de persona
      if (tipoPersona === "comprador") {
        payload.compradorID = personaSeleccionada?.compradorId;
      } else {
        payload.clienteID = personaSeleccionada?.clienteID;
      }

      await onFinish(payload);

      form.resetFields();
      setTipoMovimiento("PRESTAMO");
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
      title={`Nuevo Registro - ${
        tipoPersona === "comprador"
          ? personaSeleccionada?.compradorNombre || ""
          : `${personaSeleccionada?.clienteNombre || ""} ${
              personaSeleccionada?.clienteApellido || ""
            }`
      }`}
      width={400}
      onClose={onClose}
      open={open}
      placement="left"
      maskClosable
      mask={false}
      forceRender
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
            {permitidos.map(([v, l]) => (
              <Select.Option key={v} value={v}>{l}</Select.Option>
            ))}
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
