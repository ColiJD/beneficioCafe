"use client";
import { useCallback, useEffect, useState } from "react";
import { Table, Button, Input, Select, DatePicker, Tag, Card, Statistic, Switch, Space, Drawer, Descriptions, Row, Col, Empty } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import ProtectedPage from "@/components/ProtectedPage";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import { BotonVer } from "@/components/BotonesAccion";
import MapaCalor from "@/components/MapaCalor";
import { MODULO_ETIQUETA, EVENTOS } from "@/lib/bitacoraCtx";

const COLOR = { CREAR: "green", EDITAR: "blue", ANULAR: "orange", ELIMINAR: "red", LOGIN: "geekblue", LOGIN_FALLIDO: "volcano", DENEGADO: "magenta", VISITA: "default" };
const NOMBRE = { CREAR: "Creó", EDITAR: "Editó", ANULAR: "Anuló", ELIMINAR: "Eliminó", LOGIN: "Inició sesión", LOGIN_FALLIDO: "Intento fallido", DENEGADO: "Acceso denegado", VISITA: "Entró a" };
const modulo = (m) => MODULO_ETIQUETA[m] ?? m ?? "—";
const hora = (f) => new Date(f).toLocaleString("es-HN", { timeZone: "America/Tegucigalpa", dateStyle: "short", timeStyle: "medium" });
const inicioDia = (d) => d.startOf("day").format("YYYY-MM-DDTHH:mm:ss") + "-06:00"; // Honduras (UTC-6)
const finDia = (d) => d.endOf("day").format("YYYY-MM-DDTHH:mm:ss") + "-06:00";

export default function BitacoraPage() {
  const [rango, setRango] = useState([dayjs(), dayjs()]);
  const [f, setF] = useState({ userId: undefined, evento: undefined, modulo: undefined, q: "" });
  const [pag, setPag] = useState({ pagina: 1, tamano: 50 });
  const [datos, setDatos] = useState({ total: 0, filas: [] });
  const [resumen, setResumen] = useState(null);
  const [mapa, setMapa] = useState([]);
  const [opciones, setOpciones] = useState({ usuarios: [], modulos: [] });
  const [enVivo, setEnVivo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    const p = new URLSearchParams({ pagina: pag.pagina, tamano: pag.tamano });
    if (rango?.[0]) p.set("desde", inicioDia(rango[0]));
    if (rango?.[1]) p.set("hasta", finDia(rango[1]));
    for (const k of ["userId", "evento", "modulo", "q"]) if (f[k]) p.set(k, f[k]);
    try {
      const [r, s, m] = await Promise.all([fetch("/api/bitacora?" + p), fetch("/api/bitacora?resumen=1"), fetch("/api/bitacora?mapa=1" + (f.userId ? "&userId=" + f.userId : ""))]);
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      setDatos(await r.json());
      if (s.ok) setResumen(await s.json());
      if (m.ok) setMapa(await m.json());
      setError("");
    } catch (e) {
      setError(e.message);
    }
    setCargando(false);
  }, [rango, f, pag]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    fetch("/api/bitacora?opciones=1").then((r) => r.ok && r.json()).then((o) => o && setOpciones(o));
  }, []);
  useEffect(() => {
    if (!enVivo) return;
    const t = setInterval(cargar, 10000);
    return () => clearInterval(t);
  }, [enVivo, cargar]);

  const filtrar = (cambio) => { setF((a) => ({ ...a, ...cambio })); setPag((p) => ({ ...p, pagina: 1 })); };
  const n = (e) => resumen?.porEvento?.[e] ?? 0;

  const columnas = [
    { title: "Fecha y hora", dataIndex: "fecha", width: 170, render: hora },
    { title: "Usuario", dataIndex: "usuario", render: (u, r) => u ?? (r.evento === "LOGIN_FALLIDO" ? r.detalle?.correo : "—"), width: 150 },
    { title: "Rol", dataIndex: "rol", width: 130, render: (v) => v ?? "—" },
    { title: "Acción", dataIndex: "evento", width: 150, render: (e) => <Tag color={COLOR[e]}>{NOMBRE[e] ?? e}</Tag> },
    { title: "Módulo", dataIndex: "modulo", render: (m, r) => (r.evento === "VISITA" ? r.ruta : modulo(m)) },
    { title: "Registro", dataIndex: "registroId", width: 90, render: (v) => v ?? "—" },
    { title: "IP", dataIndex: "ip", width: 130, render: (v) => v ?? "—" },
    { title: "", width: 50, render: (_, r) => <BotonVer titulo="Ver detalle" onClick={() => setDetalle(r)} /> },
  ];

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <EncabezadoPagina titulo="Bitácora">
        <Space>
          En vivo <Switch checked={enVivo} onChange={setEnVivo} />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={cargar} loading={cargando} title="Actualizar" aria-label="Actualizar" />
      </EncabezadoPagina>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          ["Acciones (24 h)", n("CREAR") + n("EDITAR") + n("ANULAR") + n("ELIMINAR")],
          ["Inicios de sesión", n("LOGIN")],
          ["Intentos fallidos", n("LOGIN_FALLIDO")],
          ["Accesos denegados", n("DENEGADO")],
          ["Usuarios activos", resumen?.activos?.length ?? 0],
        ].map(([t, v]) => (
          <Col xs={12} md={8} lg={4} key={t} style={{ flexGrow: 1 }}>
            <Card size="small"><Statistic title={t} value={v} /></Card>
          </Col>
        ))}
      </Row>

      <Card size="small" style={{ marginBottom: 16 }} title={f.userId ? "Días de actividad del usuario seleccionado" : "Días en que entran los usuarios"}
        extra={<span style={{ fontSize: 12, color: "var(--suave)" }}>Últimos 6 meses · {f.userId ? "más oscuro = más movimiento" : "más oscuro = más usuarios distintos"}</span>}>
        <MapaCalor datos={mapa.map((d) => ({ dia: d.dia, valor: f.userId ? d.eventos : d.usuarios,
          texto: f.userId ? `${d.eventos} movimientos` : `${d.usuarios} ${d.usuarios === 1 ? "usuario" : "usuarios"}, ${d.eventos} movimientos` }))} />
      </Card>

      <Space wrap style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker value={rango} onChange={(r) => { setRango(r); setPag((p) => ({ ...p, pagina: 1 })); }} allowClear format="DD/MM/YYYY" />
        <Select allowClear showSearch optionFilterProp="label" placeholder="Usuario" style={{ width: 170 }} value={f.userId} onChange={(v) => filtrar({ userId: v })}
          options={opciones.usuarios.map((u) => ({ value: u.userId, label: u.usuario }))} />
        <Select allowClear placeholder="Acción" style={{ width: 160 }} value={f.evento} onChange={(v) => filtrar({ evento: v })}
          options={EVENTOS.map((e) => ({ value: e, label: NOMBRE[e] }))} />
        <Select allowClear showSearch optionFilterProp="label" placeholder="Módulo" style={{ width: 210 }} value={f.modulo} onChange={(v) => filtrar({ modulo: v })}
          options={opciones.modulos.map((m) => ({ value: m, label: modulo(m) }))} />
        <Input.Search allowClear placeholder="Buscar usuario, registro, IP o pantalla" style={{ width: 280 }} onSearch={(q) => filtrar({ q })} />
      </Space>

      {error && <Empty description={error} style={{ margin: 24 }} />}
      <Table rowKey="bitacoraID" size="small" loading={cargando} dataSource={datos.filas} columns={columnas} scroll={{ x: 900 }}
        pagination={{ current: pag.pagina, pageSize: pag.tamano, total: datos.total, showSizeChanger: true, pageSizeOptions: [25, 50, 100, 200], showTotal: (t) => `${t} eventos`,
          onChange: (pagina, tamano) => setPag({ pagina, tamano }) }} />

      <Drawer title="Detalle del evento" open={!!detalle} onClose={() => setDetalle(null)} width={520}>
        {detalle && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Fecha y hora">{hora(detalle.fecha)}</Descriptions.Item>
              <Descriptions.Item label="Usuario">{detalle.usuario ?? "—"} {detalle.userId ? `(#${detalle.userId})` : ""}</Descriptions.Item>
              <Descriptions.Item label="Rol">{detalle.rol ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Acción"><Tag color={COLOR[detalle.evento]}>{NOMBRE[detalle.evento] ?? detalle.evento}</Tag></Descriptions.Item>
              <Descriptions.Item label="Módulo">{modulo(detalle.modulo)}</Descriptions.Item>
              <Descriptions.Item label="Registro">{detalle.registroId ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Desde la pantalla">{detalle.ruta ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="IP">{detalle.ip ?? "—"}</Descriptions.Item>
            </Descriptions>
            <h4 style={{ margin: "16px 0 8px" }}>Datos</h4>
            <pre style={{ background: "var(--campo)", border: "1px solid var(--linea)", borderRadius: 6, padding: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono), monospace", fontSize: 12 }}>
              {detalle.detalle ? JSON.stringify(detalle.detalle, null, 2) : "Sin datos adicionales"}
            </pre>
          </>
        )}
      </Drawer>
    </ProtectedPage>
  );
}
