import { useState, useEffect } from "react";
import {
  Drawer,
  Form,
  Input,
  InputNumber,
  Button,
  Descriptions,
  Spin,
  Typography,
} from "antd";

const { Text } = Typography;

export const DetalleDrawer = ({
  visible,
  onClose,
  detalle,
  loading = false,
  onFinish,
  isDesktop = true,
  campos = [], // [{ label, key, editable, type, rules, render }]
}) => {
  const [form] = Form.useForm();
  const [editValues, setEditValues] = useState({});

  useEffect(() => {
    if (detalle) {
      // Inicializa los valores del formulario
      const initialValues = campos.reduce((acc, campo) => {
        if (detalle[campo.key] !== undefined)
          acc[campo.key] = detalle[campo.key];
        return acc;
      }, {});
      form.setFieldsValue(initialValues);
      setEditValues(initialValues);
    }
  }, [detalle, campos, form]);

  if (!detalle && !loading) return;

  const handleChange = (key, value) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
    form.setFieldValue(key, value);
  };

  return (
    <Drawer
      title={`Actualizar Registro #${detalle?.detalleID ?? ""}`}
      width={isDesktop ? 600 : 350}
      onClose={onClose}
      open={visible}
      footer={null}
    >
      {loading ? (
        <Spin tip="Cargando Registro..." />
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => onFinish({ ...detalle, ...values })}
        >
          <Descriptions column={1} bordered>
            {campos.map((campo) => (
              <Descriptions.Item key={campo.key} label={campo.label}>
                {campo.editable ? (
                  <Form.Item
                    name={campo.key}
                    rules={campo.rules || []}
                    style={{ marginBottom: 0 }}
                  >
                    {campo.type === "number" ? (
                      <InputNumber
                        style={{ width: "100%" }}
                        min={1}
                        step={1}
                        value={editValues[campo.key]}
                        onChange={(value) => handleChange(campo.key, value)}
                      />
                    ) : (
                      <Input.TextArea
                        rows={campo.rows || 3}
                        placeholder={campo.placeholder || ""}
                        value={editValues[campo.key]}
                        onChange={(e) =>
                          handleChange(campo.key, e.target.value)
                        }
                      />
                    )}
                  </Form.Item>
                ) : campo.render ? (
                  // render recibe detalle y los valores editados para recalculos
                  campo.render(detalle, editValues)
                ) : (
                  detalle[campo.key]
                )}
              </Descriptions.Item>
            ))}
          </Descriptions>

          <Button
            type="primary"
            htmlType="submit"
            style={{ marginTop: 20, width: "100%" }}
          >
            Guardar Cambios
          </Button>
        </Form>
      )}
    </Drawer>
  );
};
