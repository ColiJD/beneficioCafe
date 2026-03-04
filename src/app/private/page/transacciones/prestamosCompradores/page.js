"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Table,
  Card,
  Select,
  Typography,
  Space,
  Divider,
  Spin,
  Row,
  Col,
  message,
  Button,
  Popconfirm,
  Tag,
} from "antd";
import {
  PlusOutlined,
  CalculatorOutlined,
  DeleteFilled,
  FilePdfOutlined,
} from "@ant-design/icons";
import DrawerPrestamo from "@/components/Prestamos/DrawerPrestamo.jsx";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import DrawerCalculoInteres from "@/components/Prestamos/calculoInteres";
import ProtectedPage from "@/components/ProtectedPage";
import ProtectedButton from "@/components/ProtectedButton";
import { generarReportePDF } from "@/Doc/Reportes/FormatoDoc";

const { Title, Text } = Typography;

export default function PrestamosCompradores() {
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

  const cargarDatos = useCallback(
    async (compradorId) => {
      if (!compradorId) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/prestamosCompradores/${compradorId}`);
        if (!res.ok) throw new Error("Error al cargar préstamos y anticipos");

        const data = await res.json();
        const compradorC = compradores.find(
          (c) => c.compradorId === compradorId,
        );
        setCompradorSeleccionado(compradorC);

        const filasPrestamos = [];
        const filasAnticipos = [];

        // === 🔹 PRÉSTAMOS ===
        if (data?.prestamos?.length > 0) {
          data.prestamos.forEach((prestamo, idxPrestamo) => {
            const prestamoKey = `prestamo-${prestamo.prestamoId || idxPrestamo}`;

            if (!["ANULADO", "ABSORBIDO"].includes(prestamo.estado)) {
              filasPrestamos.push({
                key: prestamoKey,
                prestamoId: prestamo.prestamoId,
                fecha: prestamo.fecha
                  ? new Date(prestamo.fecha).toLocaleDateString("es-HN")
                  : "",
                interes: prestamo.tasa_interes
                  ? `${prestamo.tasa_interes}%`
                  : "",
                descripcion: prestamo.observacion || "Préstamo",
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
                fecha: mov.fecha
                  ? new Date(mov.fecha).toLocaleDateString("es-HN")
                  : "",
                descripcion: mov.descripcion || mov.tipo_movimiento,
                interes: mov.interes ? `${mov.interes}%` : "",
                dias: mov.tipo_movimiento === "Int-Cargo" ? mov.dias || "" : "",
                abono:
                  mov.tipo_movimiento === "ABONO"
                    ? Number(mov.monto || 0)
                    : null,
                prestamo:
                  mov.tipo_movimiento === "PRESTAMO"
                    ? Number(mov.monto || 0)
                    : null,
                intCargo:
                  mov.tipo_movimiento === "Int-Cargo"
                    ? Number(mov.monto || 0)
                    : null,
                intAbono: ["ABONO_INTERES", "PAGO_INTERES"].includes(
                  mov.tipo_movimiento,
                )
                  ? Number(mov.monto || 0)
                  : null,
                tipo: mov.tipo_movimiento,
                totalGeneral:
                  (["PRESTAMO", "Int-Cargo"].includes(mov.tipo_movimiento)
                    ? Number(mov.monto || 0)
                    : 0) -
                  (["ABONO", "ABONO_INTERES", "PAGO_INTERES"].includes(
                    mov.tipo_movimiento,
                  )
                    ? Number(mov.monto || 0)
                    : 0),
              });
            });
          });
        }

        // === 🔹 ANTICIPOS ===
        if (data?.anticipos?.length > 0) {
          data.anticipos.forEach((ant, idxAnt) => {
            const antKey = `anticipo-${ant.anticipoId || idxAnt}`;
            if (!["ANULADO", "ABSORBIDO"].includes(ant.estado)) {
              filasAnticipos.push({
                key: antKey,
                anticipoId: ant.anticipoId,
                fecha: ant.fecha
                  ? new Date(ant.fecha).toLocaleDateString("es-HN")
                  : "",
                interes: ant.tasa_interes ? `${ant.tasa_interes}%` : "",
                descripcion: ant.observacion || "Anticipo",
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
                fecha: mov.fecha
                  ? new Date(mov.fecha).toLocaleDateString("es-HN")
                  : "",
                descripcion: mov.descripcion || mov.tipo_movimiento,
                interes: mov.interes ? `${mov.interes}%` : "",
                dias:
                  mov.tipo_movimiento === "CARGO_ANTICIPO"
                    ? mov.dias || ""
                    : "",
                abono:
                  mov.tipo_movimiento === "ABONO_ANTICIPO"
                    ? Number(mov.monto || 0)
                    : null,
                anticipo: ["ANTICIPO"].includes(mov.tipo_movimiento)
                  ? Number(mov.monto || 0)
                  : null,
                intCargo: ["CARGO_ANTICIPO"].includes(mov.tipo_movimiento)
                  ? Number(mov.monto || 0)
                  : null,
                intAbono:
                  mov.tipo_movimiento === "INTERES_ANTICIPO"
                    ? Number(mov.monto || 0)
                    : null,
                tipo: mov.tipo_movimiento,
                totalGeneral:
                  (["ANTICIPO", "CARGO_ANTICIPO"].includes(mov.tipo_movimiento)
                    ? Number(mov.monto || 0)
                    : 0) -
                  (["ABONO_ANTICIPO", "INTERES_ANTICIPO"].includes(
                    mov.tipo_movimiento,
                  )
                    ? Number(mov.monto || 0)
                    : 0),
              });
            });
          });
        }

        // Calcular Totales
        const calcularTotales = (filas, tipo = "prestamo") => {
          if (filas.length === 0) return [];
          const t = {
            key: "total",
            descripcion: "Total general",
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
        setError("Error al cargar los préstamos y anticipos del comprador");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [compradores],
  );

  const handleAnular = useCallback(
    async (id, tipo, endpoint) => {
      try {
        const res = await fetch(endpoint, { method: "DELETE" });
        if (!res.ok) throw new Error("No se pudo anular");
        messageApiRef.current.success("Anulado correctamente");
        if (compradorSeleccionado)
          cargarDatos(compradorSeleccionado.compradorId);
      } catch (err) {
        messageApiRef.current.error(err.message);
      }
    },
    [compradorSeleccionado, cargarDatos],
  );

  const columnasBase = [
    { title: "Fecha", dataIndex: "fecha", width: 110 },
    { title: "Días", dataIndex: "dias", align: "center", width: 80 },
    { title: "% Interés", dataIndex: "interes", align: "center", width: 90 },
    { title: "Descripción", dataIndex: "descripcion", width: 250 },
  ];

  const columnasPrestamos = useMemo(
    () => [
      ...columnasBase,
      {
        title: "Préstamo",
        dataIndex: "prestamo",
        align: "right",
        width: 120,
        render: (v) => v?.toLocaleString("es-HN", { minimumFractionDigits: 2 }),
      },
      {
        title: "Abono",
        dataIndex: "abono",
        align: "right",
        width: 120,
        render: (v) => v?.toLocaleString("es-HN", { minimumFractionDigits: 2 }),
      },
      {
        title: "Int-Cargo",
        dataIndex: "intCargo",
        align: "right",
        width: 120,
        render: (v) => v?.toLocaleString("es-HN", { minimumFractionDigits: 2 }),
      },
      {
        title: "Saldo Total",
        dataIndex: "totalGeneral",
        align: "right",
        width: 140,
        render: (v) => (
          <Text strong style={{ color: v > 0 ? "red" : "black" }}>
            {v?.toLocaleString("es-HN", { minimumFractionDigits: 2 })}
          </Text>
        ),
      },
      {
        title: "Acciones",
        key: "acciones",
        width: 100,
        render: (_, record) => {
          if (record.tipo === "TOTAL") return null;
          const endpoint = record.MovimientoId
            ? `/api/prestamosCompradores/movimiento/${record.MovimientoId}`
            : `/api/prestamosCompradores/${record.prestamoId}`;
          return (
            <Popconfirm
              title="¿Anular?"
              onConfirm={() =>
                handleAnular(
                  record.MovimientoId || record.prestamoId,
                  "PRESTAMO",
                  endpoint,
                )
              }
            >
              <Button size="small" danger icon={<DeleteFilled />} />
            </Popconfirm>
          );
        },
      },
    ],
    [handleAnular],
  );

  const columnasAnticipos = useMemo(
    () => [
      ...columnasBase,
      {
        title: "Anticipo",
        dataIndex: "anticipo",
        align: "right",
        width: 120,
        render: (v) => v?.toLocaleString("es-HN", { minimumFractionDigits: 2 }),
      },
      {
        title: "Abono",
        dataIndex: "abono",
        align: "right",
        width: 120,
        render: (v) => v?.toLocaleString("es-HN", { minimumFractionDigits: 2 }),
      },
      {
        title: "Int-Cargo",
        dataIndex: "intCargo",
        align: "right",
        width: 120,
        render: (v) => v?.toLocaleString("es-HN", { minimumFractionDigits: 2 }),
      },
      {
        title: "Saldo Total",
        dataIndex: "totalGeneral",
        align: "right",
        width: 140,
        render: (v) => (
          <Text strong style={{ color: v > 0 ? "red" : "black" }}>
            {v?.toLocaleString("es-HN", { minimumFractionDigits: 2 })}
          </Text>
        ),
      },
      {
        title: "Acciones",
        key: "acciones",
        width: 100,
        render: (_, record) => {
          if (record.tipo === "TOTAL") return null;
          const endpoint = record.MovimientoId
            ? `/api/anticiposCompradores/movimiento/${record.MovimientoId}`
            : `/api/anticiposCompradores/${record.anticipoId}`;
          return (
            <Popconfirm
              title="¿Anular?"
              onConfirm={() =>
                handleAnular(
                  record.MovimientoId || record.anticipoId,
                  "ANTICIPO",
                  endpoint,
                )
              }
            >
              <Button size="small" danger icon={<DeleteFilled />} />
            </Popconfirm>
          );
        },
      },
    ],
    [handleAnular],
  );

  const handleAgregar = async (v) => {
    try {
      setLoading(true);
      let url = "";

      if (v.tipo === "PRESTAMO") {
        url = "/api/prestamosCompradores";
      } else if (v.tipo === "ANTICIPO") {
        url = "/api/anticiposCompradores";
      } else if (["ABONO", "PAGO_INTERES", "Int-Cargo"].includes(v.tipo)) {
        url = "/api/prestamosCompradores/movimiento";
      } else if (
        ["ABONO_ANTICIPO", "INTERES_ANTICIPO", "CARGO_ANTICIPO"].includes(
          v.tipo,
        )
      ) {
        url = "/api/anticiposCompradores/movimiento";
      }

      const body = {
        compradorID: compradorSeleccionado.compradorId,
        monto: v.monto,
        fecha: v.fecha,
        tasa_interes: v.tasa_interes,
        observacion: v.observacion,
        tipo_movimiento: v.tipo,
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        messageApiRef.current.success("Guardado");
        cargarDatos(compradorSeleccionado.compradorId);
        setOpenDrawer(false);
      } else {
        const d = await res.json();
        messageApiRef.current.error(d.error || "Error");
      }
    } catch (err) {
      messageApiRef.current.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = (tipo) => {
    const esPrestamo = tipo === "prestamos";
    const data = esPrestamo ? dataPrestamos : dataAnticipos;
    const nombre = esPrestamo ? "Préstamos" : "Anticipos";

    if (!data.length) {
      messageApiRef.current.error(
        `No hay ${nombre.toLowerCase()} para imprimir`,
      );
      return;
    }

    const columnasPDF = [
      { header: "Fecha", key: "fecha" },
      { header: "Días", key: "dias" },
      { header: "% Interés", key: "interes" },
      { header: "Descripción", key: "descripcion" },
      {
        header: esPrestamo ? "Préstamo" : "Anticipo",
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

    const dataPDF = data
      .filter((f) => f.tipo !== "TOTAL")
      .map((f) => ({ ...f }));

    generarReportePDF(
      dataPDF,
      { nombreFiltro: compradorSeleccionado.compradorNombre },
      columnasPDF,
      {
        title: `${nombre} - ${compradorSeleccionado.compradorNombre}`,
        orientation: "landscape",
      },
    );
  };

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "COLABORADORES"]}>
      {contextHolder}
      <div style={{ padding: 24, background: "#f0f2f5", minHeight: "100vh" }}>
        <Card
          title={<Title level={3}>Préstamos y Anticipos a Compradores</Title>}
        >
          <Space direction="vertical" style={{ width: "100%" }}>
            <Row gutter={16} align="middle">
              <Col span={12}>
                <Select
                  showSearch
                  placeholder="Seleccione un comprador"
                  style={{ width: "100%" }}
                  options={compradores.map((c) => ({
                    label: c.compradorNombre,
                    value: c.compradorId,
                  }))}
                  onChange={(val) => cargarDatos(val)}
                  filterOption={(input, option) =>
                    (option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Col>
              <Col span={12} style={{ textAlign: "right" }}>
                <Space>
                  <Button
                    icon={<CalculatorOutlined />}
                    disabled={!compradorSeleccionado}
                    onClick={() => setOpenDrawerInteres(true)}
                  >
                    Calcular Interés
                  </Button>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!compradorSeleccionado}
                    onClick={() => setOpenDrawer(true)}
                  >
                    Nuevo Movimiento
                  </Button>
                </Space>
              </Col>
            </Row>

            <Divider />

            {compradorSeleccionado && (
              <>
                <Title level={4}>Sección de Préstamos</Title>
                <div style={{ marginBottom: 16, textAlign: "right" }}>
                  <Button
                    icon={<FilePdfOutlined />}
                    onClick={() => handleImprimir("prestamos")}
                  >
                    Imprimir PDF
                  </Button>
                </div>
                <Table
                  columns={columnasPrestamos}
                  dataSource={dataPrestamos}
                  loading={loading}
                  pagination={false}
                  bordered
                  style={{ marginBottom: 32 }}
                />

                <Title level={4}>Sección de Anticipos</Title>
                <div style={{ marginBottom: 16, textAlign: "right" }}>
                  <Button
                    icon={<FilePdfOutlined />}
                    onClick={() => handleImprimir("anticipos")}
                  >
                    Imprimir PDF
                  </Button>
                </div>
                <Table
                  columns={columnasAnticipos}
                  dataSource={dataAnticipos}
                  loading={loading}
                  pagination={false}
                  bordered
                />
              </>
            )}
          </Space>
        </Card>

        <DrawerPrestamo
          open={openDrawer}
          onClose={() => setOpenDrawer(false)}
          onFinish={handleAgregar}
          clienteSeleccionado={compradorSeleccionado}
          tipoPersona="comprador"
        />

        <DrawerCalculoInteres
          open={openDrawerInteres}
          onClose={() => setOpenDrawerInteres(false)}
          onSubmit={handleAgregar}
          clienteSeleccionado={compradorSeleccionado}
          tipoPersona="comprador"
        />
      </div>
    </ProtectedPage>
  );
}
