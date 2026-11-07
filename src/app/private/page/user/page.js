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
  Drawer,
  Descriptions,
  Tag,
} from "antd";
import PermisosMatriz from "@/components/PermisosMatriz";
import ProtectedPage from "@/components/ProtectedPage";
import { useSession } from "next-auth/react";

export default function UsersPage() {
  const { data: session, update } = useSession();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [ficha, setFicha] = useState(null); // { user, efectivo, roleIds, permisos }

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

  const abrirFicha = async (u) => {
    const r = await fetch(`/api/auth/acceso?userId=${u.userId}`);
    if (!r.ok) return messageApi.error("No se pudo cargar la ficha");
    const d = await r.json();
    setFicha({
      ...d,
      roleIds: d.user.user_roles.map((x) => x.roleId),
      permisos: d.user.user_permissions,
    });
  };

  const guardarFicha = async () => {
    const r = await fetch("/api/auth/acceso", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: ficha.user.userId,
        roleIds: ficha.roleIds,
        permisos: ficha.permisos,
      }),
    });
    if (!r.ok) return messageApi.error("Error al guardar");
    messageApi.success("Accesos guardados");
    abrirFicha(ficha.user);
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
          <Button type="link" onClick={() => abrirFicha(record)}>
            Ver / Accesos
          </Button>
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

        <Drawer
          title={ficha ? `Usuario: ${ficha.user.userName || ficha.user.userEmail}` : ""}
          open={!!ficha}
          onClose={() => setFicha(null)}
          width={560}
          extra={<Button type="primary" onClick={guardarFicha}>Guardar</Button>}
        >
          {ficha && (
            <>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Correo">{ficha.user.userEmail}</Descriptions.Item>
                <Descriptions.Item label="Rol principal">{ficha.user.roles.roleName}</Descriptions.Item>
                <Descriptions.Item label="Creado">
                  {new Date(ficha.user.createdAt).toLocaleString()}
                </Descriptions.Item>
              </Descriptions>

              <h3 className="mt-4 mb-1 font-bold">Roles adicionales</h3>
              <Select
                mode="multiple"
                style={{ width: "100%" }}
                value={ficha.roleIds}
                onChange={(roleIds) => setFicha({ ...ficha, roleIds })}
                options={roles.map((r) => ({ value: r.roleId, label: r.roleName }))}
              />

              <h3 className="mt-4 mb-1 font-bold">Permisos directos (extra a sus roles)</h3>
              <PermisosMatriz
                value={ficha.permisos}
                onChange={(permisos) => setFicha({ ...ficha, permisos })}
              />

              <h3 className="mt-4 mb-1 font-bold">Acceso efectivo (al guardar)</h3>
              {Object.entries(ficha.efectivo.permisos)
                .filter(([, p]) => p.ver)
                .map(([m, p]) => (
                  <div key={m} className="mb-1">
                    <b>{m}</b>: {["ver","crear","editar","eliminar"].filter((a) => p[a]).map((a) => ({ ver: "Ver", crear: "Registrar", editar: "Actualizar", eliminar: "Eliminar" })[a]).join(" · ")}{" "}
                    {[...new Set(p.origen)].map((o) => (
                      <Tag key={o}>{o}</Tag>
                    ))}
                  </div>
                ))}
              {Object.entries(ficha.efectivo.permisos).some(([, p]) => !p.ver && p.datosDe?.length) && (
                <>
                  <h3 className="mt-4 mb-1 font-bold">Solo datos de apoyo (sin pantalla)</h3>
                  {Object.entries(ficha.efectivo.permisos)
                    .filter(([, p]) => !p.ver && p.datosDe?.length)
                    .map(([m, p]) => (
                      <div key={m} className="mb-1">
                        <b>{m}</b> <Tag>por {[...new Set(p.datosDe)].join(", ")}</Tag>
                      </div>
                    ))}
                </>
              )}
            </>
          )}
        </Drawer>

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
