"use client";

import { Drawer, message } from "antd";
import EntregaContrato from "@/app/private/page/transacciones/contrato/entrega/page";
import LiquidarDeposito from "@/app/private/page/transacciones/deposito/liqDeposito/page";
import NuevoContrato from "@/app/private/page/transacciones/contrato/page";
import NuevoContratoSalida from "@/app/private/page/transacciones/contratoSalida/page";
import EntregaContratoSalida from "@/app/private/page/transacciones/contratoSalida/entrega/page";
import ConfirmacionVenta from "@/app/private/page/transacciones/salidas/page";
import NuevoDeposito from "@/app/private/page/transacciones/deposito/page";

// Función y no constante: estas pantallas importan este panel (por la barra) y el ciclo las dejaría sin definir al cargar
const paneles = () => ({
  confirmacionVenta: { titulo: "Confirmación de venta", Pantalla: ConfirmacionVenta },
  nuevoContratoSalida: { titulo: "Nuevo contrato de salida", Pantalla: NuevoContratoSalida },
  entregaSalida: { titulo: "Entrega de contrato de salida", Pantalla: EntregaContratoSalida },
  nuevoContrato: { titulo: "Nuevo contrato", Pantalla: NuevoContrato },
  nuevoDeposito: { titulo: "Nuevo depósito", Pantalla: NuevoDeposito },
  contrato: { titulo: "Entrega de contrato", Pantalla: EntregaContrato },
  deposito: { titulo: "Liquidar depósito", Pantalla: LiquidarDeposito },
});

/**
 * Abre una pantalla de transacciones completa dentro de un panel, con el cliente ya elegido,
 * para resolver una notificación sin salir de la pantalla actual.
 * tipo: "contrato" | "deposito" (entregar/liquidar) | "nuevoContrato" | "nuevoDeposito"; cliente: { value, label };
 * documento: # del contrato o depósito a dejar elegido (con su tipo de café).
 */
export default function PanelOperacion({ tipo, onClose, cliente, documento, onCompleto }) {
  const panel = paneles()[tipo];
  const [api, contextHolder] = message.useMessage();
  return (
    <>
      {contextHolder}
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
          documentoInicial={documento}
          embebido
          onCompleto={() => {
            // los avisos del formulario se pierden al cerrar el panel, así que avisamos desde aquí
            api.success(`${panel.titulo}: registrado correctamente`);
            onCompleto?.();
            onClose();
          }}
        />
      )}
    </Drawer>
    </>
  );
}
