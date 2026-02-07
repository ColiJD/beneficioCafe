"use client";
import { Modal, Button } from "antd";

export default function PreviewModal({
  open,
  title = "Previsualización",
  fields = [],
  onCancel,
  onConfirm,
  confirmLoading = false,
  okText = "Confirmar",
  cancelText = "Cancelar",
  extraButtons = [],
}) {
  // Formatea números con comas
  const formatValue = (label, value) => {
    if (value === undefined || value === null || value === "") return "-";

    // No formatear estos campos
    if (["Cédula", "Teléfono", "RTN","Clave IHCAFE"].includes(label)) {
      return value.toString().trim();
    }

    const numero = parseFloat(value);
    if (!isNaN(numero)) {
      return numero.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return value;
  };
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={onConfirm}
      confirmLoading={confirmLoading}
      okText={okText}
      cancelText={cancelText}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {cancelText}
        </Button>,
        ...extraButtons,
        <Button
          key="confirm"
          type="primary"
          loading={confirmLoading}
          onClick={onConfirm}
        >
          {okText}
        </Button>,
      ]}
    >
      {fields.map((field, index) => (
        <p key={index}>
          <strong>{field.label}:</strong>{" "}
          {formatValue(field.label, field.value)}
        </p>
      ))}
    </Modal>
  );
}
