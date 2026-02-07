"use client";
import { useEffect, useState, useRef } from "react";
import { message } from "antd";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import {
  obtenerProductosSelect,
  obtenerSelectData,
  verificarAnticiposPendientes,
  verificarClientesPendientesContratos,
  verificarPrestamosPendientes,
} from "@/lib/consultas";
import ProtectedPage from "@/components/ProtectedPage";
import {
  limpiarFormulario,
  validarFloatPositivo,
} from "@/config/validacionesForm";
import { validarDatos } from "@/lib/validacionesForm";
import { exportLiquidacionDeposito } from "@/Doc/Documentos/liqDepositp";
import { FloatingButton } from "@/components/Button";
import { UnorderedListOutlined, SolutionOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import NotificationDrawer from "@/components/NotificationDrawer";
import FloatingNotificationButton from "@/components/FloatingNotificationButton";
export default function DepositoForm() {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [formState, setFormState] = useState({
    cliente: null,
    producto: null,
    depositoEn: "",
    depositoCantidadQQ: "",
    depositoPrecioQQ: "",
    depositoTipoDocumento: "",
    depositoDescripcion: "",
    saldoPendiente: 0,
  });
  const [drawerVisible, setDrawerVisible] = useState(false); // control de drawer
  const [notifications, setNotifications] = useState([]); // notificaciones
  const router = useRouter();

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const messageRef = useRef(messageApi);
  const [previewVisible, setPreviewVisible] = useState(false);
  const { cliente, producto } = formState;

  const handleChange = (key, value) =>
    setFormState((prev) => ({ ...prev, [key]: value }));

  const totalLiquidacion = (
    parseFloat(formState.depositoCantidadQQ || 0) *
    parseFloat(formState.depositoPrecioQQ || 0)
  ).toFixed(2);
  useEffect(() => {
    async function cargarNotificaciones() {
      setNotifications([]); // limpiar notificaciones si cambia el cliente

      if (!formState.cliente || !formState.cliente.value) return;

      const mensajesContratos = await verificarClientesPendientesContratos(
        formState.cliente.value
      );

      const mensajesPrestamos = await verificarPrestamosPendientes(
        formState.cliente.value
      );
      const mensajesAnticipos = await verificarAnticiposPendientes(
        formState.cliente.value
      );

      setNotifications([
        ...mensajesContratos,

        ...mensajesPrestamos,
        ...mensajesAnticipos,
      ]);
    }

    cargarNotificaciones();
  }, [formState.cliente]);

  // ------------------------------
  // Cargar clientes
  // ------------------------------
  const cargarClientes = async () => {
    try {
      const data = await obtenerSelectData({
        url: "/api/liqDeposito/clienteConDeposito",
        messageApi: messageRef.current,
        valueField: "clienteID",
        labelField: "clienteNombreCompleto",
      });
      setClientes(data);
    } catch (err) {
      console.error(err);
      messageRef.current.error("Error cargando clientes");
    }
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  // ------------------------------
  // 2️⃣ Filtrar productos según cliente y saldo
  // ------------------------------

  useEffect(() => {
    async function cargarProductosConSaldo() {
      setProductos([]);
      handleChange("producto", null);
      handleChange("saldoPendiente", 0);
      handleChange("depositoCantidadQQ", "");
      handleChange("depositoPrecioQQ", "");
      if (!cliente) return;

      try {
        // Traer todos los productos para obtener el label
        const todosProductos = await obtenerProductosSelect(messageRef.current);

        // Traer cafés con saldo > 0 para el cliente
        const res = await fetch(`/api/liqDeposito?clienteID=${cliente.value}`);
        const dataSaldo = await res.json(); // [{ tipoCafe, saldoPendiente }, ...]

        const productosConSaldo = dataSaldo
          .filter((p) => p.saldoPendiente > 0)
          .map((p) => {
            const prodInfo = todosProductos.find(
              (prod) => prod.value === p.tipoCafe
            );
            return {
              value: p.tipoCafe,
              label: prodInfo?.label || `Café ${p.tipoCafe}`,
              saldoDisponible: p.saldoPendiente,
            };
          });

        setProductos(productosConSaldo);

        if (productosConSaldo.length === 0) {
          messageRef.current.warning(
            "El cliente no tiene saldo disponible en ningún café."
          );
        }

        // Limpiar producto y saldo si ya no tiene saldo
        if (!productosConSaldo.some((p) => p.value === producto?.value)) {
          handleChange("producto", null);
          handleChange("saldoPendiente", 0);
        }
      } catch (err) {
        console.error(err);
        messageRef.current.error("Error cargando productos o saldo");
        // Limpiar todo si hay error
        setProductos([]);
        handleChange("producto", null);
        handleChange("saldoPendiente", 0);
        handleChange("depositoCantidadQQ", "");
        handleChange("depositoPrecioQQ", "");
        handleChange("depositoDescripcion", "");
        handleChange("depositoTipoDocumento", "");
        handleChange("depositoEn", "");
      }
    }

    cargarProductosConSaldo();
  }, [cliente]);

  // ------------------------------
  // Actualiza saldo pendiente
  // ------------------------------

  useEffect(() => {
    async function fetchSaldoProducto() {
      if (!cliente || !producto) {
        handleChange("saldoPendiente", 0);
        handleChange("depositoCantidadQQ", "");
        handleChange("depositoPrecioQQ", "");
        return;
      }

      try {
        const resSaldoProducto = await fetch(
          `/api/liqDeposito?clienteID=${cliente.value}&tipoCafe=${producto.value}`
        );
        const saldoData = await resSaldoProducto.json();
        const saldo = saldoData.saldoDisponible || 0;
        handleChange("saldoPendiente", saldo);

        if (saldo <= 0) {
          handleChange("depositoCantidadQQ", "");
          handleChange("depositoPrecioQQ", "");
          messageRef.current.warning(
            "El cliente no tiene saldo disponible en este café."
          );
        }
      } catch {
        handleChange("saldoPendiente", 0);
        handleChange("depositoCantidadQQ", "");
        handleChange("depositoPrecioQQ", "");
      }
    }

    fetchSaldoProducto();
  }, [producto]);

  // ------------------------------
  // Mostrar modal de previsualización
  // ------------------------------
  const handleRegistrarClick = () => {
    if (validarDatos(fields, messageApi, setErrors)) setPreviewVisible(true);
  };

  // ------------------------------
  // Confirmar registro de la liquidación
  // ------------------------------
  const handleConfirmar = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    // Validación: cantidad no puede superar saldo
    if (Number(formState.depositoCantidadQQ) > formState.saldoPendiente) {
      messageApi.error("La cantidad supera el saldo disponible del cliente.");
      setSubmitting(false);
      return;
    }

    const data = {
      clienteID: formState.cliente.value,
      tipoCafe: formState.producto.value,
      cantidadQQ: parseFloat(formState.depositoCantidadQQ),
      precioQQ: parseFloat(formState.depositoPrecioQQ),
      total: parseFloat(totalLiquidacion),
      tipoDocumento: formState.depositoTipoDocumento || "N/A",
      descripcion: formState.depositoDescripcion || "N/A",
      liqEn: formState.depositoEn || "Liquidación Depósito",
    };


    try {
      const res = await fetch("/api/liqDeposito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();

        messageApi.success(
          `Liquidación registrada. Saldo restante: ${result.saldoDespues}`
        );
        setPreviewVisible(false);
        // 🔹 Cargar depósitos pendientes para el comprobante
        // 🔹 Generar PDF automáticamente
        messageApi.open({
          type: "loading",
          content: "Generando comprobante de liquidación, por favor espere...",
          duration: 0,
          key: "generandoComprobante",
        });
        try {
          await exportLiquidacionDeposito({
            cliente: formState.cliente,
            tipoCafe: formState.producto.label,
            saldoDisponible: formState.saldoPendiente,
            cantidadLiquidar: parseFloat(formState.depositoCantidadQQ),
            precio: parseFloat(formState.depositoPrecioQQ),
            totalPagar: parseFloat(totalLiquidacion),
            descripcion: formState.depositoDescripcion,
            saldoPendiente: result.saldoDespues,
            comprobanteID: result.liqID,
          });
          messageApi.destroy("generandoComprobante");
          messageApi.success("Comprobante generado correctamente");
        } catch (err) {
          console.error("Error generando PDF:", err);
          messageApi.destroy("generandoComprobante");
          messageApi.error("Error generando comprobante PDF");
        }

        limpiarFormulario({
          ...Object.fromEntries(
            Object.keys(formState).map((k) => [
              `set${k[0].toUpperCase() + k.slice(1)}`,
              (v) => handleChange(k, v),
            ])
          ),
        });
        await cargarClientes();
      } else {
        const err = await res.json();
        messageApi.error(err.error || "No se pudo registrar la liquidación");
      }
    } catch {
      messageApi.error("Error enviando los datos");
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------
  // Configuración dinámica de campos
  // ------------------------------
  const fieldsConfig = [
    {
      key: "cliente",
      label: "Cliente",
      type: "select",
      options: clientes,
      required: true,
      validator: (v) => (!!v ? null : "Seleccione un cliente"),
    },
    {
      key: "producto",
      label: "Tipo de Café",
      type: "select",
      options: cliente ? productos : [], // solo mostrar si hay cliente
      required: true,
      validator: (v) => (!!v ? null : "Seleccione un café"),
      disabled: !cliente, // deshabilitar si no hay cliente
    },
    {
      key: "depositoCantidadQQ",
      label: "Cantidad a liquidar (QOro)",
      type: "Float",
      required: true,
      validator: (v) => {
        if (validarFloatPositivo(v)) return "Debe ser un número mayor a 0";
        if (Number(v) > formState.saldoPendiente)
          return "No puede ser mayor al saldo disponible";
        return null;
      },
      // Deshabilitar si saldo es 0
      disabled: formState.saldoPendiente <= 0,
    },
    {
      key: "depositoPrecioQQ",
      label: "Precio (Lps)",
      type: "Float",
      required: true,
      validator: validarFloatPositivo,
      // Deshabilitar si saldo es 0
      disabled: formState.saldoPendiente <= 0,
    },
    {
      key: "saldoPendiente",
      label: "Saldo Disponible (QOro)",
      type: "Float",
      readOnly: true,
    },

    {
      key: "totalLiquidacion",
      label: "Total a pagar (Lps)",
      type: "Float",
      readOnly: true,
      value: totalLiquidacion,
    },
    { key: "depositoDescripcion", label: "Descripción", type: "textarea" },
  ];

  // Mapear configuración a campos con estado y errores
  const fields = fieldsConfig.map((f) => ({
    ...f,
    value: f.key === "totalLiquidacion" ? totalLiquidacion : formState[f.key],
    setter:
      f.key !== "totalLiquidacion" ? (v) => handleChange(f.key, v) : () => {},
    error: errors[f.label] || null,
  }));

  // ------------------------------
  // Renderizado del formulario y modal de previsualización
  // ------------------------------
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
          subtitle={formState.cliente?.label}
          notifications={notifications}
          actions={[
            {
              tooltip: "Ir a Registro",
              icon: <SolutionOutlined />,
              onClick: () =>
                router.push(
                  "/private/page/transacciones/deposito/lipdedeposito"
                ),
            },
          ]}
        />

        <Formulario
          key={cliente?.value || "empty"}
          title="Liquidar Depósito"
          fields={fields}
          onSubmit={handleRegistrarClick}
          submitting={submitting}
          button={{
            text: "Registrar Liquidación",
            onClick: handleRegistrarClick,
            type: "primary",
            disabled: formState.saldoPendiente <= 0 || submitting,
          }}
        />
        <PreviewModal
          open={previewVisible}
          title="Previsualización de la liquidación"
          onCancel={() => setPreviewVisible(false)}
          onConfirm={handleConfirmar}
          confirmLoading={submitting}
          fields={fields.map((f) => ({
            label: f.label,
            value:
              f.type === "select"
                ? f.options?.find((o) => o.value === f.value?.value)?.label
                : f.value || "-",
          }))}
        />
      </>
    </ProtectedPage>
  );
}
