"use client";

import { useEffect, useState } from "react";
import { message } from "antd";
import LiquidacionDrawer from "@/components/salidas/DrawerLIquidacion";
import { obtenerSalidasPendientes } from "@/lib/consultas";

/** Liquidar salidas pendientes de un comprador desde cualquier pantalla. comprador: { value, label }. */
export default function LiquidarSalidaRapida({ open, onClose, comprador, onCompleto }) {
  const [messageApi, contextHolder] = message.useMessage();
  const [detalles, setDetalles] = useState([]);

  useEffect(() => {
    if (!open || !comprador?.value) return;
    obtenerSalidasPendientes(comprador.value)
      .then((d) => setDetalles(d?.detalles || []))
      .catch(() => messageApi.error("No se pudieron cargar las salidas pendientes."));
  }, [open, comprador?.value, messageApi]);

  const liquidar = async (data) => {
    try {
      const res = await fetch("/api/salidas/liquidarSalida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compradorID: comprador.value, ...data }),
      });
      const r = await res.json();
      if (!res.ok) return messageApi.error(r.error || "Error en la liquidación");
      messageApi.success("Liquidación realizada con éxito.");
      onCompleto?.();
    } catch (err) {
      console.error(err);
      messageApi.error("Error enviando la liquidación.");
    }
  };

  return (
    <>
      {contextHolder}
      <LiquidacionDrawer
        visible={open}
        onClose={onClose}
        comprador={comprador}
        detalles={detalles}
        onLiquidar={liquidar}
        messageApi={messageApi}
        zIndex={1100}
      />
    </>
  );
}
