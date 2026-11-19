"use client";

import { useState, useEffect, useRef } from "react";
import { message, Spin, Drawer, List, Button, Badge, Tooltip, Checkbox } from "antd";
import useEmpresa from "@/components/useEmpresa";
import { OPCION_DESCUENTO_PRIMERO } from "@/lib/empresa-cliente";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import { obtenerClientesSelect, obtenerProductosSelect } from "@/lib/consultas";
import { FloatingButton } from "@/components/Button";
import { SolutionOutlined, UnorderedListOutlined } from "@ant-design/icons";
import {
  calcularCafeDesdeProducto,
  calcularPesoBrutoDesdeOro,
} from "@/lib/calculoCafe";
import { exportCompraDirecta } from "@/Doc/Documentos/compra";
import ProtectedPage from "@/components/ProtectedPage";
import { useRouter } from "next/navigation";
import {
  verificarClientesPendientesContratos,
  verificarDepositosPendientes,
  verificarPrestamosPendientes,
  verificarAnticiposPendientes,
} from "@/lib/consultas";
import { BellOutlined } from "@ant-design/icons";
import NotificationDrawer from "@/components/NotificationDrawer";
import useOperacionesRapidas from "@/components/OperacionesRapidas";

import {
  limpiarFormulario,
  validarEnteroNoNegativo,
  validarEnteroPositivo,
  validarFloatPositivo,
} from "@/config/validacionesForm";

// Rebaja fija por quintal oro para Café Uva y sus variaciones
const REBAJA_UVA_POR_QQ = 100;
const formatoLps = (n) => Number(n).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esCafeUva = (producto) => /uva/i.test(producto?.data?.productName || "");

export default function CompraForm({ compraId }) {
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);

  const [loadingDatos, setLoadingDatos] = useState(true); // 🔹 loading general
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingCompra, setLoadingCompra] = useState(false); // 🔹 loading para editar

  const [cliente, setCliente] = useState(null);
  const ops = useOperacionesRapidas(cliente);
  const [producto, setProducto] = useState(null);
  const [compraTipoDocumento, setCompraTipoDocumento] = useState("");
  const [compraEn, setCompraEn] = useState("");
  const [compraPrecioQQ, setCompraPrecioQQ] = useState("");
  const [compraCantidadQQ, setCompraCantidadQQ] = useState("");
  const [compraTotal, setCompraTotal] = useState(0);
  const [compraRetencio, setCompraRetencio] = useState(0);
  const [compraTotalSacos, setCompraTotalSacos] = useState("");
  const [compraDescripcion, setCompraDescripcion] = useState("");
  const [compraOro, setCompraOro] = useState("0.00");
  const [compraPorcDano, setCompraPorcDano] = useState(0); // nuevo campo
  const [compraRebajaUva, setCompraRebajaUva] = useState(0);
  const [compraFlete, setCompraFlete] = useState(""); // cobro por flete (opcional): se debita del monto a pagar

  const router = useRouter();
  // Abono a deuda: parte del pago se aplica al préstamo/anticipo del cliente (no cambia el total de la compra)
  const [deuda, setDeuda] = useState({ prestamo: 0, anticipo: 0 });
  const [compraAbono, setCompraAbono] = useState("");
  const [abonoTipo, setAbonoTipo] = useState(null);
  // Al editar: el abono que la compra ya tiene (se anula y se reemplaza por el nuevo) cuenta como capital disponible
  const [abonoActual, setAbonoActual] = useState({ abono: 0, tipo: null });
  const clienteOriginal = useRef(null);
  const mismoCliente = !!compraId && cliente?.value === clienteOriginal.current;
  const disponible = {
    prestamo: deuda.prestamo + (mismoCliente && abonoActual.tipo === "PRESTAMO" ? abonoActual.abono : 0),
    anticipo: deuda.anticipo + (mismoCliente && abonoActual.tipo === "ANTICIPO" ? abonoActual.abono : 0),
  };
  const opcionesDeuda = [
    disponible.prestamo > 0 && { value: "PRESTAMO", label: `Préstamo (pendiente L. ${disponible.prestamo.toFixed(2)})` },
    disponible.anticipo > 0 && { value: "ANTICIPO", label: `Anticipo (pendiente L. ${disponible.anticipo.toFixed(2)})` },
  ].filter(Boolean);
  const tipoAbono = opcionesDeuda.length === 1 ? opcionesDeuda[0].value : abonoTipo?.value;
  const abonoNum = parseFloat(compraAbono) || 0;
  const { tieneOpcion } = useEmpresa();
  const [descuentoPrimero, setDescuentoPrimero] = useState(false); // solo se ofrece si la empresa activó la opción
  const usaDescuentoPrimero = tieneOpcion(OPCION_DESCUENTO_PRIMERO) && descuentoPrimero;

  const [errors, setErrors] = useState({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    async function cargarNotificaciones() {
      // Limpiar notificaciones al cambiar de cliente
      setNotifications([]);

      if (!cliente || !cliente.value) return;

      // Obtener contratos pendientes
      const mensajesContratos = await verificarClientesPendientesContratos(
        cliente.value,
      );
      // Obtener depósitos pendientes
      const mensajesDepositos = await verificarDepositosPendientes(
        cliente.value,
      );
      const mensajesPrestamos = await verificarPrestamosPendientes(
        cliente.value,
      );
      const mensajesAnticipos = await verificarAnticiposPendientes(
        cliente.value,
      );

      // Combinar todos los mensajes
      const todosMensajes = [
        ...mensajesContratos,
        ...mensajesDepositos,
        ...mensajesPrestamos,
        ...mensajesAnticipos,
      ];

      setNotifications(todosMensajes);
    }

    cargarNotificaciones();
  }, [cliente, ops.recarga]);

  // Deuda del cliente (solo lo que el usuario puede abonar). Al cambiar de cliente se limpia el abono; al editar
  // una compra se conserva el que ya tiene mientras sea el mismo cliente.
  useEffect(() => {
    setDeuda({ prestamo: 0, anticipo: 0 });
    if (!(compraId && cliente?.value === clienteOriginal.current)) {
      setCompraAbono("");
      setAbonoTipo(null);
    }
    if (!cliente?.value) return;
    fetch(`/api/compras/deuda?clienteID=${cliente.value}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDeuda(d))
      .catch(() => {});
  }, [cliente, compraId, ops.recarga]);

  // Carga clientes y productos
  useEffect(() => {
    async function cargarDatos() {
      setLoadingDatos(true);
      try {
        const clientesData = await obtenerClientesSelect(messageApi);
        const productosData = await obtenerProductosSelect(messageApi);
        setClientes(clientesData);
        setProductos(productosData);
      } catch (err) {
        console.error(err);
        messageApi.error("Error cargando clientes o productos");
      } finally {
        setLoadingDatos(false);
      }
    }
    cargarDatos();
  }, [messageApi]);

  const handleRegistrarClick = () => {
    if (validarDatos()) setPreviewVisible(true);
  };

  useEffect(() => {
    if (!producto) return;

    const resultado = calcularCafeDesdeProducto(
      compraCantidadQQ,
      compraTotalSacos,
      producto, // objeto con value, label y data
      compraPrecioQQ,
      usaDescuentoPrimero,
    );

    const porc = parseFloat(compraPorcDano) || 0;

    // ⬅️ 1. Calcular
    let oroConDano = resultado.oro * (1 - porc / 100);

    // ⬅️ 2. Redondear a 2 decimales

    oroConDano = Number(oroConDano.toFixed(2));

    const retencion = oroConDano * 0.96;

    // ⬅️ 3. Rebaja de L. 100 por quintal oro (solo Café Uva)
    const rebajaUva = esCafeUva(producto)
      ? Number((oroConDano * REBAJA_UVA_POR_QQ).toFixed(2))
      : 0;

    // ⬅️ 4. Guardar redondeado
    setCompraOro(oroConDano);
    setCompraRebajaUva(rebajaUva);
    setCompraTotal(oroConDano * compraPrecioQQ - rebajaUva - (parseFloat(compraFlete) || 0));
    setCompraRetencio(retencion);
  }, [
    compraCantidadQQ,
    compraTotalSacos,
    compraPrecioQQ,
    producto,
    compraPorcDano,
    compraFlete,
    usaDescuentoPrimero,
  ]);

  // Validación
  const validarDatos = () => {
    const newErrors = {}; // en JS no hace falta tipar nada

    fields.forEach((f) => {
      if (typeof f.validator === "function") {
        const error = f.validator(f.value);
        if (error) newErrors[f.label] = error;
      }
    });

    if ((parseFloat(compraFlete) || 0) > 0 && compraTotal < 0) newErrors["Cobro por flete (Lps)"] = "El flete no puede ser mayor que el pago por el café";

    // solo se valida si el usuario ve los campos de abono (si no los ve, el abono que ya tenga la compra no se toca)
    if (opcionesDeuda.length > 0 && abonoNum > 0) {
      const pendiente = tipoAbono === "PRESTAMO" ? disponible.prestamo : tipoAbono === "ANTICIPO" ? disponible.anticipo : 0;
      if (!tipoAbono) newErrors["Abonar a"] = "Elija a qué deuda se abona";
      else if (abonoNum > pendiente) newErrors["Abonar a deuda (Lps)"] = `El abono excede el capital pendiente (L. ${pendiente.toFixed(2)})`;
      if (abonoNum > compraTotal) newErrors["Abonar a deuda (Lps)"] = "El abono no puede ser mayor que el pago por el café";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      messageApi.warning("Complete los campos obligatorios correctamente");
      return false;
    }
    return true;
  };

  const handleConfirmar = async () => {
    setSubmitting(true);

    const data = {
      clienteID: cliente.value,
      compraTipoCafe: producto.value,
      compraTipoDocumento,
      compraCantidadQQ: parseFloat(compraOro),
      compraTotalSacos:
        producto?.data?.productName === "Cafe Lata"
          ? 1
          : compraTotalSacos
            ? parseInt(compraTotalSacos, 10)
            : 0,
      compraPrecioQQ: parseFloat(compraPrecioQQ),
      compraRetencio: parseFloat(compraRetencio),
      compraTotal: parseFloat(compraTotal),
      compraFlete: parseFloat(compraFlete) || 0,
      // al editar, con los campos de abono visibles se manda siempre (0 = quitar el abono); sin ellos, el abono no se toca
      ...(opcionesDeuda.length > 0 && (compraId || abonoNum > 0) && { compraAbono: abonoNum, compraAbonoTipo: abonoNum > 0 ? tipoAbono : null }),
      compraEn: compraEn || "Compra Directa",
      compraMovimiento: "Entrada",
      compraDescripcion,
    };

    try {
      // 🔹 Aquí decidimos la URL y método según si es creación o edición
      const url = compraId ? `/api/compras/${compraId}` : "/api/compras";
      const method = compraId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Error al procesar la compra");

      messageApi.success(
        compraId
          ? "Compra actualizada correctamente"
          : "Compra registrada correctamente",
      );

      setPreviewVisible(false);

      // 🔹 Loading mientras se genera PDF
      messageApi.open({
        type: "loading",
        content: "Generando comprobante de compra, por favor espere...",
        duration: 0,
        key: "generandoComprobante",
      });

      try {
        await exportCompraDirecta({
          cliente,
          productos: [
            // Subtotal (QQ oro × precio) y debajo cada rebaja o cobro, hasta el total a pagar
            {
              nombre: producto.label,
              cantidad: parseFloat(compraOro),
              precio: compraPrecioQQ,
              total: compraTotal + compraRebajaUva + (parseFloat(compraFlete) || 0),
            },
            ...(compraRebajaUva > 0 ? [{ nombre: `Menos rebaja Café Uva (L. ${REBAJA_UVA_POR_QQ} por QQ oro)`, cantidad: "", precio: "", total: -compraRebajaUva }] : []),
            ...((parseFloat(compraFlete) || 0) > 0 ? [{ nombre: "Menos flete", cantidad: "", precio: "", total: -parseFloat(compraFlete) }] : []),
            ...(abonoNum > 0 ? [{ nombre: `Menos abono a ${tipoAbono === "PRESTAMO" ? "préstamo" : "anticipo"}`, cantidad: "", precio: "", total: -abonoNum }] : []),
          ],
          total: compraTotal - abonoNum, // lo que se le paga al cliente
          filaTotal: true,
          observaciones: [
            compraDescripcion,
            abonoNum > 0 &&
              `Abono a ${tipoAbono === "PRESTAMO" ? "préstamo" : "anticipo"}: L. ${formatoLps(abonoNum)}${opcionesDeuda.length > 0 ? `. Saldo pendiente de capital: L. ${formatoLps((tipoAbono === "PRESTAMO" ? disponible.prestamo : disponible.anticipo) - abonoNum)}` : ""}`,
          ]
            .filter(Boolean)
            .join(" | "),
          comprobanteID: result.compraId,
        });

        messageApi.destroy("generandoComprobante");
        messageApi.success("Comprobante generado correctamente");
      } catch (err) {
        console.error("Error generando PDF:", err);
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
        setCliente,
        setProducto,
        setCompraCantidadQQ,
        setCompraTotalSacos,
        setCompraPorcDano,
        setCompraEn,
        setCompraDescripcion,
        setCompraTipoDocumento,
        setCompraRetencio,
        setCompraTotal,
        setCompraFlete,
        setCompraPrecioQQ,
        setCompraOro,
        setErrors,
      });
      setCompraPorcDano(0);
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
      validator: (v) => (!!v ? null : "Seleccione un cliente"),
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
        producto?.data?.productName === "Cafe Lata"
          ? "Cantidad de Latas"
          : "Peso Bruto (lbs)",
      value: compraCantidadQQ,
      setter: setCompraCantidadQQ,
      type: "Float",
      required: true,
      error: errors["Peso Bruto (lbs)"],
      validator: validarFloatPositivo,
    },
    {
      label: "Total Sacos",
      value: producto?.data?.productName === "Cafe Lata" ? 0 : compraTotalSacos,
      setter: producto?.data?.productName === "Cafe Lata" ? () => {} : setCompraTotalSacos,
      type: "integer",
      required: producto?.data?.productName === "Cafe Lata" ? false : true,
      error: errors["Total Sacos"],
      readOnly: producto?.data?.productName === "Cafe Lata",
      validator: (v) => {
        if (producto?.data?.productName === "Cafe Lata") return null;
        if (v === "" || v === null || v === undefined)
          return "Ingrese total de sacos";
        return validarEnteroNoNegativo(v) ? null : "Total sacos debe ser >= 0";
      },
    },
    {
      label: "Precio (Lps)",
      value: compraPrecioQQ,
      setter: setCompraPrecioQQ,
      type: "Float",
      required: true,
      error: errors["Precio (Lps)"],
      validator: validarFloatPositivo,
    },
    {
      label: "Porcentaje de Daño (%)",
      value: compraPorcDano,
      setter: setCompraPorcDano,
      type: "Float",
      required: false,
      tooltip:
        "Ingrese el porcentaje normalmente, por ejemplo: 50 para 50%. No use 0.50.",
      error: errors["Porcentaje de Daño"],
      validator: (v) => {
        if (v === "" || v === null || v === undefined) return null;
        const num = parseFloat(v);
        if (isNaN(num) || num < 0 || num > 100)
          return "Ingrese un porcentaje válido entre 0 y 100";
        return null;
      },
    },

    // Primero lo que se escribe; los campos calculados (bloqueados) van juntos más abajo.
    {
      label: "Cobro por flete (Lps)",
      value: compraFlete,
      setter: setCompraFlete,
      type: "Float",
      error: errors["Cobro por flete (Lps)"],
      tooltip: "Opcional. Se debita del monto a pagar por el café; varía según la zona y la cantidad que se traiga.",
    },
    ...(opcionesDeuda.length > 0
      ? [
          ...(opcionesDeuda.length > 1
            ? [{ label: "Abonar a", value: abonoTipo, setter: setAbonoTipo, type: "select", options: opcionesDeuda, error: errors["Abonar a"] }]
            : []),
          {
            label: "Abonar a deuda (Lps)",
            value: compraAbono,
            setter: setCompraAbono,
            type: "Float",
            error: errors["Abonar a deuda (Lps)"],
            tooltip: `Opcional. Parte del pago se aplica a la deuda del cliente (${opcionesDeuda.map((o) => o.label).join(" / ")}). No cambia el total de la compra: solo baja lo que se le paga y su deuda.`,
          },
        ]
      : []),
    {
      label: "Descripción",
      value: compraDescripcion,
      setter: setCompraDescripcion,
      type: "textarea",
    },

    // Calculados (solo lectura). Este orden deja Subtotal y Total lado a lado y sin huecos:
    //   Oro | Retención  ·  Subtotal | Total  ·  A pagar | Rebaja Uva   (los opcionales se omiten y el resto sube)
    {
      label: "Quintales Oro",
      value: compraOro,
      setter: setCompraOro,
      type: "Float",
      required: true,
      readOnly: true,
      error: errors["Quintales Oro"],
    },
    {
      label: "Retencion",
      value: compraRetencio,
      setter: setCompraRetencio,
      type: "Float",
      required: true,
      readOnly: true,
      error: errors["Retencion"],
    },
    ...((parseFloat(compraFlete) || 0) > 0
      ? [
          {
            label: "Valor del café (Lps)",
            value: compraTotal + (parseFloat(compraFlete) || 0),
            setter: () => {},
            type: "Float",
            readOnly: true,
            tooltip: "Valor del café (QQ oro × precio, menos la rebaja de Café Uva si aplica) antes del cobro por flete.",
          },
        ]
      : []),
    {
      label: "Total de la compra (Lps)",
      value: compraTotal,
      setter: setCompraTotal,
      type: "Float",
      required: true,
      readOnly: true,
      tooltip: "Valor del café menos el flete. Es el monto que registran los reportes de compras.",
      error: errors["Total"],
    },
    ...(abonoNum > 0
      ? [{ label: "Total a pagar al cliente (Lps)", value: Math.max(compraTotal - abonoNum, 0), setter: () => {}, type: "Float", readOnly: true, tooltip: "Total de la compra menos el abono a la deuda: lo que se le entrega al cliente." }]
      : []),
    ...(esCafeUva(producto)
      ? [
          {
            label: "Rebaja Café Uva (Lps)",
            value: compraRebajaUva,
            setter: setCompraRebajaUva,
            type: "Float",
            readOnly: true,
            tooltip: `Se rebajan L. ${REBAJA_UVA_POR_QQ} por cada quintal oro del total.`,
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (!compraId || loadingDatos) return;

    const cargarCompra = async () => {
      setLoadingCompra(true);
      try {
        const res = await fetch(`/api/compras/${compraId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar la compra");

        // 🔹 Asignar cliente y producto asegurando que existan en options
        const clienteMatch = clientes.find((c) => c.value === data.clienteID);
        const productoMatch = productos.find(
          (p) => p.value === data.compraTipoCafe,
        );

        // abono que la compra ya tiene (lo informa el servidor): se muestra para poder cambiarlo o quitarlo
        const abonoDeLaCompra = Number(data.compraAbono) || 0;
        clienteOriginal.current = data.clienteID; // antes de setCliente: el efecto de la deuda lo usa para no borrar el abono
        setAbonoActual({ abono: abonoDeLaCompra, tipo: data.compraAbonoTipo || null });
        if (abonoDeLaCompra > 0) {
          setCompraAbono(String(abonoDeLaCompra));
          setAbonoTipo({ value: data.compraAbonoTipo });
        }

        setCliente(
          clienteMatch || {
            value: data.clienteID,
            label: data.cliente?.clienteNombre || "Sin nombre",
          },
        );
        setProducto(
          productoMatch || {
            value: data.compraTipoCafe,
            label: data.producto?.productName || "Sin nombre",
          },
        );

        setCompraTipoDocumento(data.compraTipoDocumento || "");
        setCompraEn(data.compraEn || "");
        setCompraPrecioQQ(data.compraPrecioQQ);

        setCompraTotalSacos(data.compraTotalSacos);
        setCompraDescripcion(data.compraDescripcion);
        setCompraFlete(Number(data.compraFlete) > 0 ? data.compraFlete : "");
        setCompraTotal(data.compraTotal);
        setCompraRetencio(data.compraRetencio);
        setCompraOro(data.compraCantidadQQ);

        // 🔹 Convertir quintales de oro a peso bruto
        const pesoBruto = calcularPesoBrutoDesdeOro(
          data.compraCantidadQQ,
          data.compraTotalSacos,
          productoMatch || { data: {} },
          usaDescuentoPrimero,
        );
        setCompraCantidadQQ(pesoBruto.pesoBruto);
      } catch (err) {
        console.error(err);
        messageApi.error("Error cargando la compra para edición");
      } finally {
        setLoadingCompra(false);
      }
    };
    cargarCompra();
  }, [compraId, loadingDatos, clientes, productos, messageApi]);

  useEffect(() => {}, [compraId]);

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "COLABORADORES"]}>
      {/* <FloatingButton
        title="Ir al registro"
        icon={<UnorderedListOutlined />}
        top={20}
        right={30}
        route="/private/page/transacciones/compra/vista"
      /> */}
      <>
        {contextHolder}
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
            {/* Contenedor fijo para el botón + badge */}
            <div
              style={{
                position: "fixed",
                bottom: 20,
                right: 20,
                zIndex: 1000,
              }}
            >
              <Badge count={ops.filtrar(notifications).length} offset={[0, 0]}>
                <Button
                  type="primary"
                  shape="circle"
                  icon={<BellOutlined />}
                  size="large"
                  onClick={() => setDrawerVisible(true)}
                />
              </Badge>
            </div>

            <NotificationDrawer
              visible={drawerVisible}
              onClose={() => setDrawerVisible(false)}
              title="Notificaciones"
              subtitle={cliente?.label}
              notifications={ops.filtrar(notifications)}
              onItemClick={cliente?.value ? ops.abrirDesde : undefined}
              actions={[
                {
                  tooltip: "Ir a Registro de Compras",
                  icon: <SolutionOutlined />,
                  onClick: () =>
                    router.push("/private/page/transacciones/compra/vista"),
                route: "/private/page/transacciones/compra/vista",
              },
              ]}
            />

            {ops.modales}

            <Formulario
          extra={
                <>
                  {tieneOpcion(OPCION_DESCUENTO_PRIMERO) && (
                    <Tooltip title="Aplica el descuento a todo el peso y después resta los sacos (en vez de restar los sacos primero).">
                      <Checkbox checked={descuentoPrimero} onChange={(e) => setDescuentoPrimero(e.target.checked)}>
                        Descuento antes de restar sacos
                      </Checkbox>
                    </Tooltip>
                  )}
                  {ops.barra}
                </>
              }
              title={
                compraId ? "Editar Compra Directa" : "Registrar Compra Directa"
              }
              fields={fields}
              onSubmit={handleRegistrarClick}
              submitting={submitting}
              button={{ accion: compraId ? "editar" : "crear",
                text: compraId ? "Actualizar Compra" : "Registrar Compra",
                onClick: handleRegistrarClick,
                type: "primary",
              }}
            />
            <PreviewModal
              open={previewVisible}
              title="Previsualización de la compra "
              onCancel={() => setPreviewVisible(false)}
              onConfirm={handleConfirmar}
              confirmLoading={submitting}
              fields={fields.map((f) => ({
                label: f.label,
                value:
                  f.label === "Total Sacos" && producto?.data?.productName === "Cafe Lata"
                    ? 0
                    : f.type === "select"
                      ? f.options?.find((o) => o.value === f.value?.value)
                          ?.label
                      : f.value ||
                        (f.label === "Compra en" ? "Compra Directa" : "-"),
              }))}
            />
          </>
        )}
      </>
    </ProtectedPage>
  );
}
