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
import { DeleteFilled, FilePdfOutlined } from "@ant-design/icons";
import { generarReportePDF } from "@/Doc/Reportes/FormatoDoc";

const { Title, Text } = Typography;

export default function PrestamosGeneral() {
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [dataTabla, setDataTabla] = useState([]);
  const { mounted, isDesktop } = useClientAndDesktop(); // 👈 usar hook
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [openDrawerInteres, setOpenDrawerInteres] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const messageApiRef = useRef(messageApi);
  const drawerFormRef = useRef(null);
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
      if (!res.ok) throw new Error("Error al cargar préstamos y anticipos");

      const data = await res.json();
      setClienteSeleccionado(data);

      const filasPrestamos = [];
      const filasAnticipos = [];

      // === 🔹 PRÉSTAMOS ===
      if (data?.prestamos?.length > 0) {
        data.prestamos.forEach((prestamo, idxPrestamo) => {
          const prestamoKey = `prestamo-${prestamo.prestamo_id || idxPrestamo}`;

          if (!["ANULADO", "ABSORBIDO", "INICIAL"].includes(prestamo.estado)) {
            filasPrestamos.push({
              key: prestamoKey,
              prestamoId: prestamo.prestamoId,
              fecha: prestamo.fecha
                ? new Date(prestamo.fecha).toLocaleDateString("es-HN")
                : "",
              interes: prestamo.tasa_interes ? `${prestamo.tasa_interes}%` : "",
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

            const descripcion = [
              mov.descripcion || mov.tipo_movimiento,
              mov.observacion ? `(${mov.observacion})` : "",
            ]
              .filter(Boolean)
              .join(" ");

            filasPrestamos.push({
              key: `mov-${prestamo.prestamo_id || idxPrestamo}-${idxMov}`,
              MovimientoId: mov.MovimientoId,
              prestamoId: prestamo.prestamoId,
              fecha: mov.fecha
                ? new Date(mov.fecha).toLocaleDateString("es-HN")
                : "",
              descripcion,
              interes: mov.interes ? `${mov.interes}%` : "",
              dias: mov.tipo_movimiento === "Int-Cargo" ? mov.dias || "" : "",
              // 🔹 CAMBIO: abonos ahora positivos
              abono:
                mov.tipo_movimiento === "ABONO" ? Number(mov.monto || 0) : null,
              prestamo:
                mov.tipo_movimiento === "PRESTAMO"
                  ? Number(mov.monto || 0)
                  : null,
              intCargo:
                mov.tipo_movimiento === "Int-Cargo"
                  ? Number(mov.monto || 0)
                  : null,
              intAbono: ["ABONO_INTERES", "PAGO_INTERES"].includes(
                mov.tipo_movimiento
              )
                ? Number(mov.monto || 0)
                : null,
              tipo: mov.tipo_movimiento,
              // 🔹 CAMBIO: totalGeneral se calcula como cargos - abonos
              totalGeneral:
                (["PRESTAMO", "Int-Cargo"].includes(mov.tipo_movimiento)
                  ? Number(mov.monto || 0)
                  : 0) -
                (["ABONO", "ABONO_INTERES", "PAGO_INTERES"].includes(
                  mov.tipo_movimiento
                )
                  ? Number(mov.monto || 0)
                  : 0),
            });
          });
        });
      }

      // === 🔹 ANTICIPOS ===
      if (data?.anticipo?.length > 0) {
        data.anticipo.forEach((ant, idxAnt) => {
          const antKey = `anticipo-${ant.anticipoId || idxAnt}`;
          if (!["ANULADO", "ABSORBIDO", "INICIAL"].includes(ant.estado)) {
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

            const descripcion = [
              mov.descripcion || mov.tipo_movimiento,
              mov.observacion ? `(${mov.observacion})` : "",
            ]
              .filter(Boolean)
              .join(" ");

            filasAnticipos.push({
              key: `movAnt-${ant.anticipoId}-${idxMov}`,
              MovimientoId: mov.MovimientoId,
              anticipoId: ant.anticipoId,
              fecha: mov.fecha
                ? new Date(mov.fecha).toLocaleDateString("es-HN")
                : "",
              descripcion,
              interes: mov.interes ? `${mov.interes}%` : "",
              dias:
                mov.tipo_movimiento === "CARGO_ANTICIPO" ? mov.dias || "" : "",
              // 🔹 CAMBIO: abonos positivos
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
              // 🔹 CAMBIO: totalGeneral = cargos - abonos
              totalGeneral:
                (["ANTICIPO", "CARGO_ANTICIPO"].includes(mov.tipo_movimiento)
                  ? Number(mov.monto || 0)
                  : 0) -
                (["ABONO_ANTICIPO", "INTERES_ANTICIPO"].includes(
                  mov.tipo_movimiento
                )
                  ? Number(mov.monto || 0)
                  : 0),
            });
          });
        });
      }

      // === 🔹 TOTALES ===
      const calcularTotales = (filas, tipo = "prestamo") => {
        if (filas.length === 0) return [];

        const t = {
          key: "total",
          descripcion: "Total general",
          // 🔹 CAMBIO: usamos solo positivos y restamos explícitamente
          abono: filas.reduce((acc, f) => acc + (f.abono || 0), 0),
          intCargo: filas.reduce((acc, f) => acc + (f.intCargo || 0), 0),
          intAbono: filas.reduce((acc, f) => acc + (f.intAbono || 0), 0),
          esTotal: true,
        };

        if (tipo === "prestamo") {
          const totalPrestamo = filas.reduce(
            (acc, f) => acc + (f.prestamo || 0) + (f.intCargo || 0),
            0
          );
          const totalAbonos = filas.reduce(
            (acc, f) => acc + (f.abono || 0) + (f.intAbono || 0),
            0
          );
          t.prestamo = filas.reduce((acc, f) => acc + (f.prestamo || 0), 0);
          t.totalGeneral = totalPrestamo - totalAbonos; // 🔹 CAMBIO: saldo real
        } else {
          const totalAnticipo = filas.reduce(
            (acc, f) => acc + (f.anticipo || 0) + (f.intCargo || 0),
            0
          );
          const totalAbonos = filas.reduce(
            (acc, f) => acc + (f.abono || 0) + (f.intAbono || 0),
            0
          );
          t.anticipo = filas.reduce((acc, f) => acc + (f.anticipo || 0), 0);
          t.totalGeneral = totalAnticipo - totalAbonos; // 🔹 CAMBIO: saldo real
        }

        filas.push({ ...t, tipo: "TOTAL" });
        return filas;
      };

      setDataPrestamos(calcularTotales(filasPrestamos, "prestamo"));
      setDataAnticipos(calcularTotales(filasAnticipos, "anticipo"));
    } catch (err) {
      setError("Error al cargar los préstamos y anticipos del cliente");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const columnas = useMemo(
    () => [
      {
        title: "Fecha",
        dataIndex: "fecha",
        width: 110,
        fixed: isDesktop ? "left" : false,

        sorter: (a, b) => {
          if (a.esTotal) return 1; // <-- CAMBIO
          // 👉 Si B es la fila total, va al final
          if (b.esTotal) return -1; // <-- CAMBIO
          const dateA = a.fecha
            ? new Date(a.fecha.split("/").reverse().join("-"))
            : 0;
          const dateB = b.fecha
            ? new Date(b.fecha.split("/").reverse().join("-"))
            : 0;
          return dateA - dateB;
        },

        sortDirections: ["ascend", "descend"],
        defaultSortOrder: "ascend", // ✅ POR DEFECTO DESCENDENTE
        showSorterTooltip: true,
      },

      {
        title: "Días",
        dataIndex: "dias",
        align: "center",
        width: 80,
        render: (val, record) => {
          // Solo mostrar si hay valor
          if (!val) return "";
          // Puedes poner un estilo especial si quieres, por ejemplo para Int-Cargo
          return record.tipo === "Int-Cargo" ? (
            <Text style={{ color: "#fa8c16", fontWeight: 500 }}>{val}</Text>
          ) : (
            val
          );
        },
      },

      { title: "% Interés", dataIndex: "interes", align: "center", width: 90 },
      {
        title: "Descripción / Observación",
        dataIndex: "descripcion",
        width: 250,
        render: (text, record) => {
          if (record.tipo === "TOTAL") return <Text strong>{text}</Text>;
          if (record.tipo === "PRESTAMO_INICIAL")
            return (
              <Text strong style={{ color: "#1890ff" }}>
                {text}
              </Text>
            );
          return text;
        },
      },
      {
        title: "Anticipo",
        dataIndex: "anticipo",
        align: "right",
        width: 120,
        render: (val, record) =>
          val ? (
            record.tipo === "TOTAL" ? (
              <Text strong style={{ color: "#000" }}>
                {val.toLocaleString("es-HN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            ) : (
              <Text style={{ color: "#000" }}>
                {val.toLocaleString("es-HN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            )
          ) : (
            ""
          ),
      },
      {
        title: "Préstamo",
        dataIndex: "prestamo",
        align: "right",
        width: 120,
        render: (val, record) =>
          val ? (
            record.tipo === "TOTAL" ? (
              <Text strong>
                {val.toLocaleString("es-HN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            ) : (
              <Text style={{ color: "#000" }}>
                {val.toLocaleString("es-HN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            )
          ) : (
            ""
          ),
      },

      {
        title: "Abono",
        dataIndex: "abono",
        align: "right",
        width: 120,
        render: (val, record) =>
          val ? (
            record.tipo === "TOTAL" ? (
              <Text strong style={{ color: "#000" }}>
                {val.toLocaleString("es-HN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            ) : (
              <Text style={{ color: "#090ceaff" }}>
                {val.toLocaleString("es-HN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            )
          ) : (
            ""
          ),
      },

      {
        title: "Int-Cargo",
        dataIndex: "intCargo",
        align: "right",
        width: 120,
        render: (val, record) =>
          val ? (
            record.tipo === "TOTAL" ? (
              <Text strong style={{ color: "#000" }}>
                {val.toLocaleString("es-HN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            ) : (
              <Text style={{ color: "#ff4d4f" }}>
                {val.toLocaleString("es-HN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            )
          ) : (
            ""
          ),
      },
      {
        title: "Int-Abono",
        dataIndex: "intAbono",
        align: "right",
        width: 120,
        render: (val, record) =>
          val ? (
            record.tipo === "TOTAL" ? (
              <Text strong style={{ color: "#000" }}>
                {val.toLocaleString("es-HN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            ) : (
              <Text style={{ color: "#000" }}>
                {val.toLocaleString("es-HN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            )
          ) : (
            ""
          ),
      },
      {
        title: "Saldo Total",
        dataIndex: "totalGeneral",
        align: "right",
        width: 140,
        fixed: isDesktop ? "right" : false,
        render: (val, record) => {
          if (val == null) return "";
          const formatted = val.toLocaleString("es-HN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          const color = val > 0 ? "#ff4d4f" : val < 0 ? "#000" : "#000";
          return (
            <Text strong style={{ fontSize: 16, color }}>
              {formatted}
            </Text>
          );
        },
      },
      {
        title: "Acciones",
        key: "acciones",
        fixed: isDesktop ? "right" : false,
        width: 120,
        align: "center",
        render: (_, record) => {
          // No mostrar botones para totales o ya anulados
          if (
            record.tipo === "TOTAL" ||
            record.tipo === "ANULADO" ||
            record.estado === "ANULADO"
          )
            return null;

          let tipo = null;
          let id = null;
          let endpointTipo = null;

          switch (true) {
            case !!(record.MovimientoId && record.prestamoId):
              tipo = "MOVIMIENTO_PRESTAMO";
              id = record.MovimientoId;
              endpointTipo = "PRESTAMO";
              break;

            case !!(record.MovimientoId && record.anticipoId):
              tipo = "MOVIMIENTO_ANTICIPO";
              id = record.MovimientoId;
              endpointTipo = "ANTICIPO";
              break;

            case !!record.MovimientoId:
              tipo = "MOVIMIENTO";
              id = record.MovimientoId;
              endpointTipo = null; // genérico
              break;

            case !!record.prestamoId:
              tipo = "PRESTAMO";
              id = record.prestamoId;
              endpointTipo = "PRESTAMO";
              break;

            case !!record.anticipoId:
              tipo = "ANTICIPO";
              id = record.anticipoId;
              endpointTipo = "ANTICIPO";
              break;

            default:
              console.warn("Registro no reconocido:", record);
              break;
          }

          if (!tipo || !id) return null;

          // 🔹 Función de anular con endpoint dinámico
          const handleConfirmAnular = () => {
            let endpoint = "";
            if (tipo.includes("MOVIMIENTO")) {
              endpoint =
                endpointTipo === "PRESTAMO"
                  ? `/api/prestamos/movimiento/${id}`
                  : `/api/anticipos/movimiento/${id}`;
            } else {
              endpoint =
                tipo === "PRESTAMO"
                  ? `/api/prestamos/${id}`
                  : `/api/anticipos/${id}`;
            }

            handleAnular(id, tipo, endpoint);
          };

          return (
            <Popconfirm
              title={`¿Anular ${
                tipo.includes("MOVIMIENTO")
                  ? "movimiento"
                  : tipo === "PRESTAMO"
                  ? "préstamo"
                  : "anticipo"
              }? Esta acción no se puede deshacer.`}
              okText="Sí, anular"
              cancelText="Cancelar"
              okType="danger"
              onConfirm={handleConfirmAnular}
            >
              <Button size="small" danger icon={<DeleteFilled />} />
            </Popconfirm>
          );
        },
      },
    ],
    [isDesktop]
  );

  const columnasPrestamos = useMemo(() => {
    // ✅ Tabla de préstamos no debe mostrar la columna de "anticipo"
    return columnas.filter((col) => col.dataIndex !== "anticipo");
  }, [columnas]);

  const columnasAnticipos = useMemo(() => {
    // ✅ Tabla de anticipos no debe mostrar la columna de "prestamo"
    return columnas.filter((col) => col.dataIndex !== "prestamo");
  }, [columnas]);

  const handleAnular = async (id, tipo, endpoint) => {
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `No se pudo anular el ${tipo}`);
      }

      messageApiRef.current.success(
        `${
          tipo.includes("MOVIMIENTO")
            ? "Movimiento"
            : tipo === "PRESTAMO"
            ? "Préstamo"
            : "Anticipo"
        } anulado correctamente`
      );

      // 🔹 Recargar la tabla del cliente
      if (clienteSeleccionado?.clienteID) {
        await cargarPrestamos(clienteSeleccionado.clienteID);
      }
    } catch (err) {
      console.error(err);
      messageApiRef.current.error(err.message || `Error al anular ${tipo}`);
    }
  };

  const handleAgregarPrestamo = async (nuevoRegistro) => {
    try {
      setLoading(true);

      let url = "";
      let body = {
        clienteID: nuevoRegistro.clienteID,
        monto: nuevoRegistro.monto,
        fecha: nuevoRegistro.fecha,
        interes: nuevoRegistro.interes || 0,
        dias: nuevoRegistro.dias || 0,
        observacion: nuevoRegistro.observacion,
      };

      if (nuevoRegistro.tipo === "PRESTAMO") {
        url = "/api/prestamos";
        body = {
          ...body,
          tasa_interes: nuevoRegistro.tasa_interes,
          estado: "ACTIVO",
        };
      } else if (nuevoRegistro.tipo === "ANTICIPO") {
        url = "/api/anticipos";
        body = {
          ...body,
          tasa_interes: nuevoRegistro.tasa_interes,
          estado: "ACTIVO",
        };
      } else if (
        ["ABONO_ANTICIPO", "INTERES_ANTICIPO", "CARGO_ANTICIPO"].includes(
          nuevoRegistro.tipo
        )
      ) {
        url = "/api/anticipos/movimiento";
        body = { ...body, tipo_movimiento: nuevoRegistro.tipo };
      } else if (
        ["ABONO", "PAGO_INTERES", "Int-Cargo"].includes(nuevoRegistro.tipo)
      ) {
        url = "/api/prestamos/movimiento";
        body = { ...body, tipo_movimiento: nuevoRegistro.tipo };
      } else {
        throw new Error("Tipo de movimiento no reconocido");
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      console.log(data);

      if (res.ok) {
        messageApiRef.current.destroy();
        messageApiRef.current.success(
          data.message || "Registro guardado correctamente"
        );

        await cargarPrestamos(clienteSeleccionado.clienteID);

        drawerFormRef.current?.resetFields();
        setOpenDrawer(false);
        return;
      }

      messageApiRef.current.destroy();
      messageApiRef.current.error(data.error || "Error al guardar registro");
    } catch (error) {
      messageApiRef.current.destroy();
      messageApiRef.current.error({
        content: error.message || "Error al guardar",
        duration: 8,
      });
    } finally {
      setLoading(false);
    }
  };

  const columnasPDFPrestamos = [
    { header: "Fecha", key: "fecha" },
    { header: "Días", key: "dias" },
    { header: "% Interés", key: "interes" },
    { header: "Descripción", key: "descripcion" },
    { header: "Préstamo", key: "prestamo", format: "numero", isTotal: true },
    { header: "Abono", key: "abono", format: "numero", isTotal: true },
    { header: "Int-Cargo", key: "intCargo", format: "numero", isTotal: true },
    { header: "Int-Abono", key: "intAbono", format: "numero", isTotal: true },
    {
      header: "Saldo Total",
      key: "totalGeneral",
      format: "numero",
      isTotal: true,
    },
  ];

  const columnasPDAnticipos = [
    { header: "Fecha", key: "fecha" },
    { header: "Días", key: "dias" },
    { header: "% Interés", key: "interes" },
    { header: "Descripción", key: "descripcion" },
    { header: "Anticipo", key: "anticipo", format: "numero", isTotal: true },
    { header: "Abono", key: "abono", format: "numero", isTotal: true },
    { header: "Int-Cargo", key: "intCargo", format: "numero", isTotal: true },
    { header: "Int-Abono", key: "intAbono", format: "numero", isTotal: true },
    {
      header: "Saldo Total",
      key: "totalGeneral",
      format: "numero",
      isTotal: true,
    },
  ];

  const handleImprimir = (tipo) => {
    const esPrestamo = tipo === "prestamos";

    const data = esPrestamo ? dataPrestamos : dataAnticipos;
    const columnas = esPrestamo ? columnasPDFPrestamos : columnasPDAnticipos;
    const nombre = esPrestamo ? "Préstamos" : "Anticipos";

    if (!data.length) {
      messageApiRef.current.error(
        `No hay ${nombre.toLowerCase()} para imprimir`
      );
      return;
    }
    // 👉 ORDENAR CRONOLÓGICAMENTE ANTES DE IMPRIMIR
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
      {
        nombreFiltro: `${clienteSeleccionado.clienteNombre} ${clienteSeleccionado.clienteApellido}`,
      },
      columnas,
      {
        title: `${nombre} - ${clienteSeleccionado.clienteNombre} ${clienteSeleccionado.clienteApellido}`,
        orientation: "landscape",
      }
    );
  };

  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS", "AUDITORES"]}
    >
      <>
        <style>{`
        .total-row td {
          background-color: #f2f2f2 !important;
          font-weight: bold;
        }
      `}</style>
        {contextHolder}
        <div style={{ background: "#f0f2f5", minHeight: "100vh" }}>
          <Card
            title={
              <Title level={isDesktop ? 3 : 4}>Préstamos y Anticipos</Title>
            }
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
          >
            <Row
              gutter={[8, 8]}
              align="middle"
              justify="start"
              style={{ marginBottom: 24 }}
            >
              {/* Select del cliente */}
              <Col xs={24} sm={24} md={12} lg={8} xl={6}>
                <Select
                  showSearch
                  placeholder="🔍 Buscar cliente..."
                  style={{ width: "100%" }}
                  onChange={cargarPrestamos}
                  optionFilterProp="children"
                  size="large"
                  loading={clientes.length === 0}
                  filterOption={(input, option) =>
                    option?.children
                      ?.toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  value={
                    clienteSeleccionado
                      ? clienteSeleccionado.clienteID
                      : undefined
                  } // ✅ asegúrate que sea solo el ID
                >
                  {clientes.map((c) => (
                    <Select.Option key={c.clienteID} value={c.clienteID}>
                      {`${c.clienteNombre} ${c.clienteApellido}`}
                    </Select.Option>
                  ))}
                </Select>
              </Col>

              {/* Botones solo si hay cliente seleccionado */}
              {clienteSeleccionado && (
                <Col xs={24} sm={24} md={12} lg={16} xl={18}>
                  <Space wrap style={{ marginTop: 8 }}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setOpenDrawer(true)}
                    >
                      Ingresar Movimiento
                    </Button>
                    <Button
                      type="primary"
                      onClick={() => setOpenDrawerInteres(true)}
                      icon={<CalculatorOutlined />}
                    >
                      Calculo de Interes
                    </Button>

                    <Button
                      danger
                      onClick={() =>
                        clienteSeleccionado &&
                        cargarPrestamos(clienteSeleccionado.clienteID)
                      }
                      icon={<ReloadOutlined />}
                    >
                      Recargar
                    </Button>
                    <Button
                      onClick={() => handleImprimir("prestamos")}
                      icon={<FilePdfOutlined />}
                    >
                      {" "}
                      Exportar Préstamos
                    </Button>

                    <Button
                      onClick={() => handleImprimir("anticipos")}
                      icon={<FilePdfOutlined />}
                    >
                      Exportar Anticipos
                    </Button>
                  </Space>
                </Col>
              )}
            </Row>

            {clienteSeleccionado && (
              <>
                <Card
                  size="small"
                  style={{ marginBottom: 24, background: "#fafafa" }}
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={{
                      xs: 1, // móviles
                      sm: 1, // tablets pequeñas
                      md: 2, // tablets grandes
                      lg: 3, // escritorio
                      xl: 3,
                      xxl: 3,
                    }}
                  >
                    <Descriptions.Item label={<Text strong>ID Cliente</Text>}>
                      <Tag color="blue">{clienteSeleccionado.clienteID}</Tag>
                    </Descriptions.Item>

                    <Descriptions.Item
                      label={<Text strong>Nombre Completo</Text>}
                    >
                      <Text strong style={{ color: "#1890ff", fontSize: 15 }}>
                        {clienteSeleccionado.clienteNombre}{" "}
                        {clienteSeleccionado.clienteApellido}
                      </Text>
                    </Descriptions.Item>

                    <Descriptions.Item label={<Text strong>Cédula</Text>}>
                      <Text style={{ fontSize: 15 }}>
                        {clienteSeleccionado.clienteCedula || "N/A"}
                      </Text>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </>
            )}

            <Divider />

            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Spin size="large" />
              </div>
            ) : clienteSeleccionado ? (
              <>
                {/* 🔹 Tabla de Préstamos */}
                <Title level={4} style={{ marginTop: 16 }}>
                  Préstamos
                </Title>
                {dataPrestamos.length > 0 ? (
                  <Table
                    dataSource={dataPrestamos}
                    columns={columnasPrestamos} // ✅ usar columnas sin "Anticipo"
                    pagination={false}
                    size="small"
                    bordered
                    scroll={{ x: 800 }}
                    rowClassName={(record) =>
                      record.tipo === "TOTAL" ? "total-row" : ""
                    }
                  />
                ) : (
                  <Empty description="Sin préstamos registrados" />
                )}

                {/* 🔹 Tabla de Anticipos */}
                <Title level={4} style={{ marginTop: 40 }}>
                  Anticipos
                </Title>
                {dataAnticipos.length > 0 ? (
                  <Table
                    dataSource={dataAnticipos}
                    columns={columnasAnticipos} // ✅ usar columnas sin "Préstamo"
                    pagination={false}
                    size="small"
                    bordered
                    scroll={{ x: 800 }}
                    rowClassName={(record) =>
                      record.tipo === "TOTAL" ? "total-row" : ""
                    }
                  />
                ) : (
                  <Empty description="Sin anticipos registrados" />
                )}
              </>
            ) : (
              <Empty description="Seleccione un cliente para ver sus préstamos" />
            )}

            <DrawerPrestamo
              open={openDrawer}
              onClose={() => setOpenDrawer(false)}
              onSubmit={handleAgregarPrestamo}
              cliente={clienteSeleccionado}
              formRef={drawerFormRef}
            />
            <DrawerCalculoInteres
              open={openDrawerInteres}
              onClose={() => setOpenDrawerInteres(false)}
              onSubmit={handleAgregarPrestamo}
              cliente={clienteSeleccionado}
            />
          </Card>
        </div>
      </>
    </ProtectedPage>
  );
}
