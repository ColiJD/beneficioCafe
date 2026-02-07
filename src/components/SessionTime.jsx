"use client";
import { useEffect, useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { Modal, message } from "antd";

export default function SessionTimeout({ warnBeforeSeconds = 60 }) {
  const { data: session, update } = useSession(); // Agregar update
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const signOutTimeoutRef = useRef(null);
  const warnTimeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    clearTimeout(signOutTimeoutRef.current);
    clearTimeout(warnTimeoutRef.current);
    clearInterval(intervalRef.current);

    if (!session?.expires) return;

    const expiresAt = new Date(session.expires).getTime();
    const now = Date.now();
    const msUntilExpire = Math.max(0, expiresAt - now);
    const warnMs = Math.max(0, msUntilExpire - warnBeforeSeconds * 1000);

    // Mostrar modal antes de expirar
    warnTimeoutRef.current = setTimeout(() => {
      setVisible(true);
      setCountdown(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));

      intervalRef.current = setInterval(() => {
        const secondsLeft = Math.max(
          0,
          Math.ceil((expiresAt - Date.now()) / 1000)
        );
        setCountdown(secondsLeft);
        if (secondsLeft <= 0) clearInterval(intervalRef.current);
      }, 1000);
    }, warnMs);

    // Auto signOut al expirar
    signOutTimeoutRef.current = setTimeout(() => {
      signOut({ callbackUrl: "/login" });
    }, msUntilExpire);

    return () => {
      clearTimeout(signOutTimeoutRef.current);
      clearTimeout(warnTimeoutRef.current);
      clearInterval(intervalRef.current);
    };
  }, [session, warnBeforeSeconds]);

  const keepAlive = async () => {
    if (isRefreshing) return; // Prevenir múltiples llamadas

    try {
      setIsRefreshing(true);

      // Opción 1: Usar NextAuth update (Recomendado)
      const result = await update();
      if (result) {
        // Usar setTimeout para evitar el warning de React 18
        setTimeout(() => {
          messageApi.success("Sesión extendida exitosamente");
        }, 0);
        setVisible(false);
        return;
      }

      // Opción 2: Si necesitas usar tu API personalizada
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshToken: session.user.refreshToken,
          userId: session.user.id,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Actualizar la sesión con los nuevos datos
        await update({
          ...session,
          expires: data.expires,
          user: {
            ...session.user,
            refreshToken: data.refreshToken,
          },
        });

        // Usar setTimeout para evitar el warning de React 18
        setTimeout(() => {
          messageApi.success("Sesión extendida 5 minutos más");
        }, 0);
        setVisible(false);
      } else {
        setTimeout(() => {
          messageApi.error(data.error || "No se pudo renovar la sesión");
        }, 0);
        setTimeout(() => {
          signOut({ callbackUrl: "/login" });
        }, 1000);
      }
    } catch (err) {
      console.error("Error renovando sesión:", err);
      setTimeout(() => {
        messageApi.error("Error al renovar la sesión");
      }, 0);
      setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, 1000);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        open={visible}
        title="Tu sesión está por expirar"
        okText="Seguir conectado"
        cancelText="Cerrar sesión"
        confirmLoading={isRefreshing}
        onOk={keepAlive}
        onCancel={() => signOut({ callbackUrl: "/login" })}
        closable={false}
        maskClosable={false}
      >
        <p>
          Tu sesión expirará en <strong>{countdown ?? "..."}</strong> segundos.
        </p>
        <p>Si no haces nada se cerrará automáticamente.</p>
      </Modal>
    </>
  );
}
