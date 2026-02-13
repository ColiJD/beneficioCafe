"use client";
import { ConfigProvider, App } from "antd";
import esEs from "antd/locale/es_ES";
import theme from "@/config/themeConfig";
import { SessionProvider } from "next-auth/react";

export default function ClientProviders({ children }) {
  return (
    <SessionProvider>
      <ConfigProvider theme={theme} locale={esEs}>
        <App>{children}</App>
      </ConfigProvider>
    </SessionProvider>
  );
}
