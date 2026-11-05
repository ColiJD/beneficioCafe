"use client";
import { Checkbox, Tooltip, theme } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { GRUPOS, ACCIONES, col, DEPENDENCIAS, ETIQUETAS, aplica } from "@/lib/modulos";

const TITULO = { ver: "Ver", crear: "Registrar", editar: "Actualizar", eliminar: "Eliminar" };
const COLS = "minmax(0,1fr) repeat(5, 72px)"; // módulo | Todo | 4 acciones
const activo = (f = {}) => ACCIONES.some((a) => f[col(a)]);

// value: [{ modulo, puedeVer, puedeCrear, puedeEditar, puedeEliminar }]
// Toda acción implica ver. Las dependencias (DEPENDENCIAS) son solo informativas: dan datos, no pantalla.
export default function PermisosMatriz({ value = [], onChange, disabled }) {
  const { token } = theme.useToken();
  const get = (m) => value.find((p) => p.modulo === m) || {};

  // cambios: [{ modulo, accion | "todo", v }]
  const cambiar = (cambios) => {
    let next = [...value];
    for (const { modulo, accion, v } of cambios) {
      const cur = next.find((p) => p.modulo === modulo) || { modulo };
      let nuevo = { ...cur, modulo };
      if (accion === "todo") ACCIONES.forEach((a) => aplica(modulo, a) && (nuevo[col(a)] = v));
      else if (!aplica(modulo, accion)) continue;
      else {
        nuevo[col(accion)] = v;
        if (accion !== "ver" && v) nuevo[col("ver")] = true;
        if (accion === "ver" && !v) ACCIONES.forEach((a) => (nuevo[col(a)] = false));
      }
      next = [...next.filter((p) => p.modulo !== modulo), nuevo];
    }
    onChange?.(next);
  };

  const estado = (mods, accion) => {
    mods = accion === "todo" ? mods : mods.filter((m) => aplica(m, accion));
    const vals = mods.map((m) => (accion === "todo" ? ACCIONES.filter((a) => aplica(m, a)).every((a) => get(m)[col(a)]) : !!get(m)[col(accion)]));
    const todos = vals.length > 0 && vals.every(Boolean);
    return { checked: todos, indeterminate: !todos && vals.some(Boolean) };
  };

  const fila = { display: "grid", gridTemplateColumns: COLS, alignItems: "center", padding: "6px 12px" };
  const celda = { display: "flex", justifyContent: "center" };
  const acciones = ["todo", ...ACCIONES];

  const checks = (mods, onCambio) =>
    acciones.map((a) => {
      const sinEfecto = a !== "todo" && mods.every((m) => !aplica(m, a));
      const box = (
        <Checkbox
          disabled={disabled || sinEfecto}
          {...(sinEfecto ? { checked: false } : estado(mods, a))}
          onChange={(e) => onCambio(a, e.target.checked)}
        />
      );
      return (
        <div key={a} style={celda}>
          {sinEfecto ? <Tooltip title="Esta acción no existe en esta pantalla">{box}</Tooltip> : box}
        </div>
      );
    });

  return (
    <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8 }}>
      {/* encabezado fijo */}
      <div style={{ ...fila, position: "sticky", top: 0, zIndex: 1, background: token.colorBgLayout, fontWeight: 600, fontSize: 13 }}>
        <span>Módulo</span>
        {["Todo", ...ACCIONES.map((a) => TITULO[a])].map((t) => (
          <span key={t} style={{ textAlign: "center" }}>{t}</span>
        ))}
      </div>

      {GRUPOS.map((g) => {
        const mods = g.items.map(([m]) => m);
        return (
          <div key={g.grupo}>
            <div style={{ ...fila, background: token.colorFillQuaternary, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
              <b style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.3 }}>{g.grupo}</b>
              {checks(mods, (a, v) => cambiar(mods.map((modulo) => ({ modulo, accion: a, v }))))}
            </div>
            {g.items.map(([modulo, label]) => (
              <div
                key={modulo}
                style={{
                  ...fila,
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                  background: activo(get(modulo)) ? token.colorPrimaryBg : undefined,
                }}
              >
                <span style={{ paddingLeft: 12 }}>
                  {label}
                  {DEPENDENCIAS[modulo] && (
                    <Tooltip title={`También consulta datos de: ${DEPENDENCIAS[modulo].map((d) => ETIQUETAS[d]).join(", ")} (solo datos, sin dar su pantalla)`}>
                      <InfoCircleOutlined style={{ marginLeft: 6, color: token.colorTextTertiary }} />
                    </Tooltip>
                  )}
                </span>
                {checks([modulo], (a, v) => cambiar([{ modulo, accion: a, v }]))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
