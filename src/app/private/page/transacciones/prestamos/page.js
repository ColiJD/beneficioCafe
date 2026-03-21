"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Table, Card, Select, Typography, Space, Divider,
  Spin, Descriptions, Row, Col, Tag, Empty,
  message, Button, Popconfirm, Grid, Statistic,
  Badge, Tooltip, Avatar
} from "antd";
import {
  PlusOutlined, CalculatorOutlined, ReloadOutlined,
  DeleteFilled, FilePdfOutlined, UserOutlined,
  DollarOutlined, RiseOutlined, FallOutlined,
  WarningOutlined, AuditOutlined
} from "@ant-design/icons";
import DrawerPrestamo from "@/components/Prestamos/DrawerPrestamo.jsx";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import DrawerCalculoInteres from "@/components/Prestamos/calculoInteres";
import ProtectedPage from "@/components/ProtectedPage";
import ProtectedButton from "@/components/ProtectedButton";
import { generarReportePDF } from "@/Doc/Reportes/FormatoDoc";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function PrestamosGeneral() {
  const screens = useBreakpoint();
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const { mounted, isDesktop } = useClientAndDesktop();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [openDrawerInteres, setOpenDrawerInteres] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const messageApiRef = useRef(messageApi);
  const [dataPrestamos, setDataPrestamos] = useState([]);
  const [dataAnticipos, setDataAnticipos] = useState([]);

  useEffect(() => {
    const cargarClientes = async () => {
      try {
        const res = await fetch("/api/clientes");
        if (!res.ok) throw new Error("Error al cargar clientes");
        const data = await res.json();
        setClientes(data);
      } catch (err) {
        setError("No se pudieron cargar los clientes");
        console.error(err);
      }
    };
    cargarClientes();
  }, []);

  const cargarPrestamos = useCallback(async (clienteId) => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/prestamos/${clienteId}`);
      if (!res.ok) throw new Error("Error al cargar prstamos y anticipos");

      const data = await res.json();
      setClienteSeleccionado(data);

      const filasPrestamos = [];
      const filasAnticipos = [];

      // === PRSTAMOS ===
      if (data?.prestamos?.length > 0) {
        data.prestamos.forEach((prestamo, idxPrestamo) => {
          const prestamoKey = `prestamo-${prestamo.prestamoId || idxPrestamo}`;

          if (!["ANULADO", "ABSORBIDO", "INICIAL"].includes(prestamo.estado)) {
            filasPrestamos.push({
              key: prestamoKey,
              prestamoId: prestamo.prestamoId,
              fecha: prestamo.fecha ? new Date(prestamo.fecha).toLocaleDateString("es-HN") : "",
              interes: prestamo.tasa_interes ? `${prestamo.tasa_interes}%` : "",
              descripcion: prestamo.observacion || "Prstamo Inicial",
              abono: null,
              prestamo: Number(prestamo.monto || 0),
              intCargo: null,
              intAbono: null,
              tipo: "PRESTAMO_INICIAL",
              totalGeneral: Number(prestamo.monto || 0),
              estado: prestamo.estado,
            });
          }

          prestamo.movimientos_prestamo?.forEach((mov, idxMov) => {
            if (mov.tipo_movimiento === "ANULADO") return;
            const descripcion = [mov.descripcion || mov.tipo_movimiento, mov.observacion ? `(${mov.observacion})` : ""].filter(Boolean).join(" ");

            filasPrestamos.push({
              key: `mov-${prestamo.prestamoId || idxPrestamo}-${idxMov}`,
              MovimientoId: mov.MovimientoId,
              prestamoId: prestamo.prestamoId,
              fecha: mov.fecha ? new Date(mov.fecha).toLocaleDateString("es-HN") : "",
              descripcion,
              interes: mov.interes ? `${mov.interes}%` : "",
              dias: mov.tipo_movimiento === "Int-Cargo" ? mov.dias || "" : "",
              abono: mov.tipo_movimiento === "ABONO" ? Number(mov.monto || 0) : null,
              prestamo: mov.tipo_movimiento === "PRESTAMO" ? Number(mov.monto || 0) : null,
              intCargo: mov.tipo_movimiento === "Int-Cargo" ? Number(mov.monto || 0) : null,
              intAbono: ["ABONO_INTERES", "PAGO_INTERES"].includes(mov.tipo_movimiento) ? Number(mov.monto || 0) : null,
              tipo: mov.tipo_movimiento,
              totalGeneral: (["PRESTAMO", "Int-Cargo"].includes(mov.tipo_movimiento) ? Number(mov.monto || 0) : 0) -
                           (["ABONO", "ABONO_INTERES", "PAGO_INTERES"].includes(mov.tipo_movimiento) ? Number(mov.monto || 0) : 0),
            });
          });
        });
      }

      // === ANTICIPOS ===
      if (data?.anticipo?.length > 0) {
        data.anticipo.forEach((ant, idxAnt) => {
          const antKey = `anticipo-${ant.anticipoId || idxAnt}`;
          if (!["ANULADO", "ABSORBIDO", "INICIAL"].includes(ant.estado)) {
            filasAnticipos.push({
              key: antKey,
              anticipoId: ant.anticipoId,
              fecha: ant.fecha ? new Date(ant.fecha).toLocaleDateString("es-HN") : "",
              interes: ant.tasa_interes ? `${ant.tasa_interes}%` : "",
              descripcion: ant.observacion || "Anticipo Inicial",
              abono: null,
              anticipo: Number(ant.monto || 0),
              intCargo: null,
              intAbono: null,
              tipo: "ANTICIPO_INICIAL",
              totalGeneral: Number(ant.monto || 0),
              estado: ant.estado,
            });
          }

          ant.movimientos_anticipos?.forEach((mov, idxMov) => {
            if (!mov || mov.tipo_movimiento === "ANULADO") return;
            const descripcion = [mov.descripcion || mov.tipo_movimiento, mov.observacion ? `(${mov.observacion})` : ""].filter(Boolean).join(" ");

            filasAnticipos.push({
              key: `movAnt-${ant.anticipoId}-${idxMov}`,
              MovimientoId: mov.MovimientoId,
              anticipoId: ant.anticipoId,
              fecha: mov.fecha ? new Date(mov.fecha).toLocaleDateString("es-HN") : "",
              descripcion,
              interes: mov.interes ? `${mov.interes}%` : "",
              dias: mov.tipo_movimiento === "CARGO_ANTICIPO" ? mov.dias || "" : "",
              abono: mov.tipo_movimiento === "ABONO_ANTICIPO" ? Number(mov.monto || 0) : null,
              anticipo: ["ANTICIPO"].includes(mov.tipo_movimiento) ? Number(mov.monto || 0) : null,
              intCargo: ["CARGO_ANTICIPO"].includes(mov.tipo_movimiento) ? Number(mov.monto || 0) : null,
              intAbono: mov.tipo_movimiento === "INTERES_ANTICIPO" ? Number(mov.monto || 0) : null,
              tipo: mov.tipo_movimiento,
              totalGeneral: (["ANTICIPO", "CARGO_ANTICIPO"].includes(mov.tipo_movimiento) ? Number(mov.monto || 0) : 0) -
                           (["ABONO_ANTICIPO", "INTERES_ANTICIPO"].includes(mov.tipo_movimiento) ? Number(mov.monto || 0) : 0),
            });
          });
        });
      }

      const calcularTotales = (filas, tipo = "prestamo") => {
        if (filas.length === 0) return [];
        const t = {
          key: "total",
          descripcion: "TOTAL GENERAL",
          abono: filas.reduce((acc, f) => acc + (f.abono || 0), 0),
          intCargo: filas.reduce((acc, f) => acc + (f.intCargo || 0), 0),
          intAbono: filas.reduce((acc, f) => acc + (f.intAbono || 0), 0),
          esTotal: true,
        };
        if (tipo === "prestamo") {
          const tcp = filas.reduce((acc, f) => acc + (f.prestamo || 0) + (f.intCargo || 0), 0);
          const tpa = filas.reduce((acc, f) => acc + (f.abono || 0) + (f.intAbono || 0), 0);
          t.prestamo = filas.reduce((acc, f) => acc + (f.prestamo || 0), 0);
          t.totalGeneral = tcp - tpa;
        } else {
          const tca = filas.reduce((acc, f) => acc + (f.anticipo || 0) + (f.intCargo || 0), 0);
          const tpa = filas.reduce((acc, f) => acc + (f.abono || 0) + (f.intAbono || 0), 0);
          t.anticipo = filas.reduce((acc, f) => acc + (f.anticipo || 0), 0);
          t.totalGeneral = tca - tpa;
        }
        filas.push({ ...t, tipo: "TOTAL" });
        return filas;
      };

      setDataPrestamos(calcularTotales(filasPrestamos, "prestamo"));
      setDataAnticipos(calcularTotales(filasAnticipos, "anticipo"));
    } catch (err) {
      setError("Error al cargar los prstamos y anticipos del cliente");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAnular = useCallback(async (id, tipo, endpoint) => {
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `No se pudo anular`);
      }
      messageApiRef.current.success("Anulado correctamente");
      if (clienteSeleccionado?.clienteID) {
        await cargarPrestamos(clienteSeleccionado.clienteID);
      }
    } catch (err) {
      messageApiRef.current.error(err.message);
    }
  }, [clienteSeleccionado, cargarPrestamos]);

  const columnas = useMemo(() => [
    {
      title: "FECHA",
      dataIndex: "fecha",
      width: 100,
      render: (f, r) => r.esTotal ? "" : <Text style={{ fontSize: "13px" }}>{f}</Text>
    },
    {
      title: "DESCRIPCIN / OBSERVACIN",
      dataIndex: "descripcion",
      width: 250,
      render: (t, r) => {
        if (r.tipo === "TOTAL") return <Text strong style={{ color: "#1e1b4b" }}>{t}</Text>;
        const esInicial = r.tipo?.includes("INICIAL");
        return (
          <Space direction="vertical" size={0}>
            <Text strong={esInicial} style={{ fontSize: "13px", color: esInicial ? "#4f46e5" : "inherit" }}>{t}</Text>
            {r.dias && <Text type="secondary" style={{ fontSize: "11px" }}><Badge status="warning" /> {r.dias} das acumulados</Text>}
          </Space>
        );
      }
    },
    {
      title: "INTERS",
      dataIndex: "interes",
      align: "center",
      width: 80,
      render: (i) => i ? <Tag color="blue" style={{ borderRadius: "6px" }}>{i}</Tag> : ""
    },
    {
      title: "CARGOS (QQ/L)",
      key: "cargos",
      align: "right",
      width: 130,
      render: (_, r) => {
        const val = r.prestamo || r.anticipo || r.intCargo;
        if (!val) return "";
        const esInteres = !!r.intCargo;
        return (
          <Text strong={r.esTotal} style={{ color: esInteres ? "#ef4444" : "#111827" }}>
            {val.toLocaleString("es-HN", { minimumFractionDigits: 2 })}
          </Text>
        );
      }
    },
    {
      title: "ABONOS (L)",
      key: "abonos",
      align: "right",
      width: 130,
      render: (_, r) => {
        const val = r.abono || r.intAbono;
        if (!val) return "";
        return (
          <Text strong={r.esTotal} style={{ color: "#10b981" }}>
            {val.toLocaleString("es-HN", { minimumFractionDigits: 2 })}
          </Text>
        );
      }
    },
    {
      title: "SALDO ACTUAL",
      dataIndex: "totalGeneral",
      align: "right",
      width: 140,
      fixed: isDesktop ? "right" : false,
      render: (v, r) => {
        if (v == null) return "";
        const esNegativo = v > 0; // En este sistema v > 0 significa deuda?
        return (
          <div style={{ padding: "4px 8px", background: r.esTotal ? "#1e1b4b" : "transparent", borderRadius: "6px" }}>
            <Text strong style={{ fontSize: r.esTotal ? "16px" : "14px", color: r.esTotal ? "#fff" : (esNegativo ? "#ef4444" : "#111827") }}>
              L {v.toLocaleString("es-HN", { minimumFractionDigits: 2 })}
            </Text>
          </div>
        );
      }
    },
    {
      title: "",
      key: "acciones",
      fixed: isDesktop ? "right" : false,
      width: 60,
      align: "center",
      render: (_, r) => {
        if (r.esTotal || r.estado === "ANULADO") return null;
        let endpoint = "";
        if (r.tipo?.includes("MOVIMIENTO") || ["ABONO", "PAGO_INTERES", "Int-Cargo", "ABONO_ANTICIPO", "INTERES_ANTICIPO", "CARGO_ANTICIPO"].includes(r.tipo)) {
           endpoint = r.prestamoId ? `/api/prestamos/movimiento/${r.MovimientoId}` : `/api/anticipos/movimiento/${r.MovimientoId}`;
        } else {
           endpoint = r.prestamoId ? `/api/prestamos/${r.prestamoId}` : `/api/anticipos/${r.anticipoId}`;
        }
        return (
          <ProtectedButton allowedRoles={["ADMIN", "GERENCIA"]}>
            <Popconfirm title="¿Confirma anulación?" onConfirm={() => handleAnular(null, "REGISTRO", endpoint)} okType="danger">
              <Button type="text" danger icon={<DeleteFilled />} size="small" />
            </Popconfirm>
          </ProtectedButton>
        );
      }
    }
  ], [isDesktop, handleAnular]);

  const columnasPDFPrestamos = [
    { header: "Fecha", key: "fecha" },
    { header: "Das", key: "dias" },
    { header: "% Inters", key: "interes" },
    { header: "Descripcin", key: "descripcion" },
    { header: "Prstamo", key: "prestamo", format: "numero", isTotal: true },
    { header: "Abono", key: "abono", format: "numero", isTotal: true },
    { header: "Int-Cargo", key: "intCargo", format: "numero", isTotal: true },
    { header: "Int-Abono", key: "intAbono", format: "numero", isTotal: true },
    { header: "Saldo Total", key: "totalGeneral", format: "numero", isTotal: true },
  ];

  const columnasPDFAnticipos = [
    { header: "Fecha", key: "fecha" },
    { header: "Das", key: "dias" },
    { header: "% Inters", key: "interes" },
    { header: "Descripcin", key: "descripcion" },
    { header: "Anticipo", key: "anticipo", format: "numero", isTotal: true },
    { header: "Abono", key: "abono", format: "numero", isTotal: true },
    { header: "Int-Cargo", key: "intCargo", format: "numero", isTotal: true },
    { header: "Int-Abono", key: "intAbono", format: "numero", isTotal: true },
    { header: "Saldo Total", key: "totalGeneral", format: "numero", isTotal: true },
  ];

  const handleImprimir = (tipo) => {
    const esPrestamo = tipo === "prestamos";
    const data = esPrestamo ? dataPrestamos : dataAnticipos;
    const columnasPDF = esPrestamo ? columnasPDFPrestamos : columnasPDFAnticipos;
    const nombre = esPrestamo ? "Prstamos" : "Anticipos";

    if (!data.length) return messageApi.error(`No hay ${nombre.toLowerCase()} para imprimir`);

    const dataPDF = data
      .filter((f) => f.tipo !== "TOTAL")
      .sort((a, b) => {
        const dateA = new Date(a.fecha.split("/").reverse().join("-"));
        const dateB = new Date(b.fecha.split("/").reverse().join("-"));
        return dateA - dateB;
      })
      .map((f) => ({ ...f }));

    generarReportePDF(
      dataPDF,
      { nombreFiltro: `${clienteSeleccionado.clienteNombre} ${clienteSeleccionado.clienteApellido}` },
      columnasPDF,
      {
        title: `${nombre} - ${clienteSeleccionado.clienteNombre} ${clienteSeleccionado.clienteApellido}`,
        orientation: "landscape",
      }
    );
  };

  const handleAgregarPrestamo = async (v) => {
    try {
      setLoading(true);
      let url = "";
      const body = { ...v, clienteID: clienteSeleccionado.clienteID };
      
      if (v.tipo === "PRESTAMO") url = "/api/prestamos";
      else if (v.tipo === "ANTICIPO") url = "/api/anticipos";
      else if (["ABONO_ANTICIPO", "INTERES_ANTICIPO", "CARGO_ANTICIPO"].includes(v.tipo)) url = "/api/anticipos/movimiento";
      else if (["ABONO", "PAGO_INTERES", "Int-Cargo"].includes(v.tipo)) url = "/api/prestamos/movimiento";
      
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        messageApi.success("Registro guardado");
        cargarPrestamos(clienteSeleccionado.clienteID);
        setOpenDrawer(false);
      } else {
        const err = await res.json();
        messageApi.error(err.error || "Error");
      }
    } finally {
      setLoading(false);
    }
  };

  const totals = {
    prestamos: dataPrestamos.find(r => r.esTotal)?.totalGeneral || 0,
    anticipos: dataAnticipos.find(r => r.esTotal)?.totalGeneral || 0,
  };

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "COLABORADORES", "AUDITORES"]}>
      <div style={{ padding: "16px", background: "#f8fafc", minHeight: "100vh" }}>
        {contextHolder}
        
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <Title level={2} style={{ margin: 0, fontWeight: 900, color: "#1e1b4b" }}>
                <AuditOutlined style={{ marginRight: "8px" }} /> Prstamos y Anticipos
              </Title>
              <Space>
                <Button icon={<CalculatorOutlined />} disabled={!clienteSeleccionado} onClick={() => setOpenDrawerInteres(true)}>CALCULAR INTERES</Button>
                <Button type="primary" icon={<PlusOutlined />} disabled={!clienteSeleccionado} onClick={() => setOpenDrawer(true)} style={{ background: "#4f46e5" }}>NUEVO MOVIMIENTO</Button>
              </Space>
            </div>
          </Col>

          {/* Buscador de Cliente */}
          <Col span={24}>
            <Card size="small" style={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}>
              <Row gutter={16} align="middle">
                <Col xs={24} md={12}>
                  <Text strong style={{ display: "block", marginBottom: "4px" }}>Seleccione un Cliente:</Text>
                  <Select
                    showSearch
                    placeholder="Escriba nombre del cliente..."
                    style={{ width: "100%" }}
                    options={clientes.map(c => ({ label: `${c.clienteNombre} ${c.clienteApellido}`, value: c.clienteID }))}
                    onChange={cargarPrestamos}
                    filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
                  />
                </Col>
                <Col xs={24} md={12}>
                   {clienteSeleccionado && (
                     <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px", background: "#f1f5f9", borderRadius: "10px" }}>
                       <Avatar icon={<UserOutlined />} style={{ background: "#1e1b4b" }} />
                       <div>
                         <Text strong style={{ fontSize: "15px" }}>{clienteSeleccionado.clienteNombre} {clienteSeleccionado.clienteApellido}</Text>
                         <Text type="secondary" style={{ display: "block", fontSize: "11px" }}>RTN: {clienteSeleccionado.clienteRTN || "N/A"}</Text>
                       </div>
                     </div>
                   )}
                </Col>
              </Row>
            </Card>
          </Col>

          {clienteSeleccionado ? (
            <>
              {/* Resumen de Deuda */}
              <Col span={24}>
                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                      <Statistic title="DEUDA PRSTAMOS" value={totals.prestamos} prefix="L" precision={2} valueStyle={{ color: "#ef4444", fontWeight: 800 }} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                      <Statistic title="DEUDA ANTICIPOS" value={totals.anticipos} prefix="L" precision={2} valueStyle={{ color: "#f59e0b", fontWeight: 800 }} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ borderRadius: "15px", border: "none", background: "#1e1b4b" }}>
                      <Statistic title={<span style={{ color: "#94a3b8" }}>SALDO TOTAL PENDIENTE</span>} value={totals.prestamos + totals.anticipos} prefix="L" precision={2} valueStyle={{ color: "#fff", fontWeight: 900 }} />
                    </Card>
                  </Col>
                </Row>
              </Col>

              {/* Secciones de Tablas */}
              <Col span={24}>
                <Card 
                  size="small" 
                  title={<span style={{ fontWeight: 800 }}><RiseOutlined /> ESTADO DE CUENTA: PRSTAMOS</span>}
                  extra={<Button type="link" size="small" icon={<FilePdfOutlined />} onClick={() => handleImprimir("prestamos")}>Imprimir Estado</Button>}
                  style={{ borderRadius: "12px", border: "none", marginBottom: "16px" }}
                  styles={{ body: { padding: 0 } }}
                >
                  <Table 
                    columns={columnas.filter(c => c.dataIndex !== "anticipo")} 
                    dataSource={dataPrestamos} 
                    loading={loading} 
                    pagination={false} 
                    scroll={{ x: 1000 }}
                    size="small"
                  />
                </Card>

                <Card 
                  size="small" 
                  title={<span style={{ fontWeight: 800 }}><FallOutlined /> ESTADO DE CUENTA: ANTICIPOS</span>}
                  extra={<Button type="link" size="small" icon={<FilePdfOutlined />} onClick={() => handleImprimir("anticipos")}>Imprimir Estado</Button>}
                  style={{ borderRadius: "12px", border: "none" }}
                  styles={{ body: { padding: 0 } }}
                >
                  <Table 
                    columns={columnas.filter(c => c.dataIndex !== "prestamo")} 
                    dataSource={dataAnticipos} 
                    loading={loading} 
                    pagination={false} 
                    scroll={{ x: 1000 }}
                    size="small"
                  />
                </Card>
              </Col>
            </>
          ) : (
            <Col span={24}>
              <Empty description="Seleccione un cliente para ver su estado de cuenta" />
            </Col>
          )}
        </Row>

        <DrawerPrestamo open={openDrawer} onClose={() => setOpenDrawer(false)} onFinish={handleAgregarPrestamo} clienteSeleccionado={clienteSeleccionado} tipoPersona="cliente" />
        <DrawerCalculoInteres open={openDrawerInteres} onClose={() => setOpenDrawerInteres(false)} onSubmit={handleAgregarPrestamo} clienteSeleccionado={clienteSeleccionado} tipoPersona="cliente" />
      </div>
    </ProtectedPage>
  );
}
