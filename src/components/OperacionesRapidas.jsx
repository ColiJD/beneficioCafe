"use client";

import { useState } from "react";
import { Button, Tooltip } from "antd";
import {
  BankOutlined,
  CalculatorOutlined,
  DollarOutlined,
  FileAddOutlined,
  FileDoneOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import OperacionRapida from "@/components/Prestamos/OperacionRapida";
import LiquidarSalidaRapida from "@/components/salidas/LiquidarSalidaRapida";
import PanelOperacion from "@/components/PanelOperacion";
import usePermisos from "@/components/usePermisos";
import { puedeEnModulo } from "@/lib/modulos";

// Módulo que corresponde a cada notificación (por su texto), para ocultar las que el usuario no puede atender
const MODULO_DE_NOTIFICACION = [
  [/^salidas pendientes/i, "salidas"],
  [/contratos?.*salida|salida.*contrato/i, "entregaContratoSalida"],
  [/contrato/i, "entregaContratos"],
  [/dep[oó]sito/i, "liqDeposito"],
  [/pr[eé]stamo/i, "prestamos"],
  [/anticipo/i, "anticipos"],
];

/**
 * Operaciones rápidas de un cliente (abono/anticipo/préstamo, interés, depósito, contrato...) sin salir
 * de la pantalla. Todo se muestra solo si el usuario tiene permiso.
 * cliente: { value, label } (o el comprador, con tipoPersona "comprador"). Devuelve piezas para pintar:
 *  barra (íconos), modales (paneles), abrirDesde(item) (clic en notificación),
 *  filtrar(lista) (quita notificaciones sin permiso) y recarga (cambia al terminar una operación).
 * ocultar: true dentro de un panel, para no anidar la barra.
 * tipoPersona "comprador": mismas operaciones de préstamo/anticipo y las de contratos de salida.
 */
export default function useOperacionesRapidas(cliente, { ocultar = false, tipoPersona = "cliente" } = {}) {
  const esComprador = tipoPersona === "comprador";
  const acc = usePermisos();
  const [prestamo, setPrestamo] = useState(false);
  const [interes, setInteres] = useState(false);
  const [liqSalida, setLiqSalida] = useState(false);
  const [panel, setPanel] = useState(null);
  const [documento, setDocumento] = useState(null); // # del contrato o depósito de la notificación, para dejarlo elegido
  const abrirPanel = (p, id = null) => {
    setDocumento(id);
    setPanel(p);
  };
  const [recarga, setRecarga] = useState(0);

  const can = (modulo) => puedeEnModulo(acc, modulo, "crear");
  const puedePrestamo = esComprador
    ? can("prestamosCompradores") || can("anticiposCompradores")
    : can("prestamos") || can("anticipos");
  const hayCliente = !!cliente?.value;

  const botones = [
    { tip: "Abono, anticipo o préstamo", icon: <DollarOutlined />, ok: puedePrestamo, abrir: () => setPrestamo(true) },
    { tip: "Calcular interés", icon: <CalculatorOutlined />, ok: puedePrestamo, abrir: () => setInteres(true) },
    ...(esComprador
      ? [
          { tip: "Nuevo contrato de salida", icon: <FileAddOutlined />, ok: can("contratoSalida"), abrir: () => abrirPanel("nuevoContratoSalida") },
          { tip: "Confirmación de venta", icon: <ShoppingCartOutlined />, ok: can("salidas"), abrir: () => abrirPanel("confirmacionVenta") },
          { tip: "Liquidar salida", icon: <BankOutlined />, ok: can("liqSalidas"), abrir: () => setLiqSalida(true) },
          { tip: "Entrega de contrato de salida", icon: <FileDoneOutlined />, ok: can("entregaContratoSalida"), abrir: () => abrirPanel("entregaSalida") },
        ]
      : [
          { tip: "Nuevo depósito", icon: <InboxOutlined />, ok: can("deposito"), abrir: () => abrirPanel("nuevoDeposito") },
          { tip: "Nuevo contrato", icon: <FileAddOutlined />, ok: can("contratos"), abrir: () => abrirPanel("nuevoContrato") },
          { tip: "Entrega de contrato", icon: <FileDoneOutlined />, ok: can("entregaContratos"), abrir: () => abrirPanel("contrato") },
          { tip: "Liquidar depósito", icon: <BankOutlined />, ok: can("liqDeposito"), abrir: () => abrirPanel("deposito") },
        ]),
  ].filter((b) => b.ok);

  const abrirDesde = (item) => {
    const t = String(item);
    const id = Number(t.match(/#(\d+)/)?.[1]) || null;
    if (/contratos?.*salida|salida.*contrato/i.test(t)) return esComprador && can("entregaContratoSalida") && abrirPanel("entregaSalida", id);
    if (esComprador) return /^salidas pendientes/i.test(t) && can("liqSalidas") && setLiqSalida(true);
    if (/contrato/i.test(t)) can("entregaContratos") && abrirPanel("contrato", id);
    else if (/dep[oó]sito/i.test(t)) can("liqDeposito") && abrirPanel("deposito", id);
    else if (puedePrestamo) setPrestamo(true);
  };

  const filtrar = (lista) =>
    lista.filter((n) => {
      const m = MODULO_DE_NOTIFICACION.find(([re]) => re.test(String(n)));
      return !m || puedeEnModulo(acc, m[1], "ver");
    });

  const barra =
    ocultar || !botones.length ? null : (
      <div style={{ display: "flex", gap: 2, padding: 3, border: "1px solid #E7DFD5", borderRadius: 10, background: "#FBF8F4" }}>
        {botones.map((b) => (
          <Tooltip key={b.tip} title={hayCliente ? b.tip : `${b.tip} (elija un cliente)`}>
            <Button type="text" icon={b.icon} aria-label={b.tip} disabled={!hayCliente} onClick={b.abrir} />
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
        tipoPersona={tipoPersona}
        cliente={
          !hayCliente
            ? null
            : esComprador
              ? { compradorId: cliente.value, compradorNombre: cliente.label }
              : { clienteID: cliente.value, clienteNombre: cliente.label, clienteApellido: "" }
        }
        onGuardado={alTerminar}
      />
      {esComprador && (
        <LiquidarSalidaRapida
          open={liqSalida}
          onClose={() => setLiqSalida(false)}
          comprador={hayCliente ? { value: cliente.value, label: cliente.label } : null}
          onCompleto={alTerminar}
        />
      )}
      <PanelOperacion
        tipo={panel}
        documento={documento}
        onClose={() => setPanel(null)}
        cliente={hayCliente ? { value: cliente.value, label: cliente.label } : null}
        onCompleto={alTerminar}
      />
    </>
  );

  return { barra, modales, abrirDesde, filtrar, recarga };
}
