"use client";
import { ConfigProvider, App } from "antd";
import esEs from "antd/locale/es_ES";
/*
- [x] Analyze database schema for Purchase and Inventory relationships
- [x] Investigate API routes for creating, editing, and deleting purchases
- [x] Identify logic that updates inventory based on purchase actions
- [x] Determine if there are gaps (e.g., missing updates on edit/delete)
- [x] Report findings to the user
*/
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
