"use client";

import { useState, useEffect, useRef } from "react";
import { message } from "antd";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import ProtectedPage from "@/components/ProtectedPage";
import { obtenerClientesSelect, obtenerProductosSelect } from "@/lib/consultas";
import {
  limpiarFormulario,
  validarEnteroPositivo,
  validarFloatPositivo,
} from "@/config/validacionesForm";
import { calcularCafeDesdeProducto } from "@/lib/calculoCafe";
import { exportDeposito } from "@/Doc/Documentos/desposito";
import { FloatingButton } from "@/components/Button";
import { UnorderedListOutlined, SolutionOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import {
  verificarClientesPendientesContratos,
  verificarDepositosPendientes,
  verificarPrestamosPendientes,
  verificarAnticiposPendientes,
} from "@/lib/consultas";
import NotificationDrawer from "@/components/NotificationDrawer";
import FloatingNotificationButton from "@/components/FloatingNotificationButton";
export default function FormDeposito() {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  
  

  const [cliente, setCliente] = useState(null);
  const [producto, setProducto] = useState(null);
  const [depositoCantidadQQ, setDepositoCantidadQQ] = useState("");
  const [depositoTotalSacos, setDepositoTotalSacos] = useState("");
  const [depositoEn, setDepositoEn] = useState("");
  const [depositoRetencion, setDepositoRetencion] = useState(0);
  const [depositoDescripcion, setDepositoDescripcion] = useState("");
  const [pesoBruto, setPesoBruto] = useState("");

  const [errors, setErrors] = useState({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false); // control de drawer
  const [notifications, setNotifications] = useState([]); // notificaciones
  const router = useRouter();

  const [messageApi, contextHolder] = message.useMessage();
  const messageApiRef = useRef(messageApi);

  useEffect(() => {
    async function cargarNotificaciones() {
      setNotifications([]); // limpiar notificaciones si cambia el cliente

      if (!cliente || !cliente.value) return;

      const mensajesContratos = await verificarClientesPendientesContratos(
        cliente.value
      );
      const mensajesDepositos = await verificarDepositosPendientes(
        cliente.value
      );
      const mensajesPrestamos = await verificarPrestamosPendientes(
        cliente.value
      );
      const mensajesAnticipos = await verificarAnticiposPendientes(
        cliente.value
      );

      setNotifications([
        ...mensajesContratos,
        ...mensajesDepositos,
        ...mensajesPrestamos,
        ...mensajesAnticipos,
      ]);
    }

    cargarNotificaciones();
  }, [cliente]);

  // Carga clientes y productos
  useEffect(() => {
    async function cargarDatos() {
      try {
        const clientesData = await obtenerClientesSelect(messageApiRef.current);
        const productosData = await obtenerProductosSelect(
          messageApiRef.current
        );
        setClientes(clientesData);
        setProductos(productosData);
      } catch (err) {
        console.error(err);
        messageApiRef.current.error("Error cargando clientes o productos");
      }
    }
    cargarDatos();
  }, []);

  useEffect(() => {
    if (!producto) return;

    const resultado = calcularCafeDesdeProducto(
      pesoBruto,
      depositoTotalSacos,
      producto
    );
    setDepositoCantidadQQ(resultado.oro);
    setDepositoRetencion(resultado.retencion);
  }, [pesoBruto, depositoTotalSacos, producto]);

  // Validación
  const validarDatos = () => {
    const newErrors = {}; // en JS no hace falta tipar nada

    fields.forEach((f) => {
      if (typeof f.validator === "function") {
        const error = f.validator(f.value);
        if (error) newErrors[f.label] = error;
      }
    });

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
      clienteID: cliente.value,
      depositoTipoCafe: producto.value,
      depositoCantidadQQ: parseFloat(depositoCantidadQQ),
      depositoTotalSacos:
        producto?.label === "Cafe Lata"
          ? 1
          : depositoTotalSacos
          ? parseInt(depositoTotalSacos, 10)
          : 0,
      depositoEn: depositoEn || "Depósito",
      depositoDescripcion,
      depositoRetencion: parseFloat(depositoRetencion) || 0,
    };
    try {
      const res = await fetch("/api/deposito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (!res.ok || !result.depositoID) {
        throw new Error(result.error || "No se pudo registrar el depósito");
      }

      messageApi.success("Depósito registrado exitosamente");
      setPreviewVisible(false);

      // 🔹 Loading mientras se genera PDF
      messageApi.open({
        type: "loading",
        content: "Generando comprobante de depósito, por favor espere...",
        duration: 0,
        key: "generandoComprobante",
      });

      try {
        await exportDeposito({
          cliente,
          productos: [
            {
              nombre: producto.label,
              cantidad: parseFloat(depositoCantidadQQ),
            },
          ],
          total: parseFloat(depositoCantidadQQ),
          observaciones: depositoDescripcion,
          comprobanteID: result.depositoID,
        });

        messageApi.destroy("generandoComprobante");
        messageApi.success("Comprobante generado correctamente");
      } catch (err) {
        console.error("Error generando PDF:", err);
        messageApi.destroy("generandoComprobante");
        messageApi.error("Error generando comprobante PDF");
      }

      // 🔹 Limpiar formulario
      limpiarFormulario({
        setCliente,
        setProducto,
        setDepositoCantidadQQ,
        setDepositoTotalSacos,
        setDepositoEn,
        setDepositoDescripcion,
        setPesoBruto,
        setDepositoRetencion,
        setErrors,
      });
    } catch (err) {
      console.error(err);
      messageApi.error("Error enviando datos al servidor");
    } finally {
      setSubmitting(false);
    }
  };
  const fields = [
    {
      label: "Cliente",
      value: cliente,
      setter: setCliente,
      type: "select",
      options: clientes,
      required: true,
      error: errors["Cliente"],
      validator: (v) => (v ? null : "Seleccione un cliente"),
    },
    {
      label: "Tipo de Café",
      value: producto,
      setter: setProducto,
      type: "select",
      options: productos,
      required: true,
      error: errors["Tipo de Café"],
      validator: (v) => (v ? null : "Seleccione un café"),
    },
    {
      label:
        producto?.label === "Cafe Lata"
          ? "Cantidad de Latas"
          : "Peso Bruto (lbs)",
      value: pesoBruto,
      setter: setPesoBruto,
      type: "Float",
      required: true,
      error:
        errors[
          producto?.label === "Cafe Lata"
            ? "Cantidad de Latas"
            : "Peso Bruto (lbs)"
        ],
      validator: validarFloatPositivo,
    },
    {
      label: "Total Sacos",
      value: producto?.label === "Cafe Lata" ? 0 : depositoTotalSacos,
      setter:
        producto?.label === "Cafe Lata" ? () => {} : setDepositoTotalSacos,
      type: "integer",
      required: producto?.label === "Cafe Lata" ? false : true,
      error: errors["Total Sacos"],
      readOnly: producto?.label === "Cafe Lata",
      validator: (v) => {
        if (producto?.label === "Cafe Lata") return null;
        if (v === "" || v === null || v === undefined)
          return "Ingrese total de sacos";
        return validarEnteroPositivo(v) ? null : "Total sacos debe ser > 0";
      },
    },
    {
      label: "Quintales Oro",
      value: depositoCantidadQQ,
      setter: setDepositoCantidadQQ,
      type: "Float",
      required: true,
      readOnly: true,
      error: errors["Quintales Oro"],
    },
    {
      label: "Retención",
      value: depositoRetencion,
      setter: setDepositoRetencion,
      type: "Float",
      required: true,
      readOnly: true,
      error: errors["Retención"],
    },
    {
      label: "Descripción",
      value: depositoDescripcion,
      setter: setDepositoDescripcion,
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
          subtitle={cliente?.label}
          notifications={notifications}
          actions={[
            {
              tooltip: "Ir a Registro",
              icon: <SolutionOutlined />,
              onClick: () =>
                router.push("/private/page/informe/registrodeposito"),
            },
          ]}
        />

        <Formulario
          title="Registrar Depósito"
          fields={fields}
          onSubmit={handleRegistrarClick}
          submitting={submitting}
          button={{
            text: "Registrar Depósito",
            onClick: handleRegistrarClick,
            type: "primary",
          }}
        />
        <PreviewModal
          open={previewVisible}
          title="Previsualización del Depósito"
          onCancel={() => setPreviewVisible(false)}
          onConfirm={handleConfirmar}
          confirmLoading={submitting}
          fields={fields.map((f) => ({
            label: f.label,
            value:
              f.type === "select"
                ? f.options?.find((o) => o.value === f.value?.value)?.label
                : f.value ||
                  (f.label === "Total Sacos"
                    ? 0
                    : f.label === "Depósito en"
                    ? "Depósito"
                    : "-"),
          }))}
        />
      </>
    </ProtectedPage>
  );
}
