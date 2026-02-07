"use client";
import { useEffect, useState, useRef } from "react";
import { message } from "antd";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import { limpiarFormulario } from "@/config/validacionesForm";
import { validarDatos } from "@/lib/validacionesForm";
import { exportEntregaContratoSalida } from "@/Doc/Documentos/entregaContratoSalida";
import ProtectedPage from "@/components/ProtectedPage";
import { SolutionOutlined } from "@ant-design/icons";
import NotificationDrawer from "@/components/NotificationDrawer";
import FloatingNotificationButton from "@/components/FloatingNotificationButton";
import {
  obtenerCompradoresPendientesContratos,
  obtenerProductosSelect,
  obtenerSaldoContratoSalida,
  obtenerContratosSalidaPendientes,
  obtenerSalidasPendientes,
} from "@/lib/consultas";
import { validarEnteroPositivo } from "@/config/validacionesForm";
import {
  calcularCafeDesdeProducto,
  calcularPesoBrutoDesdeOro,
} from "@/lib/calculoCafe";
import { truncarDosDecimalesSinRedondear } from "@/lib/calculoCafe";
import { useRouter } from "next/navigation";
// Duplicate import removed

export default function LiquidacionContratoForm() {
  const [clientes, setClientes] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false); // control de drawer
  const [notifications, setNotifications] = useState([]); // notificaciones
  const router = useRouter();

  const [formState, setFormState] = useState({
    cliente: null,
    contrato: null,
    tipoCafeID: "",
    tipoCafeNombre: "",
    saldoDisponibleQQ: "",
    saldoDisponibleLps: "",
    precioQQ: "",
    cantidadLiquidar: "",
    totalSacos: "",
    totalLiquidacion: "0.00",
    oro: "0.00",
    producto: null,
    descripcion: "",
    pesoBrutoContrato: "0.00",
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const messageRef = useRef(messageApi);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    // Notifications logic removed for Compradores as requested/not implemented yet
  }, [formState.cliente]);

  useEffect(() => {
    async function cargarNotificaciones() {
      setNotifications([]);
      if (!formState.cliente || !formState.cliente.value) return;

      try {
        const data = await obtenerSalidasPendientes(formState.cliente.value);

        const mensajes = [];
        if (data.cantidadPendiente > 0) {
          mensajes.push(
            `Salidas pendientes: ${Number(data.cantidadPendiente).toFixed(
              2
            )} QQ`
          );
        }

        if (mensajes.length === 0) mensajes.push("No hay pendientes.");
        setNotifications(mensajes);
      } catch (err) {
        console.error(err);
      }
    }
    cargarNotificaciones();
  }, [formState.cliente]);

  const handleChange = (key, value) =>
    setFormState((prev) => ({ ...prev, [key]: value }));

  const { contrato, cliente } = formState;

  // ------------------------------
  // Cargar clientes y productos
  // ------------------------------

  const cargarClientes = async () => {
    try {
      const clientesData = await obtenerCompradoresPendientesContratos(
        messageApi
      );
      setClientes(clientesData);
    } catch (err) {
      console.error(err);
      messageApi.error("⚠️ Error cargando compradores.");
    }
  };
  const cargarProductos = async () => {
    try {
      const productosData = await obtenerProductosSelect(messageApi);
      setProductos(productosData);
    } catch (err) {
      console.error(err);
      messageApi.error("⚠️ Error cargando productos.");
    }
  };
  // Inicial cargar clientes y productos
  useEffect(() => {
    cargarClientes();
    cargarProductos();
  }, []);

  // ------------------------------
  // Cargar contratos pendientes al cambiar cliente
  // ------------------------------
  useEffect(() => {
    async function cargar() {
      if (cliente) {
        const contratosData = await obtenerContratosSalidaPendientes(
          cliente.value
        );
        setContratos(contratosData);
        setFormState((prev) => ({
          ...prev,
          contrato: null,
          totalSacos: "",
          cantidadLiquidar: "",
        }));
        if (!contratosData || contratosData.length === 0) {
          messageRef.current.warning(
            "El comprador no tiene contratos pendientes disponibles."
          );
        }
      } else {
        setContratos([]);
        setFormState((prev) => ({
          ...prev,
          contrato: null,
          totalSacos: "",
          cantidadLiquidar: "",
        }));
      }
    }

    cargar();
  }, [cliente]);

  // ------------------------------
  // Cargar saldo al cambiar contrato
  // ------------------------------
  useEffect(() => {
    async function cargar() {
      if (!contrato) {
        setFormState((prev) => ({
          ...prev,
          cantidadLiquidar: "",
          saldoDisponibleQQ: 0,
          saldoDisponibleLps: 0,
          tipoCafeID: 0,
          tipoCafeNombre: "",
          precioQQ: 0,
          totalLiquidacion: "0.00",
          totalSacos: "",
          oro: "0.00",
          pesoBrutoContrato: "0.00",
          producto: null,
        }));
        return;
      }

      const saldoData = await obtenerSaldoContratoSalida(contrato.value);

      if (!saldoData) {
        messageRef.current.error(
          "No se encontró saldo disponible para este contrato"
        );
        return;
      }
      saldoData.saldoDisponibleQQ = truncarDosDecimalesSinRedondear(
        saldoData.saldoDisponibleQQ
      );
      saldoData.saldoDisponibleLps = truncarDosDecimalesSinRedondear(
        saldoData.saldoDisponibleLps
      );

      // buscar el producto asociado al tipo de café
      const productoSeleccionado = productos.find(
        (p) => p.value === saldoData.tipoCafeID
      );
      // 🔹 Determinar si el producto requiere sacos
      const usaSacos = productoSeleccionado?.data?.tara > 0;

      // calcular peso bruto necesario con saldo disponible (oro)
      const { pesoBruto } = calcularPesoBrutoDesdeOro(
        saldoData.saldoDisponibleQQ,
        usaSacos ? saldoData.totalSacos || 0 : 0,
        productoSeleccionado
      );

      setFormState((prev) => ({
        ...prev,
        ...saldoData,
        producto: productoSeleccionado || null,
        pesoBrutoContrato: pesoBruto,
        totalSacos: "",
        cantidadLiquidar: "",
      }));
    }

    cargar();
  }, [contrato, productos]);

  // ------------------------------
  // Recalcular valores cuando cambia cantidad/precio
  // ------------------------------
  useEffect(() => {
    if (!formState.producto) return;

    const { oro } = calcularCafeDesdeProducto(
      formState.cantidadLiquidar, // peso bruto → oro
      formState.totalSacos,
      formState.producto
    );

    const oroFix = truncarDosDecimalesSinRedondear(oro);

    const total = oroFix * parseFloat(formState.precioQQ || 0);

    setFormState((prev) => ({
      ...prev,
      oro: oroFix,
      totalLiquidacion: truncarDosDecimalesSinRedondear(total),
    }));
  }, [
    formState.cantidadLiquidar,
    formState.precioQQ,
    formState.totalSacos,
    formState.producto,
  ]);

  // ------------------------------
  // Abrir modal de previsualización
  // ------------------------------
  const handleRegistrarClick = () => {
    if (validarDatos(fields, messageApi, setErrors)) setPreviewVisible(true);
  };

  // ------------------------------
  // Confirmar envío
  // ------------------------------
  const handleConfirmar = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const oro = truncarDosDecimalesSinRedondear(formState.oro);
    const saldo = truncarDosDecimalesSinRedondear(formState.saldoDisponibleQQ);

    if (oro > saldo) {
      messageApi.error(
        `La cantidad (${oro}) supera el saldo disponible (${saldo})`
      );
      setSubmitting(false);
      return;
    }

    const data = {
      contratoID: contrato.value,
      clienteID: cliente.value,
      tipoCafe: formState.tipoCafeID,
      cantidadQQ: truncarDosDecimalesSinRedondear(formState.oro),
      precioQQ: formState.precioQQ,
      totalSacos: parseInt(formState.totalSacos),
      descripcion: formState.descripcion,
    };

    try {
      const res = await fetch("/api/contratoSalida/entregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        messageApi.success(
          `Liquidación registrada. Saldo disponible: ${truncarDosDecimalesSinRedondear(
            result.saldoDespuesQQ
          )} QQ / ${truncarDosDecimalesSinRedondear(
            result.saldoDespuesLps
          )} Lps`
        );
        setPreviewVisible(false);
        messageApi.open({
          type: "loading",
          content: "Generando comprobante de liquidación, por favor espere...",
          duration: 0,
          key: "generandoComprobante",
        });
        try {
          await exportEntregaContratoSalida({
            cliente: formState.cliente,
            contratoID: data.contratoID,
            comprobanteID: result.detalleEntregaID, // ID del detalle
            pesoBruto: parseFloat(formState.pesoBrutoContrato),
            totalSacos: formState.totalSacos,
            tipoCafe: formState.producto.label,
            quintalesDisponibles: result.saldoAntesQQ,
            quintalesIngresados: parseFloat(formState.oro),
            precio: parseFloat(formState.precioQQ),
            totalPagar: parseFloat(formState.totalLiquidacion),
            saldoRestanteQQ: result.saldoDespuesQQ,
            saldoRestanteLps: result.saldoDespuesLps,
            formaPago: formState.formaPago,
            observaciones: formState.descripcion,
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
        messageApi.error(result.error || "No se pudo registrar la liquidación");
      }
    } catch {
      messageApi.error("Error enviando los datos");
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------
  // Recalcular peso bruto necesario al cambiar total de sacos
  // ------------------------------
  useEffect(() => {
    if (!formState.producto) return;

    const sacos = parseFloat(formState.totalSacos || 0);
    const usaSacos = formState.producto?.data?.tara > 0;

    if (usaSacos) {
      if (sacos > 0) {
        const { pesoBruto } = calcularPesoBrutoDesdeOro(
          formState.saldoDisponibleQQ, // quintales oro del contrato
          sacos, // cantidad de sacos que ingresó el usuario
          formState.producto
        );

        setFormState((prev) => ({
          ...prev,
          pesoBrutoContrato: pesoBruto,
        }));
      } else {
        setFormState((prev) => ({
          ...prev,
          pesoBrutoContrato: "0.00",
        }));
      }
    } else {
      // 🔹 Si no requiere sacos, pasar 0 siempre
      const { pesoBruto } = calcularPesoBrutoDesdeOro(
        formState.saldoDisponibleQQ,
        0,
        formState.producto
      );
      setFormState((prev) => ({ ...prev, pesoBrutoContrato: pesoBruto }));
    }
  }, [
    formState.saldoDisponibleQQ,
    formState.totalSacos,
    formState.producto,
    formState.tipoCafeNombre,
  ]);

  // ------------------------------
  // Configuración de campos
  // ------------------------------
  const fieldsConfig = [
    {
      key: "cliente",
      label: "Comprador",
      type: "select",
      options: clientes,
      required: true,
      validator: (v) => (!!v ? null : "Seleccione un comprador"),
    },
    {
      key: "contrato",
      label: "Contrato Pendiente",
      type: "select",
      options: contratos,
      required: true,
      validator: (v) => (!!v ? null : "Seleccione un contrato"),
    },
    {
      key: "cantidadLiquidar",
      label:
        formState.tipoCafeNombre === "Cafe Lata"
          ? "Cantidad de Latas"
          : "Peso Bruto (lbs)",
      type: "Float",
      required: true,
      error: errors["Peso Bruto (lbs)"],
      readOnly:
        (!formState.totalSacos || formState.totalSacos <= 0) &&
        formState.tipoCafeNombre !== "Cafe Lata",
      validator: (v) => (v > 0 ? null : "Ingrese un peso válido"),
    },
    {
      key: "totalSacos",
      label: "Total de Sacos",
      tooltip:
        "Al ingresar los sacos se calcula automáticamente el peso bruto necesario",
      type: "integer",
      value: formState.totalSacos,
      error: errors["Total de Sacos"],
      readOnly: !(formState.producto?.data?.tara > 0), // 🔹 bloquear si no requiere sacos
      required: formState.producto?.data?.tara > 0, // 🔹 solo requerido si aplica
      validator: (v) => {
        if (!(formState.producto?.data?.tara > 0)) return null; // 🔹 sin validación si no se usa
        if (v === "" || v === null || v === undefined)
          return "Ingrese total de sacos";
        return validarEnteroPositivo(v) ? null : "Total de sacos debe ser >= 0";
      },
    },
    {
      key: "tipoCafeNombre",
      label: "Tipo de Café",
      type: "text",
      readOnly: true,
    },
    {
      key: "saldoDisponibleQQ",
      label: "Quintales Oro disponibles",
      type: "Float",
      readOnly: true,
    },
    {
      key: "pesoBrutoContrato",
      label:
        formState.tipoCafeNombre === "Cafe Lata"
          ? "Cantidad de Latas necesaria"
          : "Peso Bruto (lbs) necesaria",
      type: "Float",
      readOnly: true,
      value: formState.pesoBrutoContrato,
    },

    {
      key: "oro",
      label: "Quintales Oro Ingresados",
      type: "Float",
      readOnly: true,
      value: formState.oro,
    },

    {
      key: "precioQQ",
      label: "Precio (Lps)",
      type: "Float",
      readOnly: true,
    },
    {
      key: "totalLiquidacion",
      label: "Total a pagar (Lps)",
      type: "Float",
      readOnly: true,
      value: formState.totalLiquidacion,
    },
    {
      key: "saldoDisponibleLps",
      label: "Total del Contrato (Lps)",
      type: "Float",
      readOnly: true,
    },
    {
      key: "descripcion",
      label: "Descripción",
      type: "textarea",
      readOnly: false,
      value: formState.descripcion,
    },
  ];

  const fields = fieldsConfig.map((f) => ({
    ...f,
    value: formState[f.key],
    setter: f.readOnly ? () => {} : (v) => handleChange(f.key, v),
    error: errors[f.label] || null,
  }));

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
                  "/private/page/transacciones/contratoSalida/detallecontrato"
                ),
            },
          ]}
        />

        <Formulario
          key={formState.cliente?.value || "empty"}
          title="Entrega de Contrato"
          fields={fields}
          onSubmit={handleRegistrarClick}
          submitting={submitting}
          button={{
            text: "Registrar Entrega",
            onClick: handleRegistrarClick,
            type: "primary",
            disabled: submitting || formState.saldoDisponibleQQ <= 0,
          }}
        />
        <PreviewModal
          open={previewVisible}
          title="Previsualización de la liquidación"
          onCancel={() => setPreviewVisible(false)}
          onConfirm={handleConfirmar}
          confirmLoading={submitting}
          fields={fields
            .filter((f) =>
              [
                "Comprador",
                "Contrato Pendiente",
                "Peso Bruto (lbs)",
                "Total de Sacos",
                "Tipo de Café",
                "Quintales Oro Ingresados",
                "Precio (Lps)",
                "Total a pagar (Lps)",
                "Descripción",
              ].includes(f.label)
            )
            .map((f) => ({
              label: f.label,
              value:
                f.label === "Total Sacos" &&
                formState.tipoCafeNombre === "Cafe Lata"
                  ? 0
                  : f.type === "select"
                  ? f.options?.find((o) => o.value === f.value?.value)?.label
                  : f.value || "-",
            }))}
        />
      </>
    </ProtectedPage>
  );
}
