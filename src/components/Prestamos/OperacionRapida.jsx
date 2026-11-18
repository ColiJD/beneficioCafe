"use client";

import { message } from "antd";
import DrawerPrestamo from "./DrawerPrestamo";
import DrawerCalculoInteres from "./calculoInteres";

const URL_POR_TIPO = {
  PRESTAMO: "/api/prestamos",
  ANTICIPO: "/api/anticipos",
  ABONO_ANTICIPO: "/api/anticipos/movimiento",
  INTERES_ANTICIPO: "/api/anticipos/movimiento",
  CARGO_ANTICIPO: "/api/anticipos/movimiento",
  ABONO: "/api/prestamos/movimiento",
  PAGO_INTERES: "/api/prestamos/movimiento",
  "Int-Cargo": "/api/prestamos/movimiento",
};

const URL_COMPRADOR = {
  PRESTAMO: "/api/prestamosCompradores",
  ANTICIPO: "/api/anticiposCompradores",
  ABONO: "/api/prestamosCompradores/movimiento",
  PAGO_INTERES: "/api/prestamosCompradores/movimiento",
  "Int-Cargo": "/api/prestamosCompradores/movimiento",
  ABONO_ANTICIPO: "/api/anticiposCompradores/movimiento",
  INTERES_ANTICIPO: "/api/anticiposCompradores/movimiento",
  CARGO_ANTICIPO: "/api/anticiposCompradores/movimiento",
};

/** Registra un préstamo, anticipo o movimiento de un cliente o comprador. Devuelve { ok, error }. */
export async function guardarMovimiento(v, id, tipoPersona = "cliente") {
  const url = (tipoPersona === "comprador" ? URL_COMPRADOR : URL_POR_TIPO)[v.tipo];
  if (!url) return { ok: false, error: "Tipo de movimiento no válido" };
  const persona = tipoPersona === "comprador" ? { compradorID: id, tipo_movimiento: v.tipo } : { clienteID: id };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...v, ...persona }),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: data.error || "Error" };
}

/**
 * Formulario de préstamo/anticipo/abono en un panel, para usarlo desde cualquier pantalla
 * sin cambiar de página. cliente: { clienteID, clienteNombre, clienteApellido };
 * con tipoPersona="comprador", cliente es { compradorId, compradorNombre }.
 */
export default function OperacionRapida({
  open,
  onClose,
  cliente,
  tipoPersona = "cliente",
  onGuardado,
  interesOpen = false,
  onCloseInteres,
}) {
  const [messageApi, contextHolder] = message.useMessage();

  const onFinish = async (v) => {
    const r = await guardarMovimiento(v, tipoPersona === "comprador" ? cliente?.compradorId : cliente?.clienteID, tipoPersona);
    if (!r.ok) {
      messageApi.error(r.error);
      throw new Error(r.error); // DrawerPrestamo conserva lo escrito si falla
    }
    messageApi.success("Registro guardado");
    onGuardado?.();
  };
  // El drawer de interés se cierra solo al terminar; el de préstamo lo cerramos aquí
  const onFinishPrestamo = async (v) => {
    await onFinish(v);
    onClose();
  };

  return (
    <>
      {contextHolder}
      <DrawerPrestamo
        open={open}
        onClose={onClose}
        onFinish={onFinishPrestamo}
        clienteSeleccionado={cliente}
        compradorSeleccionado={cliente}
        tipoPersona={tipoPersona}
        zIndex={1100}
      />
      <DrawerCalculoInteres
        open={interesOpen}
        onClose={onCloseInteres}
        onSubmit={onFinish}
        clienteSeleccionado={cliente}
        compradorSeleccionado={cliente}
        tipoPersona={tipoPersona}
        zIndex={1100}
      />
    </>
  );
}
