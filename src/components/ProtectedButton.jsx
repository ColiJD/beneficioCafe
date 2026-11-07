// ProtectedButton.js — muestra el contenido solo si el usuario tiene `accion` (crear | editar | eliminar)
// en `modulo` (por defecto, el módulo de la página actual; pásalo si la acción llama a otro módulo).
"use client";
import { usePathname } from "next/navigation";
import usePermisos from "@/components/usePermisos";
import { puedeEnRuta, puedeEnModulo } from "@/lib/modulos";

export default function ProtectedButton({ accion = "editar", modulo, children }) {
  const acc = usePermisos();
  const pathname = usePathname();
  const ok = modulo ? puedeEnModulo(acc, modulo, accion) : puedeEnRuta(acc, pathname, accion);
  return ok ? <>{children}</> : null;
}
