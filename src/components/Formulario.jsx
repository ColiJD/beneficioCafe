import { Form, Input, Button, Row, Col, Tooltip } from "antd";
import React from "react";
import Select from "react-select";
import { InfoCircleOutlined } from "@ant-design/icons";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { usePathname } from "next/navigation";
import usePermisos from "@/components/usePermisos";
import { puedeEnRuta, puedeEnModulo } from "@/lib/modulos";

// Funciones de formato
export const formatNumber = (num, type) => {
  if (num === "" || num === null || num === undefined) return "";
  const n = parseFloat(num.toString().replace(/,/g, ""));
  if (isNaN(n)) return "";
  if (type === "integer") return Math.round(n).toLocaleString("es-HN");
  return n.toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function Formulario({
  title,
  fields,
  onSubmit,
  submitting,
  button,
  buttons,
}) {
  const [rawValues, setRawValues] = React.useState({});
  const acc = usePermisos();
  const pathname = usePathname();
  // btn.accion ("crear" | "editar" | "eliminar"): sin ese permiso el botón queda deshabilitado
  const sinPermiso = (b) =>
    !!b?.accion &&
    !(b.modulo ? puedeEnModulo(acc, b.modulo, b.accion) : puedeEnRuta(acc, pathname, b.accion));

  // Manejo de cambio de número (integer o float)
  const handleNumberChange = (label, setter, type) => (e) => {
    let val = e.target.value;

    if (type === "integer" && !/^\d*$/.test(val)) return;
    if (type === "Float" && !/^\d*\.?\d{0,2}$/.test(val)) return;

    setter(val);
    setRawValues((prev) => ({ ...prev, [label]: val }));
  };

  // Manejo de blur (formato)
  const handleNumberBlur = (label, value, type) => {
    setRawValues((prev) => ({
      ...prev,
      [label]: formatNumber(value ?? "", type),
    }));
  };
  React.useEffect(() => {
    // Si todos los campos vienen vacíos después de limpiar
    if (
      fields.every(
        (f) => f.value === "" || f.value === null || f.value === undefined
      )
    ) {
      setRawValues({});
    }
  }, [fields]);

  const handlePhoneChange = (setter) => (phone) => {
    // Asegurarse de guardar con +
    const formatted = phone.startsWith("+") ? phone : "+" + phone;
    setter(formatted);
  };

  React.useEffect(() => {
    // Si todos los campos vienen vacíos después de limpiar
    if (
      fields.every(
        (f) => f.value === "" || f.value === null || f.value === undefined
      )
    ) {
      setRawValues({});
    }
  }, [fields]);

  return (
    <Form layout="vertical" onSubmitCapture={onSubmit}>
      {title && (
        <h2 style={{ textAlign: "left", marginBottom: "1rem" }}>{title}</h2>
      )}
      <Row gutter={16}>
        {fields.map((f, idx) => (
          <Col key={idx} xs={24} sm={12}>
            <Form.Item
              label={
                <span>
                  {f.label}{" "}
                  {f.tooltip && (
                    <Tooltip title={f.tooltip}>
                      <InfoCircleOutlined style={{ color: "#4A2E16" }} />
                    </Tooltip>
                  )}
                </span>
              }
              required={f.required}
              validateStatus={f.error ? "error" : ""}
              help={f.error}
            >
              {f.type === "select" ? (
                <Select
                  options={f.options || []}
                  readOnly={f.readOnly}
                  value={
                    f.options?.find((o) => o.value === f.value?.value) || null
                  }
                  onChange={f.setter}
                  placeholder={`Seleccione ${f.label}`}
                  isClearable
                  isDisabled={!f.options || f.options.length === 0} // <-- deshabilita si no hay opciones
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderColor: f.error ? "red" : base.borderColor,
                    }),
                  }}
                />
              ) : f.type === "textarea" ? (
                <Input.TextArea
                  value={f.value}
                  onChange={(e) => f.setter(e.target.value)}
                  readOnly={f.readOnly}
                />
              ) : f.type === "phone" ? (
                // 🔹 NUEVO: Soporte para campos de teléfono
                <PhoneInput
                  country={f.country || "hn"} // País por defecto: Honduras
                  value={f.value || ""}
                  onChange={handlePhoneChange(f.setter)}
                  disabled={f.readOnly || f.disabled}
                  inputProps={{
                    name: f.key,
                    maxLength: f.maxLength || 15,
                  }}
                  inputStyle={{
                    width: "100%",
                    borderColor: f.error ? "red" : "#E2DFDA",
                    boxShadow: f.error ? "0 0 0 2px rgba(255,0,0,0.2)" : "none",
                    backgroundColor: f.readOnly ? "#E7E4DF" : "#FFFFFF",
                    cursor: f.readOnly ? "not-allowed" : "text",
                  }}
                />
              ) : f.type === "integer" || f.type === "Float" ? (
                <Input
                  value={
                    f.readOnly
                      ? formatNumber(f.value ?? "", f.type)
                      : rawValues[f.label] ?? f.value ?? ""
                  }
                  onChange={
                    f.readOnly
                      ? undefined
                      : handleNumberChange(f.label, f.setter, f.type)
                  }
                  onFocus={() =>
                    setRawValues((prev) => ({
                      ...prev,
                      [f.label]: f.value ?? "",
                    }))
                  }
                  onBlur={() => handleNumberBlur(f.label, f.value, f.type)}
                  readOnly={f.readOnly}
                  style={{
                    backgroundColor: f.readOnly ? "#E7E4DF" : "#FFFFFF",
                    cursor: f.readOnly ? "not-allowed" : "text",
                  }}
                />
              ) : (
                <Input
                  value={
                    f.readOnly ? f.value : rawValues[f.label] ?? f.value ?? ""
                  }
                  onChange={(e) =>
                    f.readOnly ? undefined : f.setter(e.target.value)
                  }
                  readOnly={f.readOnly}
                  style={{
                    backgroundColor: f.readOnly ? "#E7E4DF" : "#FFFFFF",
                    cursor: f.readOnly ? "not-allowed" : "text",
                  }}
                />
              )}
            </Form.Item>
          </Col>
        ))}
      </Row>
      {/* Botón genérico */}
      {(buttons?.length > 0
        ? buttons.map((btn, idx) =>
            btn.render ? (
              <React.Fragment key={idx}>{btn.render}</React.Fragment>
            ) : (
              <Button
                key={idx}
                type={btn.type || "primary"}
                htmlType={btn.htmlType || "submit"}
                onClick={btn.onClick}
                disabled={submitting || btn.disabled || sinPermiso(btn)}
                    title={sinPermiso(btn) ? "No tienes permiso para esta acción" : undefined}
                danger={btn.type === "danger"}
              >
                {submitting ? "Enviando..." : btn.text}
              </Button>
            )
          )
        : button) && (
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          {buttons?.length > 0
            ? buttons.map((btn, idx) =>
                btn.render ? (
                  <React.Fragment key={idx}>{btn.render}</React.Fragment>
                ) : (
                  <Button
                    key={idx}
                    type={btn.type || "primary"}
                    htmlType={btn.htmlType || "submit"}
                    onClick={btn.onClick}
                    disabled={submitting || btn.disabled || sinPermiso(btn)}
                    title={sinPermiso(btn) ? "No tienes permiso para esta acción" : undefined}
                    danger={btn.type === "danger"}
                  >
                    {submitting ? "Enviando..." : btn.text}
                  </Button>
                )
              )
            : button && (
                <Button
                  type={button.type || "primary"}
                  htmlType={button.htmlType || "submit"}
                  onClick={button.onClick}
                  disabled={submitting || button.disabled || sinPermiso(button)}
                  title={sinPermiso(button) ? "No tienes permiso para esta acción" : undefined}
                >
                  {submitting ? "Enviando..." : button.text}
                </Button>
              )}
        </div>
      )}
    </Form>
  );
}
