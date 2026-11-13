import localFont from "next/font/local";
import "antd/dist/reset.css";
import "./globals.css";

import ClientProviders from "@/config/providers";
import { getEmpresa } from "@/lib/empresa";

// Fuentes alojadas en el proyecto (variables, subconjunto latino): el build y el servidor no dependen de Google Fonts.
const cuerpo = localFont({
  src: "../fonts/InstrumentSans.woff2",
  variable: "--font-cuerpo",
  weight: "400 700",
  display: "swap",
});

const titulo = localFont({
  src: "../fonts/YoungSerif.woff2",
  variable: "--font-titulo",
  weight: "400",
  display: "swap",
});

const mono = localFont({
  src: [
    { path: "../fonts/PlexMono-400.woff2", weight: "400" },
    { path: "../fonts/PlexMono-500.woff2", weight: "500" },
  ],
  variable: "--font-mono",
  display: "swap",
});

export async function generateMetadata() {
  const e = await getEmpresa();
  return {
    title: e.nombre,
    description: e.nombre,
    icons: { icon: e.icono, shortcutIcon: e.icono, apple: e.icono },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${cuerpo.variable} ${titulo.variable} ${mono.variable}`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
