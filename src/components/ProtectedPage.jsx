"use client";

import { useSession, getSession } from "next-auth/react";
import { Spin, Result, Button } from "antd";
import { useRouter, usePathname } from "next/navigation";
import usePermisos from "@/components/usePermisos";
import { puedeEnRuta } from "@/lib/modulos";
import { useEffect, useState } from "react";

export default function ProtectedPage({ allowedRoles = [], children }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const acc = usePermisos();

  // 🔹 Mientras carga la sesión y los permisos
  if (status === "loading" || (session && !acc)) {
    return (
      <Spin tip="Cargando..." size="large">
        <div
          style={{
            height: "200px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        />
      </Spin>
    );
  }

  // 🔹 Si no hay sesión
  if (!session) {
    return (
      <Result
        status="403"
        title="Debes iniciar sesión"
        extra={
          <Button type="primary" onClick={() => router.push("/login")}>
            Ir al login
          </Button>
        }
      />
    );
  }

  // 🔹 Permisos desde BD (roles + directos); allowedRoles queda sin uso
  if (!puedeEnRuta(acc, pathname)) {
    return (
      <Result
        status="403"
        title="No autorizado"
        subTitle={`Tu rol actual es: ${session.user?.role || "Sin rol"}. No tienes permiso para ver esta página.`}
      />
    );
  }

  // 🔹 Si pasa todas las validaciones, renderiza el contenido
  return <>{children}</>;
}
