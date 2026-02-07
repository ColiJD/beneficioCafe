"use client";

import { useState, useEffect } from "react";
import {
  Drawer,
  Form,
  InputNumber,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
} from "antd";
import dayjs from "dayjs";
import { formatNumber } from "../Formulario";
import { moneyFormatter, percentFormatter } from "./DrawerPrestamo";

export default function DrawerInteres({ open, onClose, onSubmit, cliente }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [dias, setDias] = useState(0);
  const [totalInteres, setTotalInteres] = useState(0);

  // Calcular días entre fechas
  const calcularDias = () => {
    const { fechaInicio, fechaCalculo } = form.getFieldsValue([
      "fechaInicio",
      "fechaCalculo",
    ]);

    if (fechaInicio && fechaCalculo) {
      const diff = dayjs(fechaCalculo).diff(dayjs(fechaInicio), "day");
      const diasValidos = diff >= 0 ? diff : 0;
      setDias(diasValidos);
      form.setFieldsValue({ dias: diasValidos });
    } else {
      setDias(0);
      form.setFieldsValue({ dias: 0 });
    }
  };

  // Calcular total interés
  const calcularInteres = () => {
    const { saldo, interes } = form.getFieldsValue(["saldo", "interes"]);
    if (saldo && interes && dias > 0) {
      const interesDiario = interes / 100 / 30;
      const total = saldo * interesDiario * dias;
      setTotalInteres(total);
      form.setFieldsValue({ totalInteres: total });
    } else {
      setTotalInteres(0);
      form.setFieldsValue({ totalInteres: 0 });
    }
  };

  useEffect(() => {
    calcularDias();
  }, [form]);

  useEffect(() => {
    calcularInteres();
  }, [dias]);

  const handleFinish = async (values) => {
    setLoading(true);
    try {
      await onSubmit({
        tipo: values.tipoMovimiento,
        clienteID: cliente?.clienteID,
        tipo_movimiento: "Int-Cargo",
        monto: values.totalInteres,
        fecha: new Date(),
        descripcion: values.observacion,
        interes: values.interes,
        dias: values.dias,
      });

      form.resetFields();
      setDias(0);
      setTotalInteres(0);
      onClose();
    } catch (err) {
      console.error("Error al guardar:", err);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: "100%" };

  return (
    <Drawer
      title={`Cálculo de Interés - ${cliente?.clienteNombre || ""} ${
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
        onValuesChange={() => {
          calcularDias();
          calcularInteres();
        }}
      >
        <Form.Item
          label="Tipo de movimiento"
          name="tipoMovimiento"
          rules={[{ required: true, message: "Seleccione un tipo" }]}
        >
          <Select placeholder="Seleccione tipo de movimiento">
            <Select.Option value="Int-Cargo">Int-Cargo</Select.Option>
            <Select.Option value="CARGO_ANTICIPO">CARGO_ANTICIPO</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item
          label="Fecha Inicio"
          name="fechaInicio"
          rules={[{ required: true, message: "Seleccione la fecha de inicio" }]}
        >
          <DatePicker
            style={inputStyle}
            format="YYYY-MM-DD"
            onChange={calcularDias}
          />
        </Form.Item>

        <Form.Item
          label="Fecha Cálculo"
          name="fechaCalculo"
          rules={[
            { required: true, message: "Seleccione la fecha de cálculo" },
          ]}
        >
          <DatePicker
            style={inputStyle}
            format="YYYY-MM-DD"
            onChange={calcularDias}
            disabledDate={(current) => {
              const fechaInicio = form.getFieldValue("fechaInicio");
              return fechaInicio && current.isBefore(fechaInicio, "day");
            }}
          />
        </Form.Item>

        <Form.Item label="Días calculados" name="dias">
          <InputNumber style={inputStyle} readOnly value={dias} />
        </Form.Item>

        <Form.Item
          label="Saldo de cálculo"
          name="saldo"
          rules={[{ required: true, message: "Ingrese el saldo base" }]}
        >
          <InputNumber
            {...moneyFormatter}
            min={0}
            step={100}
            style={inputStyle}
            onChange={calcularInteres}
          />
        </Form.Item>

        <Form.Item
          label="% Interés mensual"
          name="interes"
          rules={[{ required: true, message: "Ingrese la tasa de interés" }]}
        >
          <InputNumber
            min={0}
            max={100}
            step={0.1}
            style={inputStyle}
            suffix="%"
            onChange={calcularInteres}
            {...percentFormatter}
          />
        </Form.Item>

        <Form.Item label="Total interés" name="totalInteres">
          <InputNumber
            prefix="L."
            style={inputStyle}
            readOnly
            value={totalInteres}
            formatter={(value) => formatNumber(value)}
          />
        </Form.Item>

        <Form.Item label="Observación" name="observacion">
          <Input.TextArea
            rows={3}
            placeholder="Ejemplo: cálculo de interés pendiente, etc."
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
