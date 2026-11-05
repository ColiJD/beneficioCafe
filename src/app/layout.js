import localFont from "next/font/local";
import "antd/dist/reset.css";
import "./globals.css";

import ClientProviders from "@/config/providers";
import { getEmpresa } from "@/lib/empresa";

// Fuentes alojadas en el proyecto (variables, subconjunto latino): el build y el servidor no dependen de Google Fonts.
const montserrat = localFont({
  src: "../fonts/Montserrat.woff2",
  variable: "--font-montserrat",
  weight: "100 900",
  display: "swap",
});

const roboto = localFont({
  src: "../fonts/Roboto.woff2",
  variable: "--font-roboto",
  weight: "100 900",
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
      <body className={`${montserrat.variable} ${roboto.variable}`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
