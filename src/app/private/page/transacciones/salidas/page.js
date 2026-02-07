"use client";

import { useState, useEffect, useRef } from "react";
import { message } from "antd";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import ProtectedPage from "@/components/ProtectedPage";
import NotificationDrawer from "@/components/NotificationDrawer";
import FloatingNotificationButton from "@/components/FloatingNotificationButton";
import { useRouter } from "next/navigation";
import {
  obtenerSelectData,
  obtenerSalidasPendientes,
  verificarContratosSalidaPendientes,
} from "@/lib/consultas"; // tu función de referencia
import {
  SolutionOutlined,
  SaveOutlined,
  FileAddOutlined,
} from "@ant-design/icons";
import LiquidacionDrawer from "@/components/salidas/DrawerLIquidacion";
import { PDFComprobante } from "@/Doc/Documentos/generico";

export default function FormSalida() {
  const [compradores, setCompradores] = useState([]);
  const [comprador, setComprador] = useState(null);
  const [salidaCantidadQQ, setSalidaCantidadQQ] = useState("");
  const [salidaPrecio, setSalidaPrecio] = useState("");
  const [salidaDescripcion, setSalidaDescripcion] = useState("");
  const [errors, setErrors] = useState({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const messageApiRef = useRef(messageApi);
  const [liqData, setLiqData] = useState({});
  const [liqDrawerVisible, setLiqDrawerVisible] = useState(false);

  useEffect(() => {
    async function cargarNotificaciones() {
      setNotifications([]);

      if (!comprador?.value) return;

      const data = await obtenerSalidasPendientes(comprador.value);
      const contratos = await verificarContratosSalidaPendientes(
        comprador.value
      );

      const mensajes = [];
      if (data.cantidadPendiente > 0) {
        mensajes.push(
          `Salidas pendientes: ${Number(data.cantidadPendiente).toFixed(2)} QQ`
        );
      }

      if (contratos.length > 0) {
        mensajes.push(...contratos);
      }

      if (mensajes.length === 0) mensajes.push("No hay pendientes.");

      setNotifications(mensajes);
    }

    cargarNotificaciones();
  }, [comprador]);
  // Cargar compradores
  useEffect(() => {
    async function cargarCompradores() {
      const compradoresData = await obtenerSelectData({
        url: "/api/compradores",
        messageApi: messageApiRef.current,
        valueField: "compradorId",
        labelField: "compradorNombre",
      });
      setCompradores(compradoresData);
    }
    cargarCompradores();
  }, []);

  const handleAbrirLiquidacion = async (comprador) => {
    if (!comprador?.value) {
      messageApiRef.current.warning(
        "No se ha seleccionado un comprador válido."
      );
      return;
    }

    const data = await obtenerSalidasPendientes(comprador.value);

    setLiqData({
      comprador,
      cantidadPendiente: data.cantidadPendiente,
      precioPendiente: data.precioPendiente,
      detalles: data.detalles,
    });
    setLiqDrawerVisible(true);
  };

  // Validación de datos
  const validarDatos = () => {
    const newErrors = {};
    if (!comprador) newErrors["Comprador"] = "Seleccione un comprador";
    if (!salidaCantidadQQ || parseFloat(salidaCantidadQQ) <= 0)
      newErrors["Cantidad"] = "Cantidad debe ser mayor que cero";
    if (!salidaPrecio || parseFloat(salidaPrecio) <= 0)
      newErrors["Precio"] = "Precio debe ser mayor que cero";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      messageApi.warning("Complete los campos obligatorios correctamente");
      return false;
    }
    return true;
  };

  const handleRegistrarClick = () => {
    if (validarDatos()) setPreviewVisible(true);
  };

  const handleConfirmar = async () => {
    setSubmitting(true);
    const data = {
      compradorID: comprador.value,
      salidaCantidadQQ: parseFloat(salidaCantidadQQ),
      salidaPrecio: parseFloat(salidaPrecio),
      salidaDescripcion,
    };
    try {
      const res = await fetch("/api/salidas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (!res.ok || !result.salidaID) {
        throw new Error(result.error || "No se pudo registrar la salida");
      }

      messageApi.success("Salida registrada exitosamente");
      setPreviewVisible(false);

      // 🔹 Loading mientras se genera PDF
      messageApi.open({
        type: "loading",
        content: "Generando comprobante de compra, por favor espere...",
        duration: 0,
        key: "generandoComprobante",
      });

      try {
        // Generar PDF de comprobante
        await PDFComprobante({
          tipoComprobante: "COMPROBANTE DE SALIDA",
          cliente: comprador.label,
          productos: [
            {
              nombre: "Cafe Seco", // o usar salidaDescripcion si es más general
              cantidad: parseFloat(salidaCantidadQQ),
              precio: parseFloat(salidaPrecio),
              total: parseFloat(salidaCantidadQQ) * parseFloat(salidaPrecio),
            },
          ],
          total: parseFloat(salidaCantidadQQ) * parseFloat(salidaPrecio),
          observaciones: salidaDescripcion,
          comprobanteID: result.salidaID,
          columnas: [
            { title: "Producto", key: "nombre" },
            { title: "Cantidad (QQ)", key: "cantidad" },
            { title: "Precio (LPS)", key: "precio" },
            { title: "Total (LPS)", key: "total" },
          ],
        });

        messageApi.destroy("generandoComprobante");
        messageApi.success("Comprobante generado correctamente");
      } catch (err) {
        console.error("Error generando PDF:", err);
        messageApi.destroy("generandoComprobante");
        messageApi.error("Error generando comprobante PDF");
      }

      // Limpiar formulario
      setComprador(null);
      setSalidaCantidadQQ("");
      setSalidaPrecio("");
      setSalidaDescripcion("");
      setErrors({});
    } catch (err) {
      console.error(err);
      messageApi.error("Error enviando datos al servidor");
    } finally {
      setSubmitting(false);
    }
  };

  const fields = [
    {
      label: "Comprador",
      value: comprador,
      setter: setComprador,
      type: "select",
      options: compradores,
      required: true,
      error: errors["Comprador"],
    },
    {
      label: "Cantidad (QQ)",
      value: salidaCantidadQQ,
      setter: setSalidaCantidadQQ,
      type: "Float",
      required: true,
      error: errors["Cantidad"],
    },
    {
      label: "Precio",
      value: salidaPrecio,
      setter: setSalidaPrecio,
      type: "Float",
      required: true,
      error: errors["Precio"],
    },
    {
      label: "Descripción",
      value: salidaDescripcion,
      setter: setSalidaDescripcion,
      type: "textarea",
    },
  ];

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS"]}>
      <>
        {contextHolder}
        <FloatingNotificationButton
          notifications={notifications}
          onClick={() => setDrawerVisible(true)}
        />
        <NotificationDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          title="Notificaciones"
          subtitle={comprador?.label}
          notifications={notifications}
          actions={[
            {
              tooltip: "Ir a Registro de Confirmacion",
              icon: <FileAddOutlined />,
              onClick: () =>
                router.push("/private/page/transacciones/salidas/registro"),
            },
            {
              tooltip: "Ir a Registro de Liquidacion",
              icon: <SolutionOutlined />,
              onClick: () =>
                router.push("/private/page/transacciones/salidas/registroliq"),
            },
            {
              label: "Liquidar Salida",
              type: "primary", // color azul de primary
              onClick: () => handleAbrirLiquidacion(comprador),
            },
          ]}
        />
        <LiquidacionDrawer
          visible={liqDrawerVisible}
          onClose={() => setLiqDrawerVisible(false)}
          comprador={liqData.comprador}
          cantidadPendiente={liqData.cantidadPendiente}
          precioPendiente={liqData.precioPendiente}
          detalles={liqData.detalles}
          messageApi={messageApiRef.current} // ← IMPORTANTE
          onLiquidar={async (data) => {
            try {
              const res = await fetch("/api/salidas/liquidarSalida", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  compradorID: liqData.comprador.value,
                  ...data,
                }),
              });

              const result = await res.json();

              if (!res.ok) {
                if (
                  result.error ===
                  "No hay salidas pendientes para este comprador"
                ) {
                  messageApiRef.current.warning(
                    "No hay pendientes para liquidar."
                  );
                  return;
                }
                messageApiRef.current.error(
                  result.error || "Error en la liquidación"
                );
                return;
              }

              messageApiRef.current.success("Liquidación realizada con éxito.");
            } catch (err) {
              console.error(err);
              messageApiRef.current.error("Error enviando la liquidación.");
            }
          }}
        />

        <Formulario
          title="Registrar Salida"
          fields={fields}
          onSubmit={handleRegistrarClick}
          submitting={submitting}
          button={{
            text: "Registrar Salida",
            onClick: handleRegistrarClick,
            type: "primary",
          }}
        />
        <PreviewModal
          open={previewVisible}
          title="Previsualización de Salida"
          onCancel={() => setPreviewVisible(false)}
          onConfirm={handleConfirmar}
          confirmLoading={submitting}
          fields={fields.map((f) => ({
            label: f.label,
            value:
              f.type === "select" && f.value
                ? f.value.label // mostrar solo el label del select
                : f.value || "-", // para inputs normales
          }))}
        />
      </>
    </ProtectedPage>
  );
}
