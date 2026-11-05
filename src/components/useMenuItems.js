"use client";
import usePermisos from "@/components/usePermisos";
import { menuItems } from "@/lib/menu";
import { puedeEnRuta } from "@/lib/modulos";

// menuItems sin lo que el usuario no puede ver; null mientras cargan los permisos
export default function useMenuItems() {
  const acc = usePermisos();
  if (!acc) return null;
  return menuItems
    .map((i) => (i.subItems ? { ...i, subItems: i.subItems.filter((s) => puedeEnRuta(acc, s.href)) } : i))
    .filter((i) => (i.subItems ? i.subItems.length : puedeEnRuta(acc, i.href)));
}
