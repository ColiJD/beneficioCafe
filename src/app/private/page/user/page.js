"use client";
import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Space,
} from "antd";
import ProtectedPage from "@/components/ProtectedPage";
import { useSession } from "next-auth/react";

export default function UsersPage() {
  const { data: session, update } = useSession();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

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
      messageApi.error("Error al cargar datos");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Crear usuario (no se crean roles)
  const handleCreate = async (values) => {
    try {
      const url = "/api/auth/login";
      const method = editingUser ? "PUT" : "POST";
      const body = editingUser
        ? { ...values, userId: editingUser.userId }
        : values;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const result = await res.json();
        messageApi.success(
          editingUser ? "Usuario actualizado" : "Usuario creado",
        );

        // 🔹 Si el usuario que se editó es el mismo que está logueado, actualizamos su sesión
        if (editingUser && editingUser.userId === session.user.id) {
          await update({
            ...session,
            user: {
              ...session.user,
              name: result.userName,
              email: result.userEmail,
              role: result.roles.roleName,
            },
          });
        }

        setOpen(false);
        setEditingUser(null);
        form.resetFields();
        fetchData();
      } else {
        const data = await res.json();
        messageApi.error(data.error || "Error al procesar solicitud");
      }
    } catch (error) {
      messageApi.error("Error al procesar solicitud");
    }
  };

  const handleDelete = async (userId) => {
    try {
      const res = await fetch(`/api/auth/login?userId=${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        messageApi.success("Usuario eliminado");
        fetchData();
      } else {
        messageApi.error("Error al eliminar usuario");
      }
    } catch (error) {
      messageApi.error("Error al eliminar usuario");
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    form.setFieldsValue({
      userName: user.userName,
      userEmail: user.userEmail,
      roleId: user.roleId,
      // No seteamos la contraseña por seguridad y porque es opcional en la edición
    });
    setOpen(true);
  };

  const columns = [
    { title: "ID", dataIndex: "userId" },
    { title: "Nombre", dataIndex: "userName" },
    { title: "Correo", dataIndex: "userEmail" },
    { title: "Rol", dataIndex: ["roles", "roleName"] },
    {
      title: "Fecha de Creación",
      dataIndex: "createdAt",
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: "Acciones",
      key: "actions",
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleEdit(record)}>
            Editar
          </Button>
          <Popconfirm
            title="¿Eliminar usuario?"
            description="Esta acción no se puede deshacer."
            onConfirm={() => handleDelete(record.userId)}
            okText="Sí"
            cancelText="No"
          >
            <Button type="link" danger>
              Eliminar
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      {contextHolder}
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">Gestión de Usuarios</h1>
        <Button
          type="primary"
          onClick={() => {
            setEditingUser(null);
            form.resetFields();
            setOpen(true);
          }}
        >
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
          title={editingUser ? "Editar Usuario" : "Crear Usuario"}
          open={open}
          onCancel={() => {
            setOpen(false);
            setEditingUser(null);
          }}
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
              rules={[
                { required: !editingUser, message: "Ingrese una contraseña" },
              ]}
            >
              <Input.Password
                placeholder={
                  editingUser ? "Dejar en blanco para no cambiar" : ""
                }
              />
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
