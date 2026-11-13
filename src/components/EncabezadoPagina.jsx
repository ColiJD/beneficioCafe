"use client";

// Título de la página con sus botones de acción a la derecha (en la misma fila; se acomodan debajo en pantallas angostas).
export default function EncabezadoPagina({ titulo, children }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
      <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.15 }}>{titulo}</h1>
      {children && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>}
    </div>
  );
}
