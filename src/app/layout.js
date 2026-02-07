import { Montserrat, Roboto } from "next/font/google";
import "antd/dist/reset.css";
import "./globals.css";

import ClientProviders from "@/config/providers";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata = {
  title: "Cafe Henola",
  description: "Beneficio Cafe Henola",
  icons: {
    icon: "/frijoles.ico",
    shortcutIcon: "/frijoles.ico",
    apple: "/frijoles.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} ${roboto.variable}`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
