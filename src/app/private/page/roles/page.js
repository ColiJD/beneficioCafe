"use client";
import { useEffect, useState } from "react";
import { Table, Button, Modal, Input, message, Popconfirm, Space, Tag } from "antd";
import ProtectedPage from "@/components/ProtectedPage";
import { BotonEditar, BotonEliminar } from "@/components/BotonesAccion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import PermisosMatriz from "@/components/PermisosMatriz";

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [edit, setEdit] = useState(null); // { roleId?, roleName, permisos }
  const [msg, ctx] = message.useMessage();

  const load = async () => setRoles(await fetch("/api/auth/roles").then((r) => r.json()));
  useEffect(() => { load(); }, []);

  const save = async () => {
    const res = await fetch("/api/auth/roles", {
      method: edit.roleId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    if (!res.ok) return msg.error((await res.json()).error || "Error");
    msg.success("Guardado");
    setEdit(null);
    load();
  };

  const del = async (roleId) => {
    const res = await fetch(`/api/auth/roles?roleId=${roleId}`, { method: "DELETE" });
    if (!res.ok) return msg.error((await res.json()).error || "Error");
    load();
  };

  const esAdmin = edit?.roleName === "ADMIN";

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      {ctx}
      <div className="p-6">
        <EncabezadoPagina titulo="Roles y permisos">
          <Button type="primary" onClick={() => setEdit({ roleName: "", permisos: [] })}>
            Nuevo rol
          </Button>
        </EncabezadoPagina>
        <Table
          rowKey="roleId"
          dataSource={roles}
          columns={[
            { title: "Rol", dataIndex: "roleName" },
            {
              title: "Módulos",
              render: (_, r) =>
                r.roleName === "ADMIN" ? (
                  <Tag color="gold">Administración{r.role_permissions.length ? ` + ${r.role_permissions.length}` : ""}</Tag>
                ) : (
                  r.role_permissions.length
                ),
            },
            {
              title: "Acciones",
              render: (_, r) => (
                <Space>
                  <BotonEditar onClick={() => setEdit({ ...r, permisos: r.role_permissions })} />
                  {r.roleName !== "ADMIN" && (
                    <Popconfirm title="¿Eliminar rol?" onConfirm={() => del(r.roleId)}>
                      <BotonEliminar />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
        <Modal
          title={edit?.roleId ? "Editar rol" : "Nuevo rol"}
          open={!!edit}
          onCancel={() => setEdit(null)}
          onOk={save}
          okText="Guardar"
          width={820}
          styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
        >
          {esAdmin && (
            <p>
              ADMIN siempre incluye Administración (usuarios y roles). Marque abajo los demás módulos que
              también deba tener; por defecto ninguno. El nombre no se cambia.
            </p>
          )}
          <div className="mb-1 text-sm font-semibold">Nombre del rol</div>
          <Input
            className="mb-3"
            placeholder="Ej. CONTADOR"
            disabled={esAdmin}
            value={edit?.roleName}
            onChange={(e) => setEdit({ ...edit, roleName: e.target.value })}
          />
          <div className="mb-1 text-sm font-semibold">Qué puede hacer en cada módulo</div>
          <PermisosMatriz
            value={edit?.permisos}
            onChange={(permisos) => setEdit({ ...edit, permisos })}
          />
        </Modal>
      </div>
    </ProtectedPage>
  );
}
