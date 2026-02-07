"use client";

import { useSession, getSession } from "next-auth/react";
import { Spin, Result, Button } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProtectedPage({ allowedRoles = [], children }) {
  const { data: session, status } = useSession();
  const [currentSession, setCurrentSession] = useState(session);
  const router = useRouter();

  // 🔹 Mantener sesión actualizada
  useEffect(() => {
    const checkSession = async () => {
      const updated = await getSession();
      setCurrentSession(updated);
    };

    checkSession(); // se ejecuta al montar y cuando cambia status
  }, [status]);

  // 🔹 Mientras carga la sesión
  if (status === "loading" || !currentSession) {
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
  if (!currentSession) {
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
  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(currentSession.user.role)
  ) {
    return (
      <Result
        status="403"
        title="No autorizado"
        subTitle="No tienes permiso para ver esta página"
      />
    );
  }

  // 🔹 Si pasa todas las validaciones, renderiza el contenido
  return <>{children}</>;
}
