"use client";
import { useEffect, useState } from "react";
import { Button, Card, Checkbox, Col, Collapse, Input, Row, Space, Switch, message } from "antd";
import ProtectedPage from "@/components/ProtectedPage";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import { GRUPOS } from "@/lib/modulos";

const CAMPOS = [
  ["nombre", "Nombre del beneficio", 120], ["propietario", "Propietario", 120],
  ["ciudad", "Ciudad", 80], ["pais", "País", 80], ["rtn", "RTN", 20], ["telefono", "Teléfono", 30],
];

// Lee la imagen elegida como data URL; el servidor valida formato y tamaño.
const leer = (archivo) => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.onerror = mal;
  r.readAsDataURL(archivo);
});

function Imagen({ titulo, actual, nuevo, onElegir }) {
  return (
    <Card size="small" title={titulo}>
      <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, background: "#FAFAF9" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={nuevo || actual} alt={titulo} style={{ maxHeight: 110, maxWidth: "100%" }} />
      </div>
      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico" onChange={(e) => e.target.files[0] && onElegir(e.target.files[0])} />
      {nuevo && <div style={{ color: "#d46b08", marginTop: 4 }}>Imagen nueva: se guarda al pulsar Guardar.</div>}
    </Card>
  );
}

export default function EmpresaPage() {
  const [e, setE] = useState(null);
  const [logo, setLogo] = useState(null);
  const [icono, setIcono] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, ctx] = message.useMessage();

  const cargar = async () => {
    const r = await fetch("/api/empresa", { cache: "no-store" });
    if (r.ok) setE(await r.json());
  };
  useEffect(() => { cargar(); }, []);
  if (!e) return <ProtectedPage allowedRoles={["ADMIN"]}>{ctx}</ProtectedPage>;

  const todas = e.funciones === null || e.funciones === undefined;
  const activas = todas ? [] : e.funciones;
  const cambiaFunciones = (lista) => setE({ ...e, funciones: lista });

  const guardar = async () => {
    setGuardando(true);
    const res = await fetch("/api/empresa", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...e, logo, icono }),
    });
    setGuardando(false);
    if (!res.ok) return msg.error((await res.json()).error || "Error");
    msg.success("Guardado. Recargue la página para ver el nombre y el logo nuevos en todo el sistema.");
    setLogo(null);
    setIcono(null);
    cargar();
  };

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      {ctx}
      <div style={{ maxWidth: 900 }}>
        <EncabezadoPagina titulo="Empresa">
          <Button type="primary" loading={guardando} onClick={guardar}>Guardar</Button>
        </EncabezadoPagina>
        <Card title="Datos de la empresa" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 12]}>
            {CAMPOS.map(([k, etiqueta, max]) => (
              <Col xs={24} md={12} key={k}>
                <div style={{ marginBottom: 4 }}>{etiqueta}</div>
                <Input value={e[k] ?? ""} maxLength={max} onChange={(ev) => setE({ ...e, [k]: ev.target.value })} />
              </Col>
            ))}
          </Row>
          <p style={{ color: "#888", marginTop: 12, marginBottom: 0 }}>
            Estos datos salen en los documentos, reportes, correos, el login y el menú.
          </p>
        </Card>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Imagen titulo="Logo (login, documentos y reportes)" actual={e.logo} nuevo={logo} onElegir={async (f) => setLogo(await leer(f))} />
          </Col>
          <Col xs={24} md={12}>
            <Imagen titulo="Icono de la pestaña" actual={e.icono} nuevo={icono} onElegir={async (f) => setIcono(await leer(f))} />
          </Col>
        </Row>

        <Card title="Funciones de este cliente" style={{ marginBottom: 16 }}>
          <Space>
            <Switch checked={todas} onChange={(v) => cambiaFunciones(v ? null : GRUPOS.flatMap((g) => g.items.map(([k]) => k)))} />
            <span>{todas ? "Todas las funciones habilitadas" : "Solo las funciones marcadas"}</span>
          </Space>
          {!todas && (
            <Collapse style={{ marginTop: 12 }} items={GRUPOS.map((g) => ({
              key: g.grupo,
              label: `${g.grupo} (${g.items.filter(([k]) => activas.includes(k)).length}/${g.items.length})`,
              children: (
                <Checkbox.Group value={activas} onChange={(vals) => cambiaFunciones([...activas.filter((a) => !g.items.some(([k]) => k === a)), ...vals])}
                  options={g.items.map(([k, nombre]) => ({ value: k, label: nombre }))} style={{ display: "grid", gap: 4 }} />
              ),
            }))} />
          )}
        </Card>

      </div>
    </ProtectedPage>
  );
}
