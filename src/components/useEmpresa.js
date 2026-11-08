"use client";
import { useEffect, useState } from "react";

import { cargarEmpresa, funcionHabilitada } from "@/lib/empresa-cliente";

// Datos de la empresa (nombre, logo, …) y tieneFuncion(). Vacío mientras carga.
export default function useEmpresa() {
  const [empresa, setEmpresa] = useState(null);
  useEffect(() => { cargarEmpresa().then(setEmpresa); }, []);
  return { ...(empresa ?? { nombre: "", logo: "/api/empresa/imagen/logo" }), tieneFuncion: (n) => funcionHabilitada(empresa?.funciones, n) };
}
