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
  Descriptions,
  Row,
  Col,
  Tag,
  Empty,
  message,
  Button,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  CalculatorOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import DrawerPrestamo from "@/components/Prestamos/DrawerPrestamo.jsx";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import DrawerCalculoInteres from "@/components/Prestamos/calculoInteres";
import ProtectedPage from "@/components/ProtectedPage";
import ProtectedButton from "@/components/ProtectedButton";
import { DeleteFilled, FilePdfOutlined } from "@ant-design/icons";
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
  const drawerFormRef = useRef(null);
  const [dataPrestamos, setDataPrestamos] = useState([]);

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

  const cargarPrestamos = useCallback(
    async (compradorId) => {
      if (!compradorId) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/prestamosCompradores/${compradorId}`);
        if (!res.ok) throw new Error("Error al cargar préstamos");

        const data = await res.json();
        // data.prestamos es el array que viene del backend

        const compradorC = compradores.find(
          (c) => c.compradorId === compradorId,
        );
        setCompradorSeleccionado(compradorC);

        const filasPrestamos = [];

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

        // Calcular Totales
        const calcularTotales = (filas) => {
          if (filas.length === 0) return [];
          const t = {
            key: "total",
            descripcion: "Total general",
            abono: filas.reduce((acc, f) => acc + (f.abono || 0), 0),
            intCargo: filas.reduce((acc, f) => acc + (f.intCargo || 0), 0),
            intAbono: filas.reduce((acc, f) => acc + (f.intAbono || 0), 0),
            prestamo: filas.reduce((acc, f) => acc + (f.prestamo || 0), 0),
            esTotal: true,
          };
          t.totalGeneral = t.prestamo + t.intCargo - (t.abono + t.intAbono);
          filas.push({ ...t, tipo: "TOTAL" });
          return filas;
        };

        setDataPrestamos(calcularTotales(filasPrestamos));
      } catch (err) {
        setError("Error al cargar los préstamos del comprador");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [compradores],
  );

  const handleAnular = useCallback(
    async (id, endpoint) => {
      try {
        const res = await fetch(endpoint, { method: "DELETE" });
        if (!res.ok) throw new Error("No se pudo anular");
        messageApiRef.current.success("Anulado correctamente");
        if (compradorSeleccionado)
          cargarPrestamos(compradorSeleccionado.compradorId);
      } catch (err) {
        messageApiRef.current.error(err.message);
      }
    },
    [compradorSeleccionado, cargarPrestamos],
  );

  const columnas = useMemo(
    () => [
      { title: "Fecha", dataIndex: "fecha", width: 110 },
      { title: "Días", dataIndex: "dias", align: "center", width: 80 },
      { title: "% Interés", dataIndex: "interes", align: "center", width: 90 },
      { title: "Descripción", dataIndex: "descripcion", width: 250 },
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
                handleAnular(record.MovimientoId || record.prestamoId, endpoint)
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
      const isMov = ["ABONO", "PAGO_INTERES", "Int-Cargo"].includes(v.tipo);
      const url = isMov
        ? "/api/prestamosCompradores/movimiento"
        : "/api/prestamosCompradores";
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
        cargarPrestamos(compradorSeleccionado.compradorId);
        setOpenDrawer(false);
      } else {
        const d = await res.json();
        messageApiRef.current.error(d.error || "Error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "COLABORADORES"]}>
      {contextHolder}
      <div style={{ padding: 24, background: "#f0f2f5", minHeight: "100vh" }}>
        <Card title={<Title level={3}>Préstamos a Compradores</Title>}>
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
                  onChange={(val) => cargarPrestamos(val)}
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
              <Table
                columns={columnas}
                dataSource={dataPrestamos}
                loading={loading}
                pagination={false}
                bordered
              />
            )}
          </Space>
        </Card>

        <DrawerPrestamo
          open={openDrawer}
          onClose={() => setOpenDrawer(false)}
          onFinish={handleAgregar}
          clienteSeleccionado={compradorSeleccionado} // Se pasa el objeto para que el drawer funcione
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
