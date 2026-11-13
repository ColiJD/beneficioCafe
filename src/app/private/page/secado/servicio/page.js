"use client";
import { useEffect, useMemo, useState } from "react";
import { Table, Button, Modal, Form, Select, InputNumber, Input, Tag, Alert, Space, Descriptions, Segmented, Checkbox, DatePicker, message } from "antd";
import { PlusOutlined, CheckOutlined, DollarOutlined, ShoppingCartOutlined, FilePdfOutlined, StopOutlined } from "@ant-design/icons";
import ProtectedPage from "@/components/ProtectedPage";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import usePermisos from "@/components/usePermisos";
import { puedeEnModulo } from "@/lib/modulos";
import { calcularCafeDesdeProducto, calcularPesoBrutoDesdeOro } from "@/lib/calculoCafe";
import { formatNumber } from "@/components/Formulario";
import dayjs from "dayjs";
import { PDFComprobante } from "@/Doc/Documentos/generico";

const MOD = "servicio-secado";
const COLOR = { Recibido: "blue", Seco: "gold", Pagado: "green", Vendido: "green", Anulado: "default" };
const L = (v) => `L. ${formatNumber(Number(v) || 0)}`;
const qq = (v) => (v == null ? "—" : `${formatNumber(Number(v))} QQ`);
const dia = (f) => (f ? new Date(f).toLocaleDateString("es-HN", { timeZone: "America/Tegucigalpa" }) : "—");
const oroPrevio = (prod, peso, sacos) => (prod ? Number(calcularCafeDesdeProducto(peso, sacos, { data: prod }, 0).oro) || 0 : 0);

async function pedir(url, metodo, cuerpo) {
  const r = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "Error"), j);
  return j;
}

// Comprobante impreso (mismo formato de los demás comprobantes, dos copias por hoja).
// El generador quita acentos, paréntesis y signos: los textos van simples y los montos ya formateados.
const n2 = (v) => formatNumber(Number(v) || 0);
const dif = (s) => (s.oroSalida == null ? null : Number(s.oroSalida) - Number(s.oroEntrada));
// Formas de pago usadas y su descripción (pago mixto: varias)
const pagosDe = (s) => {
  const lista = [["Efectivo", s.pagoEfectivo, "efectivo"], ["Transferencia", s.pagoTransferencia, "transferencia"], ["Cheque", s.pagoCheque, "cheque"]].filter(([, m]) => Number(m) > 0);
  return { formas: lista.length ? lista.map(([f]) => f) : [s.formaPago || "Efectivo"], texto: lista.map(([, m, t]) => `${t} ${L(m)}`).join(" y ") };
};
async function comprobante(s, compra) {
  const pago = pagosDe(s);
  // Minimalista: pocas filas y textos cortos para que quepa en media hoja (el total va también en letras)
  const filas = compra
    ? [
        { nombre: "Compra Cafe Seco", cantidad: `${n2(compra.compraCantidadQQ)} QQ oro`, precioTxt: L(compra.compraPrecioQQ), totalTxt: L(compra.compraTotal) },
        { nombre: "Menos secado", cantidad: `${n2(s.oroEntrada)} QQ oro`, precioTxt: L(s.tarifaQQ), totalTxt: `- ${L(s.cobro)}` },
        { nombre: "TOTAL A PAGAR", cantidad: "", precioTxt: "", totalTxt: L(Number(compra.compraTotal) - Number(s.cobro)) },
      ]
    : [
        { nombre: "Servicio de secado", cantidad: `${n2(s.oroEntrada)} QQ oro`, precioTxt: L(s.tarifaQQ), totalTxt: L(s.cobro) },
        { nombre: "TOTAL A PAGAR", cantidad: "", precioTxt: "", totalTxt: L(s.cobro) },
      ];
  await PDFComprobante({
    tipoComprobante: compra ? "COMPRA CON SERVICIO DE SECADO" : "COMPROBANTE DE SERVICIO DE SECADO",
    cliente: s.cliente,
    productos: filas,
    total: compra ? Number(compra.compraTotal) - Number(s.cobro) : Number(s.cobro),
    observaciones: compra
      ? `Servicio ${s.servicioID}. Seco: ${n2(s.oroSalida)} QQ oro. Se compran ${n2(compra.compraCantidadQQ)} y se entregan ${n2(Number(s.oroSalida) - Number(compra.compraCantidadQQ))} QQ. Pago en ${pago.texto}.`
      : `Servicio ${s.servicioID}. Entro: ${n2(s.pesoBrutoEntrada)} lb, ${n2(s.sacosEntrada)} sacos. Seco: ${n2(s.oroSalida)} QQ oro. Pago en ${pago.texto}.`,
    comprobanteID: s.servicioID,
    formaPago: pago.formas,
    espacioFirma: 55,
    columnStyles: { 1: { cellWidth: 95 }, 2: { cellWidth: 80 }, 3: { cellWidth: 95 } },
    columnas: [{ title: "Concepto", key: "nombre" }, { title: "Cantidad", key: "cantidad" }, { title: "Precio", key: "precioTxt" }, { title: "Total", key: "totalTxt" }],
  });
}

// Reparto del pago según las formas marcadas. Una sola forma: lleva todo el monto. Varias: cada una con la cantidad que se escriba y deben sumar el monto.
const redondeo = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const METODOS = [["Efectivo", "pagoEfectivo"], ["Transferencia", "pagoTransferencia"], ["Cheque", "pagoCheque"]];
const repartoPago = (v, monto) => {
  const marcados = METODOS.filter(([m]) => (v.metodos ?? []).includes(m));
  if (!marcados.length) return { error: "Elija al menos una forma de pago." };
  const monto2 = redondeo(monto);
  const cant = Object.fromEntries(marcados.map(([m, campo]) => [m, marcados.length === 1 ? monto2 : redondeo(Number(v[campo]) || 0)]));
  const suma = redondeo(Object.values(cant).reduce((x, y) => x + y, 0));
  const falta = redondeo(monto2 - suma);
  return { efectivo: cant.Efectivo ?? 0, transferencia: cant.Transferencia ?? 0, cheque: cant.Cheque ?? 0, falta, marcados, error: falta !== 0 ? `Los montos suman ${L(suma)} y deben sumar ${L(monto2)}.` : null };
};

// Cómo se paga: se marcan las formas y, si es más de una, se escribe cuánto va por cada una. `entra`: el efectivo entra o sale de la caja chica.
function BloquePagos({ monto, valores, entra, form }) {
  const p = repartoPago(valores, monto);
  const varias = p.marcados?.length > 1;
  return (
    <>
      <Form.Item name="metodos" label="Forma de pago" rules={[{ required: true, message: "Elija al menos una forma de pago" }]} style={{ marginBottom: 8 }}>
        <Checkbox.Group options={METODOS.map(([m]) => m)} />
      </Form.Item>
      {p.marcados?.map(([m, campo]) => (
        <Form.Item key={m} label={`${m} (L)`} name={varias ? campo : undefined} style={{ marginBottom: 8 }}>
          {varias ? (
            <InputNumber min={0} max={monto} step={0.01} style={{ width: 220 }} addonAfter={<a onClick={() => form.setFieldValue(campo, redondeo(Math.max((Number(form.getFieldValue(campo)) || 0) + p.falta, 0)))}>Completar</a>} />
          ) : (
            <Input value={L(monto)} readOnly style={{ width: 220, fontWeight: 600 }} />
          )}
        </Form.Item>
      ))}
      {varias && <Alert type={p.falta === 0 ? "success" : p.falta > 0 ? "warning" : "error"} showIcon style={{ marginBottom: 8 }} message={p.falta === 0 ? "Los montos cuadran." : p.falta > 0 ? `Faltan ${L(p.falta)} por asignar.` : `Se pasa por ${L(-p.falta)}.`} />}
      <Alert type="info" showIcon message={p.efectivo > 0 ? `${L(p.efectivo)} en efectivo ${entra ? "entran a" : "salen de"} la caja chica de hoy.` : "Sin efectivo: no se mueve la caja chica."} />
    </>
  );
}

export default function ServicioSecadoPage() {
  const acc = usePermisos();
  const puede = (a) => puedeEnModulo(acc, MOD, a);
  const [filas, setFilas] = useState([]);
  const [filtro, setFiltro] = useState("Activos");
  const [rango, setRango] = useState([dayjs(), dayjs()]); // por defecto, el día de hoy
  const [fCliente, setFCliente] = useState();
  const [buscar, setBuscar] = useState("");
  const [pendientes, setPendientes] = useState(0); // recibidos o secos de cualquier día, para que no se pierdan de vista
  const [tarifa, setTarifa] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [secadoras, setSecadoras] = useState([]);
  const [modal, setModal] = useState(null); // { tipo, s }
  const [enviando, setEnviando] = useState(false);
  const [form] = Form.useForm();
  const valores = Form.useWatch([], form) ?? {};
  const [msg, ctx] = message.useMessage();
  const [modalApi, modalCtx] = Modal.useModal();

  // Filtros en el servidor: estado, fechas (hora de Honduras), cliente y texto (número de servicio o nombre)
  const consulta = () => {
    const p = new URLSearchParams();
    if (filtro === "Activos") p.set("estado", "Recibido,Seco");
    else if (filtro !== "Todos") p.set("estado", filtro);
    if (rango?.[0]) p.set("desde", rango[0].startOf("day").format("YYYY-MM-DDTHH:mm:ss") + "-06:00");
    if (rango?.[1]) p.set("hasta", rango[1].endOf("day").format("YYYY-MM-DDTHH:mm:ss") + "-06:00");
    if (fCliente) p.set("clienteID", fCliente);
    if (buscar.trim()) p.set("q", buscar.trim());
    return p.toString();
  };

  const cargar = async () => {
    const [f, t] = await Promise.all([fetch("/api/servicio-secado?" + consulta()).then((r) => (r.ok ? r.json() : [])), fetch("/api/servicio-secado?tarifa=1").then((r) => (r.ok ? r.json() : null))]);
    setFilas(Array.isArray(f) ? f : []);
    fetch("/api/servicio-secado?estado=Recibido,Seco").then((x) => (x.ok ? x.json() : [])).then((l) => setPendientes(Array.isArray(l) ? l.length : 0));
    setTarifa(t);
  };
  // Valores iniciales de cada ventana, cuando el formulario ya está montado
  useEffect(() => {
    if (!modal) return;
    const { tipo, s } = modal;
    if (tipo === "vender") form.setFieldsValue({ qq: Number(s.oroSalida) });
    if (tipo === "terminar") form.setFieldsValue({ sacos: Number(s.sacosEntrada) });
    if (tipo === "cobrar" || tipo === "vender") form.setFieldsValue({ metodos: ["Efectivo"] });
  }, [modal]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opciones de estado según los permisos: cada una exige el suyo; "Todos" muestra los que el usuario puede ver
  const opciones = useMemo(() => {
    const o = [["Activos", "servicio-secado"], ["Pagado", "reg-servicio-pagado"], ["Vendido", "reg-servicio-vendido"], ["Anulado", "reg-servicio-anulado"]].filter(([, m]) => puedeEnModulo(acc, m, "ver")).map(([n]) => n);
    return o.length > 1 ? [...o, "Todos"] : o;
  }, [acc]);
  useEffect(() => { if (opciones.length && !opciones.includes(filtro)) setFiltro(opciones[0]); }, [opciones]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [filtro, rango, fCliente, buscar]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch("/api/clientes").then((r) => r.ok && r.json()).then((c) => c && setClientes(c));
    fetch("/api/productos").then((r) => r.ok && r.json()).then((p) => p && setProductos(p));
  }, []);
  const cargarSecadoras = () => fetch("/api/secadoras").then((r) => r.ok && r.json()).then((s) => s && setSecadoras(s));

  const prod = (id) => productos.find((p) => p.productID === id);
  const datosProd = (id) => { const p = prod(id); return p && { tara: Number(p.tara ?? 0), descuento: Number(p.descuento ?? 0), factorOro: Number(p.factorOro ?? 1) }; };

  const abrir = (tipo, s = null) => {
    form.resetFields();
    if (tipo === "recibir" || tipo === "secadora") cargarSecadoras();
    setModal({ tipo, s });
  };

  const ejecutar = async (fn, ok) => {
    setEnviando(true);
    try {
      const r = await fn();
      msg.success(ok);
      setModal(null);
      await cargar();
      return r;
    } catch (e) {
      msg.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const recibir = async (extra = {}) => {
    const v = await form.validateFields();
    setEnviando(true);
    try {
      await pedir("/api/servicio-secado", "POST", { ...v, ...extra });
      msg.success("Café recibido para secado");
      setModal(null);
      cargar();
    } catch (e) {
      if (e.secadoraOcupada) {
        // La secadora está ocupada: el usuario decide cómo seguir
        modalApi.confirm({
          title: e.message,
          content: "Puede usarla de todos modos (sin reservarla) o registrar el servicio sin secadora asignada.",
          okText: "Usarla de todos modos",
          cancelText: "Sin secadora",
          onOk: () => recibir({ forzarSecadora: true }),
          onCancel: () => recibir({ secadoraId: null }),
        });
      } else msg.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const enviar = async () => {
    const { tipo, s } = modal;
    if (tipo === "recibir") return recibir();
    if (tipo === "secadora") return asignar(await form.validateFields());
    const v = await form.validateFields();
    if (tipo === "cobrar") {
      const pagos = repartoPago(v, Number(s.cobro));
      if (pagos.error) return msg.error(pagos.error);
      const r = await ejecutar(() => pedir(`/api/servicio-secado/${s.servicioID}`, "PUT", { accion: "cobrar", pagos: { efectivo: pagos.efectivo, transferencia: pagos.transferencia, cheque: pagos.cheque } }), "Servicio cobrado");
      if (r) comprobante({ ...s, ...r });
      return;
    }
    if (tipo === "terminar") return ejecutar(() => pedir(`/api/servicio-secado/${s.servicioID}`, "PUT", { accion: "terminar", ...v }), "Secado terminado");
    if (tipo === "vender") {
      const pagos = repartoPago(v, netoVenta);
      if (pagos.error) return msg.error(pagos.error);
      const r = await ejecutar(() => pedir(`/api/servicio-secado/${s.servicioID}`, "PUT", { accion: "vender", qq: v.qq, precioQQ: v.precioQQ, pagos: { efectivo: pagos.efectivo, transferencia: pagos.transferencia, cheque: pagos.cheque } }), "Compra registrada");
      if (r) comprobante({ ...s, ...r.servicio }, r.compra);
    }
  };

  const asignar = async (v, forzarSecadora = false) => {
    setEnviando(true);
    try {
      await pedir(`/api/servicio-secado/${modal.s.servicioID}`, "PUT", { accion: "secadora", ...v, forzarSecadora });
      msg.success("Secadora asignada");
      setModal(null);
      cargar();
    } catch (e) {
      if (e.secadoraOcupada) {
        modalApi.confirm({
          title: e.message,
          content: "Puede usarla de todos modos (sin reservarla) o elegir otra.",
          okText: "Usarla de todos modos",
          cancelText: "Elegir otra",
          onOk: () => asignar(v, true),
        });
      } else msg.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const anular = (s) =>
    modalApi.confirm({
      title: `¿Anular el servicio #${s.servicioID}?`,
      okText: "Anular", okButtonProps: { danger: true },
      onOk: () => ejecutar(() => pedir(`/api/servicio-secado/${s.servicioID}`, "PUT", { accion: "anular" }), "Servicio anulado"),
    });

  // Tarifa configurable (permiso "Tarifa del servicio de secado" en Roles y permisos): se guarda en la cosecha abierta y aplica a los servicios que se reciban desde ahora.
  const cambiarTarifa = () => {
    let valor = tarifa?.tarifa ?? 250;
    modalApi.confirm({
      title: "Tarifa del servicio de secado",
      content: (
        <>
          <p>Lempiras por quintal oro del café que se recibe para secar. Los servicios ya recibidos conservan la tarifa con la que se registraron.</p>
          <InputNumber min={0} step={10} defaultValue={valor} onChange={(v) => (valor = v)} addonBefore="L." style={{ width: 180 }} />
        </>
      ),
      okText: "Guardar",
      onOk: () => ejecutar(() => pedir("/api/tarifa-secado", "PUT", { tarifaSecadoQQ: valor }), "Tarifa actualizada"),
    });
  };

  const reimprimir = (s) => comprobante(s, s.compra);

  const nw = { whiteSpace: "nowrap" };
  const columnas = [
    { title: "Servicio", width: 105, render: (_, s) => <span style={nw}><b>#{s.servicioID}</b><br /><small style={{ color: "var(--suave)" }}>{dia(s.fecha)}</small></span> },
    { title: "Cliente", dataIndex: "cliente", width: 170 },
    { title: "Recibido", width: 170, render: (_, s) => <span style={nw}>{s.producto}<br /><small style={{ color: "var(--suave)" }}>{formatNumber(Number(s.pesoBrutoEntrada))} lb, {formatNumber(Number(s.sacosEntrada))} sacos</small></span> },
    {
      title: "QQ oro", align: "right", width: 150, render: (_, s) => {
        const d = dif(s);
        const pct = d != null && Number(s.oroEntrada) ? (d / Number(s.oroEntrada)) * 100 : 0;
        return (
          <span style={nw} title="Estimado al recibir → real al secar">
            {n2(s.oroEntrada)}{s.oroSalida != null && <> → <b>{n2(s.oroSalida)}</b></>}
            {d != null && <><br /><small style={{ color: "var(--suave)" }}>{d >= 0 ? "+" : "−"}{n2(Math.abs(d))} ({d >= 0 ? "+" : "−"}{Math.abs(pct).toFixed(0)} %)</small></>}
          </span>
        );
      },
    },
    { title: "Cobro", dataIndex: "cobro", align: "right", width: 115, render: (v) => <span style={nw}>{L(v)}</span> },
    { title: "Secadora", dataIndex: "secadora", width: 120, render: (v, s) => (v ? <span style={nw}>{v}{s.secadoraReservada ? "" : <><br /><small style={{ color: "var(--suave)" }}>compartida</small></>}</span> : "—") },
    { title: "Estado", dataIndex: "estado", width: 130, render: (e, s) => <><Tag color={COLOR[e]} style={{ marginInlineEnd: 0 }}>{e}{e === "Vendido" ? ` ${n2(s.qqVendidos)} QQ` : ""}</Tag>{s.formaPago && <><br /><small style={{ color: "var(--suave)" }}>{s.formaPago === "Mixto" ? pagosDe(s).formas.join(" + ") : s.formaPago}</small></>}</> },
    {
      title: "Acciones", width: 230, render: (_, s) => (
        <Space wrap size={6}>
          {s.estado === "Recibido" && puede("editar") && <Button size="small" onClick={() => abrir("secadora", s)}>{s.secadoraId ? "Cambiar secadora" : "Asignar secadora"}</Button>}
          {s.estado === "Recibido" && puede("editar") && <Button size="small" icon={<CheckOutlined />} onClick={() => abrir("terminar", s)}>Terminar</Button>}
          {s.estado === "Seco" && puede("editar") && <Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => abrir("cobrar", s)}>Cobrar</Button>}
          {s.estado === "Seco" && puede("editar") && <Button size="small" icon={<ShoppingCartOutlined />} onClick={() => abrir("vender", s)}>Comprar café</Button>}
          {["Pagado", "Vendido"].includes(s.estado) && <Button size="small" icon={<FilePdfOutlined />} title="Comprobante" aria-label="Comprobante" onClick={() => reimprimir(s)} />}
          {["Recibido", "Seco"].includes(s.estado) && puede("editar") && <Button size="small" danger icon={<StopOutlined />} title="Anular" aria-label="Anular" onClick={() => anular(s)} />}
        </Space>
      ),
    },
  ];

  const totales = useMemo(() => {
    const v = filas.filter((f) => f.estado !== "Anulado");
    return { servicios: v.length, oroEntrada: v.reduce((a, f) => a + Number(f.oroEntrada), 0), oroSalida: v.reduce((a, f) => a + Number(f.oroSalida ?? 0), 0), cobro: v.reduce((a, f) => a + Number(f.cobro), 0) };
  }, [filas]);

  // Vista previa de los cálculos (el servidor los vuelve a calcular)
  const s = modal?.s;
  const previoRecibir = oroPrevio(datosProd(valores.productoID), valores.pesoBruto, valores.sacos);
  const secoID = productos.find((p) => p.productName === "Cafe Seco")?.productID; // todo café secado termina como Café Seco
  // Peso bruto seco que se espera para los QQ oro que entraron (con los sacos que se capturen) y desvío del peso real
  const seco = datosProd(secoID);
  const esperado = s && modal?.tipo === "terminar" && seco ? calcularPesoBrutoDesdeOro(Number(s.oroEntrada), 0, { data: seco }).pesoBruto : 0; // neto seco esperado
  const netoReal = Math.max((Number(valores.pesoBruto) || 0) - (Number(valores.sacos) || 0) * (seco?.tara || 0), 0);
  const desvio = esperado && valores.pesoBruto ? (netoReal - esperado) / esperado : 0;
  const previoTerminar = oroPrevio(datosProd(secoID), valores.pesoBruto, valores.sacos);
  const totalVenta = (Number(valores.qq) || 0) * (Number(valores.precioQQ) || 0);
  const netoVenta = s ? redondeo(redondeo(totalVenta) - Number(s.cobro)) : 0;
  const opcionesProd = productos.map((p) => ({ value: p.productID, label: p.productName }));

  return (
    <ProtectedPage>
      {ctx}
      {modalCtx}
      <EncabezadoPagina titulo="Servicio de secado">
        {puedeEnModulo(acc, "tarifa-secado", "editar") && <Button onClick={cambiarTarifa}>Cambiar tarifa</Button>}
        {puede("crear") && <Button type="primary" icon={<PlusOutlined />} disabled={!tarifa?.tarifa} onClick={() => abrir("recibir")}>Recibir café</Button>}
      </EncabezadoPagina>
      {tarifa?.tarifa ? (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message={`Tarifa vigente: ${L(tarifa.tarifa)} por quintal oro a secar (cosecha ${tarifa.cosecha})`} description="El cobro se calcula sobre los quintales oro del café que se recibe. El café del cliente no entra al inventario; solo la parte que se le compre." />
      ) : (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={tarifa?.error || "No hay tarifa de secado"} description="Un administrador la define en Administración > Cosechas." />
      )}
      <Space wrap size={[12, 12]} style={{ marginBottom: 16 }}>
        <Segmented value={filtro} onChange={setFiltro} options={opciones} />
        <DatePicker.RangePicker value={rango} onChange={setRango} allowClear format="DD/MM/YYYY" placeholder={["Desde", "Hasta"]} />
        <Select allowClear showSearch optionFilterProp="label" placeholder="Cliente" style={{ width: 200 }} value={fCliente} onChange={setFCliente}
          options={clientes.map((c) => ({ value: c.clienteID, label: [c.clienteNombre, c.clienteApellido].filter(Boolean).join(" ") }))} />
        <Input.Search allowClear placeholder="Servicio # o nombre" style={{ width: 200 }} onSearch={setBuscar} />
        {pendientes > 0 && (
          <Button type="link" onClick={() => { setFiltro("Activos"); setRango(null); }}>
            {pendientes} {pendientes === 1 ? "servicio pendiente" : "servicios pendientes"} en total
          </Button>
        )}
      </Space>
      <Table rowKey="servicioID" size="small" dataSource={filas} columns={columnas} scroll={{ x: 1100 }} pagination={{ pageSize: 20, showTotal: (t) => `${t} servicios` }}
        summary={() => filas.length > 0 && (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={3}><b>Total ({totales.servicios} servicios, sin anulados)</b></Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right"><span style={nw}><b>{n2(totales.oroEntrada)} → {n2(totales.oroSalida)}</b> QQ</span></Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right"><b style={nw}>{L(totales.cobro)}</b></Table.Summary.Cell>
            <Table.Summary.Cell index={5} colSpan={3} />
          </Table.Summary.Row>
        )} />

      <Modal
        open={!!modal}
        onCancel={() => setModal(null)}
        onOk={enviar}
        confirmLoading={enviando}
        okText={{ recibir: "Recibir", secadora: "Asignar", cobrar: "Cobrar", terminar: "Terminar secado", vender: "Registrar compra" }[modal?.tipo]}
        title={{ recibir: "Recibir café para secado", cobrar: `Cobrar el servicio #${s?.servicioID}`, secadora: `Secadora del servicio #${s?.servicioID}`, terminar: `Terminar secado #${s?.servicioID}`, vender: `Comprar café del servicio #${s?.servicioID}` }[modal?.tipo]}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          {modal?.tipo === "recibir" && (
            <>
              <Form.Item name="clienteID" label="Cliente" rules={[{ required: true, message: "Seleccione el cliente" }]}>
                <Select showSearch optionFilterProp="label" placeholder="Buscar cliente" options={clientes.map((c) => ({ value: c.clienteID, label: [c.clienteNombre, c.clienteApellido].filter(Boolean).join(" ") }))} />
              </Form.Item>
              <Form.Item name="productoID" label="Café recibido (húmedo)" rules={[{ required: true, message: "Seleccione el producto" }]}>
                <Select showSearch optionFilterProp="label" options={opcionesProd} />
              </Form.Item>
              <Space wrap>
                <Form.Item name="pesoBruto" label="Peso bruto (lb)" rules={[{ required: true, message: "Ingrese el peso" }]}><InputNumber min={0.01} style={{ width: 150 }} /></Form.Item>
                <Form.Item name="sacos" label="Sacos" initialValue={0}><InputNumber min={0} style={{ width: 110 }} /></Form.Item>
                <Form.Item name="humedadInicial" label="Humedad (%)"><InputNumber min={0} max={100} style={{ width: 120 }} /></Form.Item>
              </Space>
              <Form.Item name="secadoraId" label="Secadora" extra="Si está disponible se reserva; si está ocupada, usted decide cómo seguir.">
                <Select allowClear placeholder="Sin secadora" options={secadoras.map((x) => ({ value: x.secadoraId, label: `${x.nombre} — ${x.estado}` }))} />
              </Form.Item>
              <Form.Item name="observaciones" label="Observaciones"><Input maxLength={255} /></Form.Item>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="QQ oro a secar">{formatNumber(previoRecibir)}</Descriptions.Item>
                <Descriptions.Item label={`Cobro (${L(tarifa?.tarifa)} / QQ oro)`}><b>{L(previoRecibir * (tarifa?.tarifa || 0))}</b></Descriptions.Item>
              </Descriptions>
            </>
          )}
          {modal?.tipo === "cobrar" && (
            <>
              <Descriptions size="small" column={1} bordered style={{ marginBottom: 12 }}>
                <Descriptions.Item label="Cliente">{s.cliente}</Descriptions.Item>
                <Descriptions.Item label="Total a cobrar"><b>{L(s.cobro)}</b></Descriptions.Item>
              </Descriptions>
              <BloquePagos monto={Number(s.cobro)} valores={valores} entra form={form} />
            </>
          )}
          {modal?.tipo === "secadora" && (
            <Form.Item name="secadoraId" label="Secadora" rules={[{ required: true, message: "Seleccione la secadora" }]} extra="Si está disponible se reserva; si está ocupada, usted decide.">
              <Select options={secadoras.map((x) => ({ value: x.secadoraId, label: `${x.nombre} — ${x.estado}` }))} />
            </Form.Item>
          )}
          {modal?.tipo === "terminar" && (
            <>
              <Alert type="info" showIcon style={{ marginBottom: 12 }} message={`${s.cliente}: ${formatNumber(Number(s.oroEntrada))} QQ oro recibidos, cobro ${L(s.cobro)}`} />
              <Form.Item label="Producto resultante" extra={`El café que entró como ${s.producto} termina como Café Seco.`}>
                <Input value="Cafe Seco" disabled />
              </Form.Item>
              <Space wrap>
                <Form.Item name="pesoBruto" label="Peso bruto seco (lb)" rules={[{ required: true, message: "Ingrese el peso" }]}><InputNumber min={0.01} style={{ width: 150 }} /></Form.Item>
                <Form.Item name="sacos" label="Sacos"><InputNumber min={0} style={{ width: 110 }} /></Form.Item>
                <Form.Item name="humedadFinal" label="Humedad final (%)"><InputNumber min={0} max={100} style={{ width: 140 }} /></Form.Item>
              </Space>
              {esperado > 0 && <p style={{ margin: "0 0 8px", color: "var(--suave)" }}>Peso neto seco esperado: <b>{formatNumber(esperado)} lb</b> aprox. (según los QQ oro que entraron). El peso bruto será ese peso más {seco?.tara ?? 0} lb de tara por saco.</p>}
              {Math.abs(desvio) > 0.2 && (
                <Alert type="warning" showIcon style={{ marginBottom: 12 }}
                  message={`El peso neto está ${Math.abs(desvio * 100).toFixed(0)} % ${desvio > 0 ? "por encima" : "por debajo"} de lo esperado`}
                  description="Revise el peso y los sacos. Si es correcto (café más o menos húmedo de lo normal), puede continuar." />
              )}
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="QQ oro secos (destarado)"><b>{formatNumber(previoTerminar)}</b></Descriptions.Item>
                <Descriptions.Item label="Diferencia con lo estimado">{previoTerminar ? `${previoTerminar - Number(s.oroEntrada) >= 0 ? "+" : "−"}${formatNumber(Math.abs(previoTerminar - Number(s.oroEntrada)))} QQ oro` : "—"}</Descriptions.Item>
              </Descriptions>
            </>
          )}
          {modal?.tipo === "vender" && (
            <>
              <Alert type="info" showIcon style={{ marginBottom: 12 }} message={`${s.cliente}: ${formatNumber(Number(s.oroSalida))} QQ oro de ${s.productoSeco} secos`} description="Se registra como compra directa (entra al inventario) y al pago se le descuenta el cobro del secado. Lo que no se compre se entrega al cliente." />
              <Space wrap>
                <Form.Item name="qq" label="QQ oro a comprar" rules={[{ required: true, message: "Ingrese la cantidad" }, { validator: (_, v) => (v > 0 && v <= Number(s.oroSalida) ? Promise.resolve() : Promise.reject(new Error(`Entre 0.01 y ${formatNumber(Number(s.oroSalida))}`))) }]}>
                  <InputNumber min={0.01} max={Number(s.oroSalida)} step={0.01} style={{ width: 160 }} />
                </Form.Item>
                <Form.Item name="precioQQ" label="Precio por QQ oro (L)" rules={[{ required: true, message: "Ingrese el precio" }]}><InputNumber min={0.01} style={{ width: 170 }} /></Form.Item>
              </Space>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="Total de la compra">{L(totalVenta)}</Descriptions.Item>
                <Descriptions.Item label="Menos cobro del secado">− {L(s.cobro)}</Descriptions.Item>
                <Descriptions.Item label="Neto a pagar al cliente"><b>{L(totalVenta - Number(s.cobro))}</b></Descriptions.Item>
                <Descriptions.Item label="Se entrega al cliente">{formatNumber(Math.max(Number(s.oroSalida) - (Number(valores.qq) || 0), 0))} QQ oro</Descriptions.Item>
              </Descriptions>
              {netoVenta > 0 && <div style={{ marginTop: 12 }}><p style={{ margin: "0 0 8px", fontWeight: 600 }}>Pago al cliente: {L(netoVenta)}</p><BloquePagos monto={netoVenta} valores={valores} entra={false} form={form} /></div>}
            </>
          )}
        </Form>
      </Modal>
    </ProtectedPage>
  );
}
