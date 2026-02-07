"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { Form, Input, Button, Card, message, Modal, Row, Col } from "antd";
import { useRouter } from "next/navigation";
import Image from "next/image";
import frijolesImg from "@/img/frijoles.png";

export default function LoginComponent() {
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const router = useRouter();

  const onFinish = async (values) => {
    setLoading(true);
    const res = await signIn("credentials", {
      redirect: false,
      email: values.email,
      password: values.password,
    });
    setLoading(false);

    if (!res) {
      messageApi.error("Error en el servidor. Intente más tarde.");
      return;
    }
    if (res.error) {
      messageApi.error(res.error);
    } else {
      await getSession();
      messageApi.success("Bienvenido a Cafe Henola");
      router.push("/");
    }
  };

  const handleForgotPassword = async (values) => {
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      const data = await res.json();
      messageApi.success(data.message);
      setIsModalOpen(false);
    } catch (error) {
      messageApi.error("Error al enviar el correo, intente más tarde");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        padding: 16,
      }}
    >
      {contextHolder}
      <Row justify="center" style={{ width: "100%" }}>
        <Col xs={24} sm={20} md={16} lg={12} xl={8}>
          <Card
            style={{
              width: "100%",
              padding: 24,
              textAlign: "center",
              borderRadius: 16,
              boxShadow: "0px 6px 18px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Image
                src={frijolesImg}
                alt="Logo Frijoles"
                width={120}
                height={120}
                style={{
                  borderRadius: "50%",
                  boxShadow: "0px 4px 10px rgba(0,0,0,0.2)",
                  objectFit: "cover",
                }}
              />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>
              Iniciar Sesión
            </h2>

            <Form layout="vertical" onFinish={onFinish}>
              <Form.Item
                label="Correo"
                name="email"
                rules={[
                  { required: true, message: "Ingrese su correo" },
                  { type: "email", message: "Ingrese un correo válido" },
                ]}
              >
                <Input placeholder="ejemplo@correo.com" />
              </Form.Item>

              <Form.Item
                label="Contraseña"
                name="password"
                rules={[{ required: true, message: "Ingrese su contraseña" }]}
              >
                <Input.Password placeholder="********" />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  style={{ borderRadius: 8 }}
                >
                  Ingresar
                </Button>
              </Form.Item>
            </Form>

            <button
              onClick={() => setIsModalOpen(true)}
              style={{
                marginTop: 8,
                fontSize: 14,
                color: "#1677ff",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </Card>
        </Col>
      </Row>

      {/* Modal recuperación */}
      <Modal
        title="Recuperar contraseña"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form layout="vertical" onFinish={handleForgotPassword}>
          <Form.Item
            label="Correo"
            name="email"
            rules={[
              { required: true, message: "Ingrese su correo registrado" },
              { type: "email", message: "Ingrese un correo válido" },
            ]}
          >
            <Input placeholder="ejemplo@correo.com" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Enviar enlace de recuperación
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
