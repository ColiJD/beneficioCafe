"use client";

import { useState } from "react";
import { Button, Tooltip } from "antd";
import {
  BankOutlined,
  CalculatorOutlined,
  DollarOutlined,
  FileAddOutlined,
  FileDoneOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import OperacionRapida from "@/components/Prestamos/OperacionRapida";
import PanelOperacion from "@/components/PanelOperacion";
import usePermisos from "@/components/usePermisos";
import { puedeEnModulo } from "@/lib/modulos";

// Módulo que corresponde a cada notificación (por su texto), para ocultar las que el usuario no puede atender
const MODULO_DE_NOTIFICACION = [
  [/salida/i, "entregaContratoSalida"],
  [/contrato/i, "entregaContratos"],
  [/dep[oó]sito/i, "liqDeposito"],
  [/pr[eé]stamo/i, "prestamos"],
  [/anticipo/i, "anticipos"],
];

/**
 * Operaciones rápidas de un cliente (abono/anticipo/préstamo, interés, depósito, contrato...) sin salir
 * de la pantalla. Todo se muestra solo si el usuario tiene permiso.
 * cliente: { value, label }. Devuelve piezas para pintar:
 *  barra (íconos), modales (paneles), abrirDesde(item) (clic en notificación),
 *  filtrar(lista) (quita notificaciones sin permiso) y recarga (cambia al terminar una operación).
 * ocultar: true dentro de un panel, para no anidar la barra.
 */
export default function useOperacionesRapidas(cliente, { ocultar = false } = {}) {
  const acc = usePermisos();
  const [prestamo, setPrestamo] = useState(false);
  const [interes, setInteres] = useState(false);
  const [panel, setPanel] = useState(null);
  const [recarga, setRecarga] = useState(0);

  const can = (modulo) => puedeEnModulo(acc, modulo, "crear");
  const puedePrestamo = can("prestamos") || can("anticipos");
  const hayCliente = !!cliente?.value;

  const botones = [
    { tip: "Abono, anticipo o préstamo", icon: <DollarOutlined />, ok: puedePrestamo, abrir: () => setPrestamo(true) },
    { tip: "Calcular interés", icon: <CalculatorOutlined />, ok: puedePrestamo, abrir: () => setInteres(true) },
    { tip: "Nuevo depósito", icon: <InboxOutlined />, ok: can("deposito"), abrir: () => setPanel("nuevoDeposito") },
    { tip: "Nuevo contrato", icon: <FileAddOutlined />, ok: can("contratos"), abrir: () => setPanel("nuevoContrato") },
    { tip: "Entrega de contrato", icon: <FileDoneOutlined />, ok: can("entregaContratos"), abrir: () => setPanel("contrato") },
    { tip: "Liquidar depósito", icon: <BankOutlined />, ok: can("liqDeposito"), abrir: () => setPanel("deposito") },
  ].filter((b) => b.ok);

  const abrirDesde = (item) => {
    const t = String(item);
    if (/salida/i.test(t)) return;
    if (/contrato/i.test(t)) can("entregaContratos") && setPanel("contrato");
    else if (/dep[oó]sito/i.test(t)) can("liqDeposito") && setPanel("deposito");
    else if (puedePrestamo) setPrestamo(true);
  };

  const filtrar = (lista) =>
    lista.filter((n) => {
      const m = MODULO_DE_NOTIFICACION.find(([re]) => re.test(String(n)));
      return !m || puedeEnModulo(acc, m[1], "ver");
    });

  const barra =
    ocultar || !botones.length ? null : (
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
        {botones.map((b) => (
          <Tooltip key={b.tip} title={hayCliente ? b.tip : `${b.tip} (elija un cliente)`}>
            <Button icon={b.icon} aria-label={b.tip} disabled={!hayCliente} onClick={b.abrir} />
          </Tooltip>
        ))}
      </div>
    );

  const alTerminar = () => setRecarga((n) => n + 1);
  const modales = ocultar ? null : (
    <>
      <OperacionRapida
        open={prestamo}
        onClose={() => setPrestamo(false)}
        interesOpen={interes}
        onCloseInteres={() => setInteres(false)}
        cliente={hayCliente ? { clienteID: cliente.value, clienteNombre: cliente.label, clienteApellido: "" } : null}
        onGuardado={alTerminar}
      />
      <PanelOperacion
        tipo={panel}
        onClose={() => setPanel(null)}
        cliente={hayCliente ? { value: cliente.value, label: cliente.label } : null}
        onCompleto={alTerminar}
      />
    </>
  );

  return { barra, modales, abrirDesde, filtrar, recarga };
}
