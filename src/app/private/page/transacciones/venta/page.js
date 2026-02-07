"use client";

import { useState, useEffect } from "react";
import { message, Spin } from "antd";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import { obtenerProductosSelect, obtenerSelectData } from "@/lib/consultas";
import { FloatingButton } from "@/components/Button";
import {
  calcularCafeDesdeProducto,
  calcularPesoBrutoDesdeOro,
} from "@/lib/calculoCafe";
import ProtectedPage from "@/components/ProtectedPage";
import {
  limpiarFormulario,
  validarEnteroNoNegativo,
  validarFloatPositivo,
} from "@/config/validacionesForm";
import { useRouter } from "next/navigation";
import { exportVentaDirecta } from "@/Doc/Documentos/venta";
import {
  UnorderedListOutlined,
  FileTextOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import NotificationDrawer from "@/components/NotificationDrawer";
import FloatingNotificationButton from "@/components/FloatingNotificationButton";
import {
  obtenerSalidasPendientes,
  verificarContratosSalidaPendientes,
} from "@/lib/consultas";

export default function VentaForm({ compraId }) {
  const [compradores, setCompradores] = useState([]);
  const [productos, setProductos] = useState([]);

  const [loadingDatos, setLoadingDatos] = useState(true); // 🔹 loading general
  const [loadingCompra, setLoadingCompra] = useState(false); // 🔹 loading para editar

  const [comprador, setComprador] = useState(null);
  const [producto, setProducto] = useState(null);
  const [ventaCantidadQQ, setVentaCantidadQQ] = useState("");
  const [ventaTotalSacos, setVentaTotalSacos] = useState("");
  const [ventaPrecioQQ, setVentaPrecioQQ] = useState("");
  const [ventaTotal, setVentaTotal] = useState(0);
  const [ventaOro, setVentaOro] = useState("0.00");
  const [ventaDescripcion, setVentaDescripcion] = useState("");
  const router = useRouter();
  const [errors, setErrors] = useState({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const [messageApi, contextHolder] = message.useMessage();

  // 🔹 Campos del formulario (debe ir antes de validarDatos)
  const fields = [
    {
      label: "Comprador",
      value: comprador,
      setter: setComprador,
      type: "select",
      options: compradores,
      required: true,
      error: errors["Comprador"],
      validator: (v) => (!!v ? null : "Seleccione un comprador"),
    },
    {
      label: "Tipo de Café",
      value: producto,
      setter: setProducto,
      type: "select",
      options: productos,
      required: true,
      error: errors["Tipo de Café"],
      validator: (v) => (!!v ? null : "Seleccione un café"),
    },
    {
      label:
        producto?.label === "Cafe Lata"
          ? "Cantidad de Latas"
          : "Peso Bruto (lbs)",
      value: ventaCantidadQQ,
      setter: setVentaCantidadQQ,
      type: "Float",
      required: true,
      error: errors["Peso Bruto (lbs)"] || errors["Cantidad de Latas"],
      validator: validarFloatPositivo,
    },
    {
      label: "Total Sacos",
      value:
        parseFloat(producto?.data?.tara || "0") === 0 ? 0 : ventaTotalSacos,
      setter:
        parseFloat(producto?.data?.tara || "0") === 0
          ? () => {}
          : setVentaTotalSacos,
      type: "integer",
      required: parseFloat(producto?.data?.tara || "0") !== 0,
      readOnly: parseFloat(producto?.data?.tara || "0") === 0,
      error: errors["Total Sacos"],
      validator: (v) => {
        if (parseFloat(producto?.data?.tara || "0") === 0) return null;
        if (v === "" || v === null || v === undefined)
          return "Ingrese total de sacos";
        return validarEnteroNoNegativo(v) ? null : "Total sacos debe ser >= 0";
      },
    },
    {
      label: "Precio (Lps)",
      value: ventaPrecioQQ,
      setter: setVentaPrecioQQ,
      type: "Float",
      required: true,
      error: errors["Precio (Lps)"],
      validator: validarFloatPositivo,
    },
    {
      label: "Total (Lps)",
      value: ventaTotal,
      setter: setVentaTotal,
      type: "Float",
      required: true,
      readOnly: true,
      error: errors["Total"],
    },
    {
      label: "Quintales Oro",
      value: ventaOro,
      setter: setVentaOro,
      type: "Float",
      required: true,
      readOnly: true,
      error: errors["Quintales Oro"],
    },
    {
      label: "Descripción",
      value: ventaDescripcion,
      setter: setVentaDescripcion,
      type: "textarea",
    },
  ];

  // 🔹 Cargar compradores y productos
  useEffect(() => {
    async function cargarDatos() {
      setLoadingDatos(true);
      try {
        const compradoresData = await obtenerSelectData({
          url: "/api/compradores",
          messageApi,
          valueField: "compradorId",
          labelField: "compradorNombre",
        });

        const productosData = await obtenerProductosSelect(messageApi);
        setCompradores(compradoresData);
        setProductos(productosData);
      } catch (err) {
        console.error(err);
        messageApi.error("Error cargando compradores o productos");
      } finally {
        setLoadingDatos(false);
      }
    }
    cargarDatos();
  }, [messageApi]);

  useEffect(() => {
    async function cargarNotificaciones() {
      setNotifications([]);
      if (!comprador?.value) return;

      try {
        const data = await obtenerSalidasPendientes(comprador.value);
        const contratos = await verificarContratosSalidaPendientes(
          comprador.value
        );

        const mensajes = [];
        if (data.cantidadPendiente > 0) {
          mensajes.push(
            `Salidas pendientes: ${Number(data.cantidadPendiente).toFixed(
              2
            )} QQ`
          );
        }
        if (contratos.length > 0) {
          mensajes.push(...contratos);
        }
        if (mensajes.length === 0) mensajes.push("No hay pendientes.");
        setNotifications(mensajes);
      } catch (err) {
        console.error(err);
      }
    }
    cargarNotificaciones();
  }, [comprador]);

  // 🔹 Cálculo de total y oro
  useEffect(() => {
    if (!producto) return;

    const resultado = calcularCafeDesdeProducto(
      ventaCantidadQQ,
      ventaTotalSacos,
      producto,
      ventaPrecioQQ
    );

    setVentaTotal(resultado.total);
    setVentaOro(resultado.oro);
  }, [ventaCantidadQQ, ventaTotalSacos, ventaPrecioQQ, producto]);

  // 🔹 Validación
  const validarDatos = () => {
    const newErrors = {};
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

  // 🔹 Confirmación de venta
  const handleConfirmar = async () => {
    setSubmitting(true);

    // 🔹 Preparar datos para enviar
    const data = {
      compradorID: Number(comprador?.value),
      compraTipoCafe: Number(producto?.value),
      compraCantidadQQ: Number(ventaOro) || 0,
      compraTotalSacos:
        parseFloat(producto?.data?.tara || "0") === 0
          ? 0
          : Number(ventaTotalSacos) || 0,
      compraPrecioQQ: Number(ventaPrecioQQ) || 0,
      compraTotal: Number(ventaTotal) || 0,
      compraDescripcion: ventaDescripcion || "",
      compraMovimiento: "Salida",
    };

    try {
      // 🔹 Enviar datos al servidor
      const url = compraId ? `/api/Venta/${compraId}` : "/api/Venta/";
      const method = compraId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      //

      const result = await res.json();

      // 🔹 Validar respuesta

      if (!res.ok)
        throw new Error(result.error || "Error al procesar la venta");

      messageApi.success(
        compraId
          ? "Venta actualizada correctamente"
          : "Venta registrada correctamente"
      );
      setPreviewVisible(false);

      // 🔹 Generación del comprobante (opcional)
      messageApi.open({
        type: "loading",
        content: "Generando comprobante de venta, por favor espere...",
        duration: 0,
        key: "generandoComprobante",
      });

      try {
        await exportVentaDirecta({
          comprador,
          productos: [
            {
              nombre: producto.label,
              cantidad: parseFloat(ventaOro),
              precio: parseFloat(ventaPrecioQQ),
              total: parseFloat(ventaTotal),
            },
          ],
          total: parseFloat(ventaTotal),
          observaciones: ventaDescripcion,
          comprobanteID: result.compraId,
        });
        messageApi.destroy("generandoComprobante");
        messageApi.success("Comprobante generado correctamente");
      } catch (err) {
        console.error("Error generando comprobante:", err);
        messageApi.destroy("generandoComprobante");
        messageApi.error("Error generando comprobante PDF");
      }

      // 🔹 Redirigir a la lista de compras
      if (compraId) {
        router.push("/private/page/transacciones/compra/vista"); // Ajusta según tu ruta real de lista
        return; // evita limpiar formulario si solo actualizas
      }

      // 🔹 Limpiar formulario
      limpiarFormulario({
        setComprador,
        setProducto,
        setVentaCantidadQQ,
        setVentaTotalSacos,
        setVentaPrecioQQ,
        setVentaTotal,
        setVentaOro,
        setVentaDescripcion,
        setErrors,
      });
    } catch (err) {
      console.error("Error enviando datos al servidor:", err);

      messageApi.error(err.message || "Error enviando datos al servidor");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!compraId || loadingDatos) return;
    const cargarVenta = async () => {
      setLoadingCompra(true);
      try {
        const res = await fetch(`/api/compras/${compraId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error cargando la venta");

        const compradorMatch = compradores.find(
          (c) => c.value === data.compradorID
        );
        const productoMatch = productos.find(
          (p) => p.value === data.compraTipoCafe
        );
        setComprador(
          compradorMatch || { value: data.compradorID, label: "Cargando..." }
        );
        setProducto(
          productoMatch || { value: data.compraTipoCafe, label: "Cargando..." }
        );
        setVentaCantidadQQ(data.compraCantidadQQ.toString());
        setVentaTotalSacos(data.compraTotalSacos.toString());
        setVentaPrecioQQ(data.compraPrecioQQ.toString());
        setVentaTotal(data.compraTotal);
        setVentaOro(data.compraCantidadQQ.toString());
        setVentaDescripcion(data.compraDescripcion || "");

        const pesoBruto = calcularPesoBrutoDesdeOro(
          data.compraCantidadQQ,
          data.compraTotalSacos,
          productoMatch
        );
        setVentaCantidadQQ(pesoBruto.pesoBruto);
      } catch (err) {
        console.error(err);
        messageApi.error("Error cargando la venta");
      } finally {
        setLoadingCompra(false);
      }
    };
    cargarVenta();
  }, [compraId, loadingDatos, compradores, productos, messageApi]);
  useEffect(() => {}, [compraId]);

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
              tooltip: "Ir a Salidas",
              icon: <FileTextOutlined />,
              onClick: () =>
                router.push("/private/page/transacciones/compra/vista"),
            },
            {
              tooltip: "Ir a Contratos",
              icon: <FileSearchOutlined />,
              onClick: () =>
                router.push(
                  "/private/page/transacciones/contratoSalida/registrocontrato"
                ),
            },
            {
              tooltip: "Ir a Confirmacion",
              icon: <FileTextOutlined />,
              onClick: () => router.push("/private/page/transacciones/salidas"),
            },
          ]}
        />
        {loadingDatos || loadingCompra ? (
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
            <Formulario
              title={
                compraId ? "Editar Venta Directa" : "Registrar Venta Directa"
              }
              fields={fields}
              onSubmit={handleRegistrarClick}
              submitting={submitting}
              button={{
                text: compraId ? "Actualizar Venta" : "Registrar Venta",
                onClick: handleRegistrarClick,
                type: "primary",
              }}
            />
            <PreviewModal
              open={previewVisible}
              title="Previsualización de la venta"
              onCancel={() => setPreviewVisible(false)}
              onConfirm={handleConfirmar}
              confirmLoading={submitting}
              fields={fields.map((f) => ({
                label: f.label,
                value:
                  f.label === "Total Sacos" && producto?.label === "Cafe Lata"
                    ? 0
                    : f.type === "select"
                    ? f.options?.find((o) => o.value === f.value?.value)?.label
                    : f.value || "-",
              }))}
            />
          </>
        )}
      </>
    </ProtectedPage>
  );
}
