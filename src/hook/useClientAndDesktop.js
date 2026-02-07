// hooks/useClientAndDesktop.js
"use client";
import { useState, useEffect } from "react";
import { Grid } from "antd";

const { useBreakpoint } = Grid;

export default function useClientAndDesktop() {
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);

  // 🔹 Detectar que estamos en cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // 🔹 Determinar si es desktop (pantalla md o mayor)
  const isDesktop = mounted && screens.md;

  return { mounted, isDesktop };
}
