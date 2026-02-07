"use client";

import dynamic from "next/dynamic";

const LoginComponent = dynamic(() => import("@/app/login/LoginComponent"), {
  ssr: false, // ❌ Evita SSR
});

export default function LoginPage() {
  return <LoginComponent />;
}
