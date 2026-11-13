"use client";
// Ilustración decorativa del login: un grano de café protagonista, granos cayendo y un montón abajo.
// Solo SVG + CSS (login.css); no lleva datos ni lógica.
const CAEN = [
  // x, escala, segundos, desenfoque, opacidad
  [60, 0.5, 18, 2.6, 0.5], [140, 0.55, 17, 2.4, 0.55], [235, 0.6, 16, 2.2, 0.6], [320, 0.52, 18, 2.6, 0.5],
  [410, 0.8, 13, 1.1, 0.8], [500, 0.85, 14, 1, 0.85], [575, 0.9, 12, 1, 0.85], [100, 0.8, 13, 1.2, 0.8],
  [190, 1.25, 9.5, 0, 1], [285, 1.4, 10, 0, 1], [370, 1.2, 9, 0, 1], [455, 1.35, 10.5, 0, 1], [540, 1.3, 9.8, 0, 1], [30, 1.1, 11, 0, 1],
];
const MONTON = [
  [470, 720, -25, 1], [520, 742, 20, 1], [560, 700, 60, 0.95], [428, 766, 40, 0.9], [500, 670, -50, 1],
  [556, 762, -10, 0.9], [578, 648, 15, 0.85], [442, 690, 70, 0.85], [530, 622, 35, 0.8],
];

const Caen = ({ lista, desde }) =>
  lista.map(([x, sc, dur, bl, op], k) => {
    const i = desde + k;
    return (
      <g key={i} transform={`translate(${x} 0)`} style={{ filter: bl ? `blur(${bl}px)` : undefined, opacity: op }}>
        <g
          className="lg-cae"
          style={{ "--t": `${dur}s`, "--d": `-${(i * 1.9).toFixed(1)}s`, "--r": `${(i % 2 ? 1 : -1) * (140 + i * 13)}deg`, "--y0": `${80 + ((i * 137) % 640)}px` }}
        >
          <g transform={`scale(${sc})`}><use href="#lg-grano" /></g>
        </g>
      </g>
    );
  });

export default function EscenaGranos() {
  return (
    <svg aria-hidden="true" viewBox="0 0 600 800" preserveAspectRatio="xMidYMin slice" className="lg-svg">
      <defs>
        <radialGradient id="lg-tueste" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#8A5530" /><stop offset=".55" stopColor="#4E2B16" /><stop offset="1" stopColor="#2A150A" />
        </radialGradient>
        <radialGradient id="lg-brasa">
          <stop offset="0" stopColor="#E08A3A" stopOpacity=".32" /><stop offset="1" stopColor="#E08A3A" stopOpacity="0" />
        </radialGradient>
        <g id="lg-grano">
          <ellipse rx="20" ry="28" fill="url(#lg-tueste)" />
          <path d="M-3,-25 C12,-11 -12,11 3,25" fill="none" stroke="#170B05" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M-1,-25 C14,-11 -10,11 5,25" fill="none" stroke="#9A6A44" strokeOpacity=".35" strokeWidth="1.2" strokeLinecap="round" />
          <ellipse cx="-9" cy="-12" rx="3" ry="7" fill="#FFFFFF" fillOpacity=".16" transform="rotate(18 -9 -12)" />
        </g>
        <g id="lg-granoH">
          <ellipse rx="20" ry="28" fill="url(#lg-tueste)" />
          <path d="M-2.5,-26 C11,-11 -11,11 2.5,26" fill="none" stroke="#120804" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M-1,-26 C12.5,-11 -9.5,11 4,26" fill="none" stroke="#B07A50" strokeOpacity=".4" strokeWidth=".9" strokeLinecap="round" />
          <ellipse cx="-9" cy="-12" rx="3.2" ry="8" fill="#FFFFFF" fillOpacity=".14" transform="rotate(18 -9 -12)" />
        </g>
      </defs>
      <g fill="none" stroke="#F3E9D2" strokeOpacity=".07" strokeWidth="1.4">
        {[90, 190, 300, 420, 550].map((r) => (
          <ellipse key={r} cx="140" cy="700" rx={r} ry={r * 0.67} />
        ))}
      </g>
      <Caen lista={CAEN.slice(0, 8)} desde={0} />
      <ellipse cx="400" cy="270" rx="230" ry="230" fill="url(#lg-brasa)" />
      <g transform="translate(400 270)" style={{ filter: "drop-shadow(0 26px 22px rgba(0,0,0,.6))" }}>
        <g className="lg-flota"><g transform="rotate(28) scale(4.3)"><use href="#lg-granoH" /></g></g>
      </g>
      <Caen lista={CAEN.slice(8)} desde={8} />
      <g style={{ filter: "drop-shadow(0 8px 6px rgba(0,0,0,.55))" }}>
        {MONTON.map(([x, y, r, sc], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${sc * 0.85})`}>
            <use className="lg-monton" href="#lg-grano" style={{ "--d": `${(2.4 + i * 0.14).toFixed(2)}s` }} />
          </g>
        ))}
      </g>
    </svg>
  );
}
