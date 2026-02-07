"use client"; // Indica que este archivo se ejecuta en el cliente (Next.js)

import { useEffect, useState } from "react"; // Hooks de React
import { message, Spin, Button } from "antd"; // Componente de mensajes de Ant Design
import Formulario from "@/components/Formulario"; // Componente genérico de formulario
import PreviewModal from "@/components/Modal"; // Modal para previsualización
import { obtenerClientesSelect, obtenerProductosSelect } from "@/lib/consultas"; // Funciones para traer clientes/productos
import {
  limpiarFormulario,
  validarFloatPositivo,
} from "@/config/validacionesForm"; // Utilidades de validación
import { validarDatos } from "@/lib/validacionesForm"; // Validación general del formulario

import { SolutionOutlined } from "@ant-design/icons";
import { exportContratoCafe } from "@/Doc/Documentos/contrato";
import ProtectedPage from "@/components/ProtectedPage";
import NotificationDrawer from "@/components/NotificationDrawer";
import FloatingNotificationButton from "@/components/FloatingNotificationButton";
import {
  verificarClientesPendientesContratos,
  verificarDepositosPendientes,
  verificarPrestamosPendientes,
  verificarAnticiposPendientes,
} from "@/lib/consultas";
import { useRouter } from "next/navigation";

export default function ContratoForm({ contratoID }) {
  // 🔹 Estados de datos seleccionables
  const [clientes, setClientes] = useState([]); // Lista de clientes para el select
  const [productos, setProductos] = useState([]); // Lista de productos para el select
  const [drawerVisible, setDrawerVisible] = useState(false); // control de drawer
  const [notifications, setNotifications] = useState([]); // notificaciones
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // 🔹 Estado centralizado del formulario
  const [formState, setFormState] = useState({
    cliente: null,
    producto: null,
    contratoPrecio: "",
    contratoCantidadQQ: "",
    contratoRetencion: "",
    contratoTotalLps: 0,
    contratoEn: "",
    contratoDescripcion: "",
  });
  // 🔹 Estado para errores de validación
  const [errors, setErrors] = useState({});

  // 🔹 Estado para mostrar modal de previsualización
  const [previewVisible, setPreviewVisible] = useState(false);

  // 🔹 Estado para mostrar carga durante envío
  const [submitting, setSubmitting] = useState(false);

  // 🔹 API de mensajes de Ant Design
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    async function cargarNotificaciones() {
      setNotifications([]); // limpiar notificaciones si cambia el cliente

      if (!formState.cliente || !formState.cliente.value) return;

      const mensajesContratos = await verificarClientesPendientesContratos(
        formState.cliente.value
      );
      const mensajesDepositos = await verificarDepositosPendientes(
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
        ...mensajesDepositos,
        ...mensajesPrestamos,
        ...mensajesAnticipos,
      ]);
    }

    cargarNotificaciones();
  }, [formState.cliente]);

  // 🔹 useEffect para calcular automáticamente el total (precio x cantidad)
  useEffect(() => {
    const precio = parseFloat(formState.contratoPrecio);
    const cantidad = parseFloat(formState.contratoCantidadQQ);
    // 🔹 Calcular retención automática, ejemplo 5%
    const retencion = cantidad - (cantidad * 0.04).toFixed(2);
    setFormState((prev) => ({
      ...prev,
      // Si los valores no son números, el total será 0
      contratoTotalLps:
        !isNaN(precio) && !isNaN(cantidad) ? (precio * cantidad).toFixed(2) : 0,
      contratoRetencion: retencion,
    }));
  }, [formState.contratoPrecio, formState.contratoCantidadQQ]); // Se ejecuta cuando cambian precio o cantidad

  // 🔹 useEffect para cargar clientes y productos desde la API
  useEffect(() => {
    async function cargarDatos() {
      setLoadingData(true);
      try {
        setClientes(await obtenerClientesSelect(messageApi)); // Trae clientes
        setProductos(await obtenerProductosSelect(messageApi)); // Trae productos
      } catch (err) {
        console.error(err);
        messageApi.error("Error cargando clientes o productos"); // Mensaje de error
      } finally {
        setLoadingData(false);
      }
    }
    cargarDatos();
  }, [messageApi]); // Solo se ejecuta una vez al montar

  // 🔹 Configuración dinámica de campos del formulario
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
      options: productos,
      required: true,
      validator: (v) => (!!v ? null : "Seleccione un café"),
    },
    {
      key: "contratoCantidadQQ",
      label: "Cantidad (QOro)",
      type: "Float",
      required: true,
      validator: validarFloatPositivo,
    },
    {
      key: "contratoPrecio",
      label: "Precio (Lps)",
      type: "Float",
      required: true,
      validator: validarFloatPositivo,
    },

    {
      key: "contratoTotalLps",
      label: "Total (Lps)",
      type: "Float",
      required: true,
      readOnly: true,
    },
    {
      key: "contratoRetencion",
      label: "Retención (QOro)",
      type: "Float",
      required: true,
      readOnly: true,
      error: errors["Retención"],
    },
    {
      key: "contratoDescripcion",
      label: "Descripción",
      type: "textarea",
      required: false,
    },
  ];

  // 🔹 Mapear configuración a campos completos con setters y errores
  const fields = fieldsConfig.map((f) => ({
    ...f,
    value: formState[f.key], // Valor actual del estado
    setter: (val) => setFormState((prev) => ({ ...prev, [f.key]: val })), // Setter dinámico
    error: errors[f.label], // Error correspondiente al campo
  }));

  // 🔹 Función para manejar clic en "Registrar Contrato"
  const handleRegistrarClick = () => {
    // Valida datos antes de abrir previsualización
    if (validarDatos(fields, messageApi, setErrors)) setPreviewVisible(true);
  };

  // 🔹 Función para confirmar registro de contrato
  const handleConfirmar = async (e) => {
    e.preventDefault(); // Evita reload del formulario
    setSubmitting(true); // Muestra estado de envío

    // 🔹 Construcción de objeto a enviar
    const data = {
      contratoclienteID: formState.cliente?.value,
      contratoTipoCafe: formState.producto?.value,
      contratoPrecio: parseFloat(formState.contratoPrecio),
      contratoCantidadQQ: parseFloat(formState.contratoCantidadQQ),
      contratoRetencion: parseFloat(formState.contratoRetencion) || 0,
      contratoTotalLps: parseFloat(formState.contratoTotalLps),
      contratoEn: formState.contratoEn || "Contrato Directo",
      contratoDescripcion: formState.contratoDescripcion || "N/A",
    };

    try {
      // 🔹 Petición POST al endpoint
      // 🔹 Aquí decidimos la URL y método según si es creación o edición
      const url = contratoID
        ? `/api/contratos/${contratoID}`
        : "/api/contratos";

      const method = contratoID ? "PUT" : "POST";
      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok || !result.contratoID) {
        return messageApi.open({
          duration: 6,
          content: (
            <div>
              <b>{result.error || "No se pudo registrar el contrato"}</b>
              <br />
              <Button
                type="primary"
                size="small"
                style={{ marginTop: 6 }}
                onClick={() =>
                  router.push(
                    "/private/page/transacciones/contrato/detallecontrato"
                  )
                }
              >
                Ver Contratos
              </Button>
            </div>
          ),
        });
      }

      messageApi.success(
        contratoID
          ? "Contrato actualizado exitosamente"
          : "Contrato registrado exitosamente"
      );

      setPreviewVisible(false);
      // 🔹 Generar y descargar PDF del contrato

      // 🔹 Mostrar loading de generación de PDF
      messageApi.open({
        type: "loading",
        content: "Generando contrato, por favor espere...",
        duration: 0, // dura hasta que lo cerremos manualmente
        key: "generandoContrato",
      });

      try {
        await exportContratoCafe({
          ...formState,
          contratoID: result.contratoID,
        });
        // Cierra el mensaje de loading
        messageApi.destroy("generandoContrato");
        messageApi.success("PDF generado correctamente");
      } catch (err) {
        console.error("Error generando PDF:", err);
        messageApi.destroy("generandoContrato");
        messageApi.error("Error generando documento PDF");
      }

      // 🔹 Limpieza del formulario
      limpiarFormulario(
        Object.fromEntries(fieldsConfig.map((f) => [f.key, formState[f.key]]))
      );
      setFormState({
        cliente: null,
        producto: null,
        contratoPrecio: "",
        contratoCantidadQQ: "",
        contratoTotalLps: "",
        contratoEn: "",
        contratoDescripcion: "",
        contratoRetencion: 0,
      });
    } catch (error) {
      console.error(error);
      messageApi.error(error.message || "Ocurrió un error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    // Esperar hasta que se carguen clientes y productos
    if (!contratoID || loadingData) return;

    const cargarContrato = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/contratos/${contratoID}`);
        const data = await res.json();

        if (!res.ok)
          throw new Error(data.error || "Error cargando el contrato");

        // Buscar cliente y producto en los selects
        const clienteSeleccionado = clientes.find(
          (c) => c.value === data.clienteID
        ) || {
          value: data.cliente?.clienteID ?? "nuevo", // si no hay ID, ponemos "nuevo" o algo único
          label: data.cliente?.clienteNombre || "Sin nombre",
        };

        const productoSeleccionado = productos.find(
          (p) => p.value === data.contratoTipoCafe
        ) || {
          value: data.contratoTipoCafe,
          label: data.producto?.productName || "Sin nombre",
        };

        // Actualizar formState
        setFormState((prev) => ({
          ...prev,
          cliente: clienteSeleccionado,
          producto: productoSeleccionado,
          contratoPrecio: data.contratoPrecio?.toString() || "",
          contratoCantidadQQ: data.contratoCantidadQQ?.toString() || "",
          contratoRetencion: data.contratoRetencionQQ?.toString() || "0",
          contratoTotalLps: data.contratoTotalLps?.toString() || "0",
          contratoEn: data.contratoEn || "Contrato Directo",
          contratoDescripcion: data.contratoDescripcion || "",
        }));
      } catch (err) {
        console.error(err);
        messageApi.error("No se pudo cargar el contrato");
      } finally {
        setLoading(false);
      }
    };

    cargarContrato();
  }, [contratoID, loadingData]);

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS"]}>
      <>
        {contextHolder} {/* Contenedor de mensajes Ant Design */}
        {loading || loadingData ? (
          <div
            style={{
              minHeight: "16rem",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Spin size="large" />
          </div>
        ) : (
          <>
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
                      "/private/page/transacciones/contrato/registrocontrato"
                    ),
                },
              ]}
            />
            {/* Componente de formulario principal */}
            <Formulario
              key={formState.cliente?.value || "empty"}
              title={contratoID ? "Editar Contrato" : "Registrar Contrato"}
              fields={fields}
              onSubmit={handleRegistrarClick}
              submitting={submitting}
              button={{
                text: contratoID ? "Actualizar Contrato" : "Registrar Contrato",
                onClick: handleRegistrarClick,
                type: "primary",
              }}
            />
            {/* Modal de previsualización antes de confirmar */}
            <PreviewModal
              open={previewVisible}
              title="Previsualización del contrato"
              onCancel={() => setPreviewVisible(false)}
              onConfirm={handleConfirmar}
              confirmLoading={submitting}
              fields={fields.map((f) => ({
                label: f.label,
                value:
                  f.type === "select"
                    ? f.options?.find((o) => o.value === f.value?.value)?.label
                    : f.value ||
                      (f.label === "Contrato en" ? "Contrato Directo" : "-"),
              }))}
            />
          </>
        )}
      </>
    </ProtectedPage>
  );
}
