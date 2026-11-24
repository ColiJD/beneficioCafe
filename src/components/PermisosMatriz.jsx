"use client";
import { Checkbox, Tag, Tooltip, theme } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { GRUPOS, ACCIONES, col, DEPENDENCIAS, ETIQUETAS, aplica } from "@/lib/modulos";
import useEmpresa from "@/components/useEmpresa";

const TITULO = { ver: "Ver", crear: "Registrar", editar: "Actualizar", eliminar: "Eliminar" };
const COLS = "minmax(0,1fr) repeat(5, 72px)"; // módulo | Todo | 4 acciones
const activo = (f = {}) => ACCIONES.some((a) => f[col(a)]);

// value: [{ modulo, puedeVer, puedeCrear, puedeEditar, puedeEliminar }]
// Toda acción implica ver. Las dependencias (DEPENDENCIAS) son solo informativas: dan datos, no pantalla.
// base (opcional): lo que da el rol. Con ella, las pantallas cuyo acceso difiere del rol se marcan como "ajustado".
export default function PermisosMatriz({ value = [], onChange, disabled, base }) {
  const { token } = theme.useToken();
  // Funciones que la empresa no tiene (Empresa → funciones): su permiso no tiene efecto, así que la fila queda en gris y sin editar.
  const { tieneFuncion } = useEmpresa();
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

  const aplicables = (m, accion) => (accion === "todo" ? ACCIONES.filter((a) => aplica(m, a)) : [accion]);
  const distinto = (m) => !!base && ACCIONES.some((a) => aplica(m, a) && !!get(m)[col(a)] !== !!base.find((p) => p.modulo === m)?.[col(a)]);
  const estado = (mods, accion) => {
    mods = accion === "todo" ? mods : mods.filter((m) => aplica(m, accion));
    const vals = mods.map((m) => aplicables(m, accion).every((a) => get(m)[col(a)]));
    const todos = vals.length > 0 && vals.every(Boolean);
    return { checked: todos, indeterminate: !todos && vals.some(Boolean) };
  };

  const fila = { display: "grid", gridTemplateColumns: COLS, alignItems: "center", padding: "6px 12px" };
  const celda = { display: "flex", justifyContent: "center" };
  const acciones = ["todo", ...ACCIONES];

  const checks = (mods, onCambio, apagado = false) =>
    acciones.map((a) => {
      const sinEfecto = a !== "todo" && mods.every((m) => !aplica(m, a));
      if (sinEfecto)
        return (
          <div key={a} style={celda}>
            <Tooltip title="Esta acción no existe en esta pantalla">
              <span style={{ color: token.colorTextQuaternary }}>—</span>
            </Tooltip>
          </div>
        );
      return (
        <div key={a} style={celda}>
          <Checkbox disabled={disabled || apagado} {...estado(mods, a)} onChange={(e) => onCambio(a, e.target.checked)} />
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
        const todos = g.items.map(([m]) => m);
        const mods = todos.filter(tieneFuncion); // el "Todo" del grupo solo toca las funciones habilitadas
        return (
          <div key={g.grupo}>
            <div style={{ ...fila, background: token.colorFillQuaternary, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
              <b style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.3 }}>{g.grupo}</b>
              {checks(mods.length ? mods : todos, (a, v) => cambiar(mods.map((modulo) => ({ modulo, accion: a, v }))), !mods.length)}
            </div>
            {g.items.map(([modulo, label]) => {
              const habilitada = tieneFuncion(modulo);
              return (
              <div
                key={modulo}
                style={{
                  ...fila,
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                  background: !habilitada ? token.colorFillTertiary : activo(get(modulo)) ? token.colorPrimaryBg : undefined,
                  color: !habilitada ? token.colorTextQuaternary : undefined,
                }}
              >
                <span style={{ paddingLeft: 12 }}>
                  {label}
                  {!habilitada && (
                    <Tooltip title="Esta empresa no tiene esta función: el permiso no tiene efecto. Se activa en Administración → Empresa.">
                      <Tag style={{ marginLeft: 6 }}>No habilitada</Tag>
                    </Tooltip>
                  )}
                  {habilitada && distinto(modulo) && <Tag color="gold" style={{ marginLeft: 6 }}>ajustado</Tag>}
                  {DEPENDENCIAS[modulo] && (
                    <Tooltip title={`También consulta datos de: ${DEPENDENCIAS[modulo].map((d) => ETIQUETAS[d]).join(", ")} (solo datos, sin dar su pantalla)`}>
                      <InfoCircleOutlined style={{ marginLeft: 6, color: token.colorTextTertiary }} />
                    </Tooltip>
                  )}
                </span>
                {checks([modulo], (a, v) => cambiar([{ modulo, accion: a, v }]), !habilitada)}
              </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
