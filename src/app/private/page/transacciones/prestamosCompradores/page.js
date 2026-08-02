"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Table, Card, Select, Typography, Space, Divider,
  Spin, Row, Col, message, Button, Popconfirm, Tag,
  Grid, Statistic, Empty, Avatar, Badge
} from "antd";
import {
  PlusOutlined, CalculatorOutlined, DeleteFilled,
  FilePdfOutlined, ShopOutlined, TransactionOutlined,
  DollarOutlined, RiseOutlined, FallOutlined,
  UserOutlined, AuditOutlined
} from "@ant-design/icons";
import DrawerPrestamo from "@/components/Prestamos/DrawerPrestamo.jsx";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import DrawerCalculoInteres from "@/components/Prestamos/calculoInteres";
import ProtectedPage from "@/components/ProtectedPage";
import ProtectedButton from "@/components/ProtectedButton";
import { generarReportePDF } from "@/Doc/Reportes/FormatoDoc";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function PrestamosCompradores() {
  const screens = useBreakpoint();
  const [compradores, setCompradores] = useState([]);
  const [compradorSeleccionado, setCompradorSeleccionado] = useState(null);
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
    const cargarCompradores = async () => {
      try {
        const res = await fetch("/api/compradores");
        if (!res.ok) throw new Error("Error al cargar compradores");
        const data = await res.json();
        setCompradores(data);
      } catch (err) {
        setError("No se pudieron cargar los compradores");
        console.error(err);
      }
    };
    cargarCompradores();
  }, []);

  const cargarDatos = useCallback(async (compradorId) => {
    if (!compradorId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/prestamosCompradores/${compradorId}`);
      if (!res.ok) throw new Error("Error al cargar prstamos y anticipos");

      const data = await res.json();
      const compradorC = compradores.find(c => c.compradorId === compradorId);
      setCompradorSeleccionado(compradorC);

      const filasPrestamos = [];
      const filasAnticipos = [];

      // === PRSTAMOS ===
      if (data?.prestamos?.length > 0) {
        data.prestamos.forEach((prestamo, idxPrestamo) => {
          const prestamoKey = `prestamo-${prestamo.prestamoId || idxPrestamo}`;
          if (!["ANULADO", "ABSORBIDO"].includes(prestamo.estado)) {
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
            filasPrestamos.push({
              key: `mov-${prestamo.prestamoId}-${idxMov}`,
              MovimientoId: mov.MovimientoId,
              prestamoId: prestamo.prestamoId,
              fecha: mov.fecha ? new Date(mov.fecha).toLocaleDateString("es-HN") : "",
              descripcion: mov.descripcion || mov.tipo_movimiento,
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
      if (data?.anticipos?.length > 0) {
        data.anticipos.forEach((ant, idxAnt) => {
          const antKey = `anticipo-${ant.anticipoId || idxAnt}`;
          if (!["ANULADO", "ABSORBIDO"].includes(ant.estado)) {
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
            filasAnticipos.push({
              key: `movAnt-${ant.anticipoId}-${idxMov}`,
              MovimientoId: mov.MovimientoId,
              anticipoId: ant.anticipoId,
              fecha: mov.fecha ? new Date(mov.fecha).toLocaleDateString("es-HN") : "",
              descripcion: mov.descripcion || mov.tipo_movimiento,
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
          t.prestamo = filas.reduce((acc, f) => acc + (f.prestamo || 0), 0);
          t.totalGeneral = t.prestamo + t.intCargo - (t.abono + t.intAbono);
        } else {
          t.anticipo = filas.reduce((acc, f) => acc + (f.anticipo || 0), 0);
          t.totalGeneral = t.anticipo + t.intCargo - (t.abono + t.intAbono);
        }
        filas.push({ ...t, tipo: "TOTAL" });
        return filas;
      };

      setDataPrestamos(calcularTotales(filasPrestamos, "prestamo"));
      setDataAnticipos(calcularTotales(filasAnticipos, "anticipo"));
    } catch (err) {
      setError("Error al cargar los prstamos y anticipos del comprador");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [compradores]);

  const handleAnular = useCallback(async (id, tipo, endpoint) => {
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo anular");
      messageApiRef.current.success("Anulado correctamente");
      if (compradorSeleccionado) cargarDatos(compradorSeleccionado.compradorId);
    } catch (err) {
      messageApiRef.current.error(err.message);
    }
  }, [compradorSeleccionado, cargarDatos]);

  const columnasBase = [
    { title: "FECHA", dataIndex: "fecha", width: 100, render: (f, r) => r.esTotal ? "" : <Text style={{ fontSize: "13px" }}>{f}</Text> },
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
  ];

  const renderColumnMoney = (val, r) => {
    if (!val) return "";
    return (
      <Text strong={r.esTotal} style={{ color: r.esTotal ? "inherit" : (r.intCargo ? "#ef4444" : (r.abono ? "#10b981" : "#111827")) }}>
        {val.toLocaleString("es-HN", { minimumFractionDigits: 2 })}
      </Text>
    );
  };

  const columnasTablas = (esAnticipo = false) => [
    ...columnasBase,
    {
      title: esAnticipo ? "ANTICIPOS (L)" : "PRSTAMOS (L)",
      dataIndex: esAnticipo ? "anticipo" : "prestamo",
      align: "right",
      width: 130,
      render: (v, r) => renderColumnMoney(v, r),
    },
    {
      title: "ABONOS (L)",
      dataIndex: "abono",
      align: "right",
      width: 120,
      render: (v, r) => renderColumnMoney(v, r),
    },
    {
      title: "CARGOS INT.",
      dataIndex: "intCargo",
      align: "right",
      width: 120,
      render: (v, r) => renderColumnMoney(v, r),
    },
    {
      title: "SALDO TOTAL",
      dataIndex: "totalGeneral",
      align: "right",
      width: 140,
      fixed: isDesktop ? "right" : false,
      render: (v, r) => (
        <div style={{ padding: "4px 8px", background: r.esTotal ? "#1e1b4b" : "transparent", borderRadius: "6px" }}>
          <Text strong style={{ fontSize: r.esTotal ? "16px" : "14px", color: r.esTotal ? "#fff" : (v > 0 ? "#ef4444" : "#111827") }}>
            L {v?.toLocaleString("es-HN", { minimumFractionDigits: 2 })}
          </Text>
        </div>
      ),
    },
    {
      title: "",
      key: "acciones",
      width: 60,
      align: "center",
      fixed: isDesktop ? "right" : false,
      render: (_, r) => {
        if (r.tipo === "TOTAL") return null;
        const endpoint = r.MovimientoId
          ? (r.prestamoId ? `/api/prestamosCompradores/movimiento/${r.MovimientoId}` : `/api/anticiposCompradores/movimiento/${r.MovimientoId}`)
          : (r.prestamoId ? `/api/prestamosCompradores/${r.prestamoId}` : `/api/anticiposCompradores/${r.anticipoId}`);
        return (
          <ProtectedButton allowedRoles={["ADMIN", "GERENCIA"]}>
            <Popconfirm title="¿Confirma anulación?" onConfirm={() => handleAnular(null, "REGISTRO", endpoint)} okType="danger">
              <Button type="text" danger icon={<DeleteFilled />} size="small" />
            </Popconfirm>
          </ProtectedButton>
        );
      },
    },
  ];

  const handleImprimir = (tipo) => {
    const esPrestamo = tipo === "prestamos";
    const data = esPrestamo ? dataPrestamos : dataAnticipos;
    const nombre = esPrestamo ? "Prstamos" : "Anticipos";

    if (!data.length) return messageApi.error(`No hay ${nombre.toLowerCase()} para imprimir`);

    const columnasPDF = [
      { header: "Fecha", key: "fecha" },
      { header: "Das", key: "dias" },
      { header: "% Inters", key: "interes" },
      { header: "Descripcin", key: "descripcion" },
      {
        header: esPrestamo ? "Prstamo" : "Anticipo",
        key: esPrestamo ? "prestamo" : "anticipo",
        format: "numero",
        isTotal: true,
      },
      { header: "Abono", key: "abono", format: "numero", isTotal: true },
      { header: "Int-Cargo", key: "intCargo", format: "numero", isTotal: true },
      {
        header: "Saldo Total",
        key: "totalGeneral",
        format: "numero",
        isTotal: true,
      },
    ];

    const dataPDF = data.filter((f) => f.tipo !== "TOTAL").map((f) => ({ ...f }));

    generarReportePDF(
      dataPDF,
      { nombreFiltro: compradorSeleccionado.compradorNombre },
      columnasPDF,
      {
        title: `${nombre} - ${compradorSeleccionado.compradorNombre}`,
        orientation: "landscape",
      }
    );
  };

  const handleAgregar = async (v) => {
    try {
      setLoading(true);
      let url = "";
      if (v.tipo === "PRESTAMO") url = "/api/prestamosCompradores";
      else if (v.tipo === "ANTICIPO") url = "/api/anticiposCompradores";
      else if (["ABONO", "PAGO_INTERES", "Int-Cargo"].includes(v.tipo)) url = "/api/prestamosCompradores/movimiento";
      else if (["ABONO_ANTICIPO", "INTERES_ANTICIPO", "CARGO_ANTICIPO"].includes(v.tipo)) url = "/api/anticiposCompradores/movimiento";

      const body = { ...v, compradorID: compradorSeleccionado.compradorId, tipo_movimiento: v.tipo };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        messageApi.success("Guardado correctamente");
        cargarDatos(compradorSeleccionado.compradorId);
        setOpenDrawer(false);
      } else {
        const d = await res.json();
        messageApi.error(d.error || "Error");
        throw new Error(d.error || "Error");
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
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "COLABORADORES"]}>
      <div style={{ padding: "16px", background: "#f8fafc", minHeight: "100vh" }}>
        {contextHolder}
        
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <Title level={2} style={{ margin: 0, fontWeight: 900, color: "#1e1b4b" }}>
                <ShopOutlined style={{ marginRight: "8px" }} /> Prstamos Compradores
              </Title>
              <Space>
                <Button icon={<CalculatorOutlined />} disabled={!compradorSeleccionado} onClick={() => setOpenDrawerInteres(true)}>CALCULAR INTERES</Button>
                <Button type="primary" icon={<PlusOutlined />} disabled={!compradorSeleccionado} onClick={() => setOpenDrawer(true)} style={{ background: "#4f46e5" }}>NUEVO MOVIMIENTO</Button>
              </Space>
            </div>
          </Col>

          {/* Buscador de Comprador */}
          <Col span={24}>
            <Card size="small" style={{ borderRadius: "12px", border: "1px solid #e5e7eb" }}>
              <Row gutter={16} align="middle">
                <Col xs={24} md={12}>
                  <Text strong style={{ display: "block", marginBottom: "4px" }}>Seleccione un Comprador:</Text>
                  <Select
                    showSearch
                    placeholder="Escriba nombre del comprador..."
                    style={{ width: "100%" }}
                    options={compradores.map(c => ({ label: c.compradorNombre, value: c.compradorId }))}
                    onChange={cargarDatos}
                    filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
                  />
                </Col>
                <Col xs={24} md={12}>
                   {compradorSeleccionado && (
                     <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px", background: "#f1f5f9", borderRadius: "10px" }}>
                       <Avatar icon={<UserOutlined />} style={{ background: "#1e1b4b" }} />
                       <div>
                         <Text strong style={{ fontSize: "15px" }}>{compradorSeleccionado.compradorNombre}</Text>
                         <Text type="secondary" style={{ display: "block", fontSize: "11px" }}>Auditora de cuenta activa</Text>
                       </div>
                     </div>
                   )}
                </Col>
              </Row>
            </Card>
          </Col>

          {compradorSeleccionado ? (
            <>
              {/* Estadsticas */}
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
                      <Statistic title={<span style={{ color: "#94a3b8" }}>SALDO CONSOLIDADO</span>} value={totals.prestamos + totals.anticipos} prefix="L" precision={2} valueStyle={{ color: "#fff", fontWeight: 900 }} />
                    </Card>
                  </Col>
                </Row>
              </Col>

              {/* Tablas */}
              <Col span={24}>
                <Card 
                  size="small" 
                  title={<span style={{ fontWeight: 800 }}><RiseOutlined /> CUENTA DE PRSTAMOS</span>}
                  extra={<Button type="link" size="small" icon={<FilePdfOutlined />} onClick={() => handleImprimir("prestamos")}>Exportar PDF</Button>}
                  style={{ borderRadius: "12px", border: "none", marginBottom: "16px" }}
                  styles={{ body: { padding: 0 } }}
                >
                  <Table 
                    columns={columnasTablas(false)} 
                    dataSource={dataPrestamos} 
                    loading={loading} 
                    pagination={false} 
                    scroll={{ x: 1000 }}
                    size="small"
                  />
                </Card>

                <Card 
                  size="small" 
                  title={<span style={{ fontWeight: 800 }}><FallOutlined /> CUENTA DE ANTICIPOS</span>}
                  extra={<Button type="link" size="small" icon={<FilePdfOutlined />} onClick={() => handleImprimir("anticipos")}>Exportar PDF</Button>}
                  style={{ borderRadius: "12px", border: "none" }}
                  styles={{ body: { padding: 0 } }}
                >
                  <Table 
                    columns={columnasTablas(true)} 
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
              <Empty description="Seleccione un comprador para gestionar su cartera" />
            </Col>
          )}
        </Row>

        <DrawerPrestamo open={openDrawer} onClose={() => setOpenDrawer(false)} onFinish={handleAgregar} compradorSeleccionado={compradorSeleccionado} tipoPersona="comprador" />
        <DrawerCalculoInteres open={openDrawerInteres} onClose={() => setOpenDrawerInteres(false)} onSubmit={handleAgregar} compradorSeleccionado={compradorSeleccionado} tipoPersona="comprador" />
      </div>
    </ProtectedPage>
  );
}
