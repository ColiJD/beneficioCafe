"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// Permisos efectivos del usuario en sesión (null mientras carga)
export default function usePermisos() {
  const { status } = useSession();
  const [acc, setAcc] = useState(null);
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/auth/permisos")
      .then((r) => (r.ok ? r.json() : null))
      .then(setAcc)
      .catch(() => setAcc(null));
  }, [status]);
  return acc;
}
