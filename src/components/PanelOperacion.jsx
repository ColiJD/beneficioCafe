"use client";

import { Drawer } from "antd";
import EntregaContrato from "@/app/private/page/transacciones/contrato/entrega/page";
import LiquidarDeposito from "@/app/private/page/transacciones/deposito/liqDeposito/page";
import NuevoContrato from "@/app/private/page/transacciones/contrato/page";
import NuevoDeposito from "@/app/private/page/transacciones/deposito/page";

const PANELES = {
  nuevoContrato: { titulo: "Nuevo contrato", Pantalla: NuevoContrato },
  nuevoDeposito: { titulo: "Nuevo depósito", Pantalla: NuevoDeposito },
  contrato: { titulo: "Entrega de contrato", Pantalla: EntregaContrato },
  deposito: { titulo: "Liquidar depósito", Pantalla: LiquidarDeposito },
};

/**
 * Abre una pantalla de transacciones completa dentro de un panel, con el cliente ya elegido,
 * para resolver una notificación sin salir de la pantalla actual.
 * tipo: "contrato" | "deposito" (entregar/liquidar) | "nuevoContrato" | "nuevoDeposito"; cliente: { value, label }.
 */
export default function PanelOperacion({ tipo, onClose, cliente, onCompleto }) {
  const panel = PANELES[tipo];
  return (
    <Drawer
      title={panel ? `${panel.titulo} - ${cliente?.label || ""}` : ""}
      open={!!panel}
      onClose={onClose}
      width={760}
      zIndex={1100}
      destroyOnClose
    >
      {panel && (
        <panel.Pantalla
          clienteInicial={cliente}
          embebido
          onCompleto={() => {
            onCompleto?.();
            onClose();
          }}
        />
      )}
    </Drawer>
  );
}
