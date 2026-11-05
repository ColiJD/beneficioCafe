"use client";
import { useEffect, useState } from "react";
import { Table, Button, Modal, Input, message, Space, Tag, Alert, Descriptions } from "antd";
import ProtectedPage from "@/components/ProtectedPage";

const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const dias = (a, b) => Math.round((new Date(b ?? Date.now()) - new Date(a)) / 86400000) + 1;
const hoy = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10); // Honduras (UTC-6)
const sumaDia = (d, n) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10);

export default function CosechasPage() {
  const [filas, setFilas] = useState([]);
  const [modal, setModal] = useState(null); // "abrir" | "cerrar"
  const [form, setForm] = useState({});
  const [msg, ctx] = message.useMessage();

  const cargar = async () => {
    const r = await fetch("/api/cosechas");
    if (r.ok) setFilas(await r.json());
  };
  useEffect(() => { cargar(); }, []);

  const actual = filas.find((c) => c.estado === "Abierta");
  const ultimaCerrada = filas.find((c) => c.estado === "Cerrada"); // la lista viene de la más reciente a la más antigua

  const abrirModal = (tipo) => {
    setModal(tipo);
    setForm(tipo === "abrir"
      ? { nombre: "", fechaInicio: ultimaCerrada ? sumaDia(ultimaCerrada.fechaFin, 1) : hoy() }
      : { fechaFin: hoy(), notas: "" });
  };

  const guardar = async () => {
    const res = await fetch(modal === "abrir" ? "/api/cosechas" : "/api/cosechas/cerrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) return msg.error((await res.json()).error || "Error");
    msg.success(modal === "abrir" ? "Cosecha abierta" : "Cosecha cerrada");
    setModal(null);
    cargar();
  };

  const columnas = [
    { title: "Cosecha", dataIndex: "nombre" },
    { title: "Inicio", dataIndex: "fechaInicio", render: dia },
    { title: "Fin", dataIndex: "fechaFin", render: (v) => (v ? dia(v) : "En curso") },
    { title: "Duración", render: (_, c) => `${dias(c.fechaInicio, c.fechaFin)} días` },
    { title: "Estado", dataIndex: "estado", render: (e) => <Tag color={e === "Abierta" ? "green" : "default"}>{e}</Tag> },
    { title: "Notas", dataIndex: "notas" },
  ];

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      {ctx}
      <div style={{ padding: 16 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Button type="primary" disabled={!!actual} onClick={() => abrirModal("abrir")}>Abrir cosecha</Button>
          <Button danger disabled={!actual} onClick={() => abrirModal("cerrar")}>Cerrar cosecha actual</Button>
        </Space>
        {actual ? (
          <Alert type="success" showIcon style={{ marginBottom: 16 }}
            message={`Cosecha actual: ${actual.nombre}`}
            description={`Desde ${dia(actual.fechaInicio)} · ${dias(actual.fechaInicio)} días. Sus documentos y reportes llevan este nombre.`} />
        ) : (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="No hay una cosecha abierta" description="Abra la siguiente cosecha para que los documentos lleven su nombre." />
        )}
        <Table rowKey="cosechaID" dataSource={filas} columns={columnas} pagination={false}
          expandable={{
            rowExpandable: (c) => c.inventario.length > 0,
            expandedRowRender: (c) => (
              <>
                <Descriptions size="small" column={2} style={{ marginBottom: 8 }}>
                  <Descriptions.Item label="Cerrada el">{c.cerradaEn ? new Date(c.cerradaEn).toLocaleString("es-HN") : "—"}</Descriptions.Item>
                </Descriptions>
                <b>Inventario al cierre</b>
                <Table size="small" rowKey="id" pagination={false} dataSource={c.inventario}
                  columns={[
                    { title: "Producto", dataIndex: "producto" },
                    { title: "QQ", dataIndex: "cantidadQQ", align: "right" },
                    { title: "Sacos", dataIndex: "cantidadSacos", align: "right" },
                  ]} />
              </>
            ),
          }} />
      </div>

      <Modal open={modal === "abrir"} title="Abrir cosecha" okText="Abrir" cancelText="Cancelar" onOk={guardar} onCancel={() => setModal(null)}>
        <p>Nombre (por ejemplo 2027 - 2028)</p>
        <Input value={form.nombre} maxLength={50} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        <p style={{ marginTop: 12 }}>Fecha de inicio</p>
        <Input type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
      </Modal>

      <Modal open={modal === "cerrar"} title={`Cerrar la cosecha ${actual?.nombre ?? ""}`} okText="Cerrar cosecha" okButtonProps={{ danger: true }}
        cancelText="Cancelar" onOk={guardar} onCancel={() => setModal(null)}>
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message="Después del cierre no se podrán registrar ni mover transacciones con fecha dentro de este periodo. Se guarda una foto del inventario de hoy." />
        <p>Fecha de cierre (último día de la cosecha)</p>
        <Input type="date" value={form.fechaFin} max={hoy()} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
        <p style={{ marginTop: 12 }}>Notas (opcional)</p>
        <Input.TextArea value={form.notas} maxLength={255} rows={2} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
      </Modal>
    </ProtectedPage>
  );
}
