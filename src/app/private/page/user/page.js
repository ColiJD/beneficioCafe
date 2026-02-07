"use client";
import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, message } from "antd";
import ProtectedPage from "@/components/ProtectedPage";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const [form] = Form.useForm();

  // Cargar usuarios y roles existentes
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resUsers, resRoles] = await Promise.all([
        fetch("/api/auth/login").then((r) => r.json()),
        fetch("/api/auth/roles").then((r) => r.json()), // solo lectura
      ]);
      setUsers(resUsers);
      setRoles(resRoles);
    } catch (error) {
      message.error("Error al cargar datos");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Crear usuario (no se crean roles)
  const handleCreate = async (values) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        message.success("Usuario creado");
        setOpen(false);
        form.resetFields();
        fetchData();
      } else {
        message.error("Error al crear usuario");
      }
    } catch (error) {
      message.error("Error al crear usuario");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "userId" },
    { title: "Nombre", dataIndex: "userName" },
    { title: "Correo", dataIndex: "userEmail" },
    { title: "Rol", dataIndex: ["role", "roleName"] },
  ];

  return (
      <ProtectedPage allowedRoles={["ADMIN",]}>
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Gestión de Usuarios</h1>
      <Button type="primary" onClick={() => setOpen(true)}>
        Nuevo Usuario
      </Button>

      <Table
        className="mt-4"
        columns={columns}
        dataSource={users}
        rowKey="userId"
        loading={loading}
      />

      <Modal
        title="Crear Usuario"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
      >
        <Form layout="vertical" form={form} onFinish={handleCreate}>
          <Form.Item
            label="Nombre"
            name="userName"
            rules={[{ required: true, message: "Ingrese un nombre" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Correo"
            name="userEmail"
            rules={[{ required: true, message: "Ingrese un correo" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Contraseña"
            name="userPassword"
            rules={[{ required: true, message: "Ingrese una contraseña" }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="Rol"
            name="roleId"
            rules={[{ required: true, message: "Seleccione un rol" }]}
          >
            <Select placeholder="Seleccione un rol existente">
              {roles.map((r) => (
                <Select.Option key={r.roleId} value={r.roleId}>
                  {r.roleName}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Button type="primary" htmlType="submit" block>
            Guardar
          </Button>
        </Form>
      </Modal>
    </div>
    </ProtectedPage>
  );
}
