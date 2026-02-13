"use client";

import { useSession, getSession } from "next-auth/react";
import { Spin, Result, Button } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProtectedPage({ allowedRoles = [], children }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 🔹 Mientras carga la sesión
  if (status === "loading") {
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

  // 🔹 Si el rol no está permitido
  if (allowedRoles.length > 0 && !allowedRoles.includes(session.user?.role)) {
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
