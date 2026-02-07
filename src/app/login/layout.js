"use client";
import ClientProviders from "@/config/providers";

export default function LoginLayout({ children }) {
  return <ClientProviders>{children}</ClientProviders>;
}
