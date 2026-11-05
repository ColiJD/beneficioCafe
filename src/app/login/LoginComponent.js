"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { Form, Input, Button, message, Modal } from "antd";
import { useRouter } from "next/navigation";
import Image from "next/image";
import useEmpresa from "@/components/useEmpresa";
import EscenaGranos from "./EscenaGranos";
import "@/style/login.css";

export default function LoginComponent() {
  const empresa = useEmpresa();
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
      messageApi.success(`Bienvenido a ${empresa.nombre}`);
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
      if (!res.ok) return messageApi.error(data.message || "No se pudo enviar el correo");
      messageApi.success(data.message);
      setIsModalOpen(false);
    } catch (error) {
      messageApi.error("Error al enviar el correo, intente más tarde");
    }
  };

  const lugar = [empresa.ciudad, empresa.pais].filter(Boolean).join(", ");
  const contacto = [lugar, empresa.telefono].filter(Boolean).join(" · ");
  const cosecha = empresa.cosecha?.nombre;

  return (
    <div className="lg-raiz">
      {contextHolder}
      <section className="lg-escena">
        <EscenaGranos />
        <div className="lg-vineta" aria-hidden="true" />
        {cosecha && (
          <svg className="lg-sello" aria-hidden="true" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeWidth="1" />
            <path id="lg-arco" d="M60,60 m-39,0 a39,39 0 1,1 78,0 a39,39 0 1,1 -78,0" fill="none" />
            <text fontFamily="monospace" fontSize="9.5" letterSpacing="2.2" fill="currentColor">
              <textPath href="#lg-arco">{`COSECHA · ${cosecha.slice(0, 12).toUpperCase()} ·`}</textPath>
            </text>
            <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <ellipse cx="60" cy="60" rx="11" ry="17" transform="rotate(35 60 60)" />
              <path d="M53 50c6 3 9 9 14 20" />
            </g>
          </svg>
        )}
        <div className="lg-marca">
          <h1>{empresa.nombre}</h1>
          <p>Del cafetal a la taza.</p>
          {contacto && <small>{contacto}</small>}
        </div>
      </section>

      <section className="lg-form">
        <div className="lg-tarjeta">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <Image
              src={empresa.logo}
              unoptimized
              alt={`Logo ${empresa.nombre}`}
              width={160}
              height={96}
              style={{ objectFit: "contain" }}
            />
          </div>

          <h2>Iniciar Sesión</h2>

          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item
              label="Correo"
              name="email"
              rules={[
                { required: true, message: "Ingrese su correo" },
                { type: "email", message: "Ingrese un correo válido" },
              ]}
            >
              <Input placeholder="ejemplo@correo.com" size="large" />
            </Form.Item>

            <Form.Item
              label="Contraseña"
              name="password"
              rules={[{ required: true, message: "Ingrese su contraseña" }]}
            >
              <Input.Password placeholder="********" size="large" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                Ingresar
              </Button>
            </Form.Item>
          </Form>

          <button className="lg-olvido" onClick={() => setIsModalOpen(true)}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </section>

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
