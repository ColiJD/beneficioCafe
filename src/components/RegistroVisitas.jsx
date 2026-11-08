"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Avisa a la bitácora cada vez que el usuario entra a una pantalla. No bloquea ni muestra nada.
export default function RegistroVisitas() {
  const ruta = usePathname();
  useEffect(() => {
    if (!ruta) return;
    fetch("/api/bitacora", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruta }), keepalive: true }).catch(() => {});
  }, [ruta]);
  return null;
}
