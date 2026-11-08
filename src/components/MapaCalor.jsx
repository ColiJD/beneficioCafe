"use client";

// Mapa de calor tipo calendario: una columna por semana (lunes a domingo), un cuadro por día.
// datos: [{ dia: "YYYY-MM-DD", valor, texto }]. Los días sin datos quedan en el color más claro.
const NIVELES = ["#EFE4C8", "#D9B98A", "#B9814F", "#7A4A26", "#33200F"];
const DIAS = ["Lun", "", "Mié", "", "Vie", "", "Dom"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const iso = (d) => d.toISOString().slice(0, 10);
const CUADRO = 14, HUECO = 3;

export default function MapaCalor({ datos = [], semanas = 26, hoy = iso(new Date(Date.now() - 6 * 3600 * 1000)) }) {
  const porDia = new Map(datos.map((d) => [d.dia, d]));
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const fin = new Date(hoy + "T00:00:00Z");
  const lunes = new Date(fin.getTime() - ((fin.getUTCDay() + 6) % 7) * 86400000); // lunes de esta semana
  const inicio = new Date(lunes.getTime() - (semanas - 1) * 7 * 86400000);
  const celdas = Array.from({ length: semanas * 7 }, (_, i) => {
    const d = new Date(inicio.getTime() + i * 86400000);
    return { dia: iso(d), futuro: d > fin, mes: d.getUTCMonth(), primero: d.getUTCDate() <= 7 };
  });
  const etiquetas = Array.from({ length: semanas }, (_, w) => {
    const c = celdas[w * 7];
    return c.primero && (w === 0 || celdas[(w - 1) * 7].mes !== c.mes) ? MESES[c.mes] : "";
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "inline-block" }}>
        <div style={{ display: "grid", gridTemplateColumns: `28px repeat(${semanas}, ${CUADRO}px)`, columnGap: HUECO, fontSize: 11, color: "var(--suave)", marginBottom: 4 }}>
          <span />
          {etiquetas.map((m, i) => <span key={i} style={{ whiteSpace: "nowrap" }}>{m}</span>)}
        </div>
        <div style={{ display: "flex", gap: HUECO }}>
          <div style={{ display: "grid", gridTemplateRows: `repeat(7, ${CUADRO}px)`, rowGap: HUECO, width: 25, fontSize: 11, color: "var(--suave)", lineHeight: `${CUADRO}px` }}>
            {DIAS.map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div style={{ display: "grid", gridTemplateRows: `repeat(7, ${CUADRO}px)`, gridAutoFlow: "column", gridAutoColumns: CUADRO, gap: HUECO }}>
            {celdas.map((c) => {
              const d = porDia.get(c.dia);
              const nivel = d ? Math.max(1, Math.ceil((d.valor / max) * 4)) : 0;
              const texto = `${c.dia}: ${d ? d.texto : "sin actividad"}`;
              return <span key={c.dia} title={texto} aria-label={texto} role="img"
                style={{ width: CUADRO, height: CUADRO, borderRadius: 3, background: c.futuro ? "transparent" : NIVELES[nivel], border: c.futuro ? "1px dashed var(--linea)" : "1px solid rgba(42,26,16,.08)" }} />;
            })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 11, color: "var(--suave)", justifyContent: "flex-end" }}>
          Menos {NIVELES.map((n) => <span key={n} style={{ width: CUADRO, height: CUADRO, borderRadius: 3, background: n, border: "1px solid rgba(42,26,16,.08)" }} />)} Más
        </div>
      </div>
    </div>
  );
}
