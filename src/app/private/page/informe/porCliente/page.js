"use client";

import { useState, useEffect } from "react";
import {
  Table,
  Card,
  Typography,
  Divider,
  message,
  Spin,
  Space,
  Select,
  DatePicker,
  Button,
  Row,
  Col,
} from "antd";
import dayjs from "dayjs";
import { formatNumber } from "@/components/Formulario";
import ProtectedPage from "@/components/ProtectedPage";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import { exportPDFMovimientosCliente } from "@/Doc/Reportes/porCliente";

import {
  CalendarOutlined,
  // AppstoreOutlined,
  // DollarOutlined,
  // LineChartOutlined,
} from "@ant-design/icons";
import EstadisticasCards from "@/components/ReportesElement/DatosEstadisticos";
import {
  columnasPorTipo,
  columnsDetalleInterno,
  columns,
  columnsPrestamos,
  getPrestamosMoviColumns,
} from "./columnas";
// import TablaTotales from "@/components/ReportesElement/TablaTotales";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function MovimientosComprasPage() {
  const [clientes, setClientes] = useState([]);
  const [clienteID, setClienteID] = useState(null);
  const [fechaRango, setFechaRango] = useState([
    dayjs().subtract(1, "year").startOf("year"),
    dayjs().endOf("year"),
  ]);
  const [data, setData] = useState([]);
  // const [totales, setTotales] = useState({});
  const [prestamos, setPrestamos] = useState([]);
  const [loading, setLoading] = useState(false);
  const { mounted, isDesktop } = useClientAndDesktop();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const res = await fetch("/api/clientes");
        if (!res.ok) throw new Error("Error al cargar clientes");
        const json = await res.json();
        setClientes(json || []);
      } catch (err) {
        console.error(err);
        messageApi.error("No se pudieron cargar los clientes");
      }
    };
    fetchClientes();
  }, [messageApi]);

  const fetchCompras = async () => {
    if (!clienteID) {
      messageApi.warning("Seleccione un cliente primero");
      return;
    }

    if (!fechaRango || fechaRango.length !== 2) {
      messageApi.warning("Seleccione un rango de fechas válido");
      return;
    }

    setLoading(true);
    try {
      const fechaInicio = fechaRango[0].format("YYYY-MM-DD");
      const fechaFin = fechaRango[1].format("YYYY-MM-DD");

      const res = await fetch(
        `/api/reportes/porCliente?clienteID=${clienteID}&fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
      );
      if (!res.ok) throw new Error("Error al obtener movimientos");

      const json = await res.json();

      // 🔹 Procesar Compras
      const detallesCompras = (json.movimientos.Compras || []).map((c) => {
        const cantidadQQ = Number(c.cantidadQQ) || 0;
        const precioQQ = Number(c.precioQQ) || 0;
        return { ...c, cantidadQQ, precioQQ, totalLps: cantidadQQ * precioQQ };
      });

      const totalQQCompras = detallesCompras.reduce(
        (acc, c) => acc + c.cantidadQQ,
        0
      );
      const totalLpsCompras = detallesCompras.reduce(
        (acc, c) => acc + c.totalLps,
        0
      );
      const promedioPrecioCompras =
        totalQQCompras > 0
          ? detallesCompras.reduce(
              (acc, c) => acc + c.precioQQ * c.cantidadQQ,
              0
            ) / totalQQCompras
          : 0;

      const filaCompras = {
        tipo: "Compra",
        totalQQ: totalQQCompras,
        totalLps: totalLpsCompras,
        promedioPrecio: promedioPrecioCompras,
        detalles: detallesCompras,
      };

      // 🔹 Procesar Contratos
      // Procesar Contratos correctamente
      const detallesContratos = (json.movimientos.Contratos || []).map(
        (contrato) => {
          const detalles = (contrato.detalles || []).map((d) => {
            const cantidadQQ = Number(d.cantidadQQ) || 0;
            const precioQQ = Number(d.precioQQ) || 0;
            return {
              fecha: d.fecha,
              cantidadQQ,
              precioQQ,
              totalLps: cantidadQQ * precioQQ,
              detalleID: d.detalleID,
            };
          });

          const totalQQ = detalles.reduce((acc, d) => acc + d.cantidadQQ, 0);
          const totalLps = detalles.reduce((acc, d) => acc + d.totalLps, 0);
          const promedioPrecio =
            totalQQ > 0
              ? detalles.reduce(
                  (acc, d) => acc + d.precioQQ * d.cantidadQQ,
                  0
                ) / totalQQ
              : 0;

          const precioUnitario = detalles[0]?.precioQQ || 0;

          return {
            contratoID: contrato.contratoID,
            descripcion: contrato.descripcion,
            cantidadContrato: contrato.cantidadContrato || 0,
            producto: contrato.producto?.productName || "-",
            fecha: contrato.fecha,
            totalQQ,
            precio: precioUnitario,
            totalLps,
            promedioPrecio,
            detalles, // solo cantidad, precio, total y fecha
          };
        }
      );

      const filaContratos = {
        tipo: "Contrato",

        totalQQPorLiquidar: detallesContratos.reduce(
          (sum, c) => sum + ((c.cantidadContrato || 0) - c.totalQQ),
          0
        ),

        totalQQ: detallesContratos.reduce((sum, c) => sum + c.totalQQ, 0),
        totalLps: detallesContratos.reduce((sum, c) => sum + c.totalLps, 0),
        promedioPrecio:
          detallesContratos.reduce(
            (sum, c) => sum + c.promedioPrecio * c.totalQQ,
            0
          ) /
          Math.max(
            1,
            detallesContratos.reduce((sum, c) => sum + c.totalQQ, 0)
          ),
        detalles: detallesContratos.map((c) => ({
          ...c,
          liquidado:
            c.detalles.length > 0 &&
            c.detalles.reduce((sum, d) => sum + d.cantidadQQ, 0) >=
              c.cantidadContrato
              ? "Sí"
              : "No",
        })),
      };
      // 🔹 Depósitos

      const detallesDepositos = (json.movimientos.Depositos || []).map(
        (dep) => {
          const detallesLiq = (dep.liqDeposito || []).map((l) => ({
            ...l,
            fecha: l.fecha || dep.fecha || null,
            cantidadQQ: Number(l.cantidadQQ) || 0,
            precioQQ: Number(l.precioQQ) || 0,
            totalLps: (Number(l.cantidadQQ) || 0) * (Number(l.precioQQ) || 0),
          }));

          const totalQQLiquidado = detallesLiq.reduce(
            (sum, l) => sum + l.cantidadQQ,
            0
          );

          const totalLpsLiquidado = detallesLiq.reduce(
            (sum, l) => sum + l.totalLps,
            0
          );

          const promedioPrecio =
            detallesLiq.reduce((sum, l) => sum + l.precioQQ * l.cantidadQQ, 0) /
            Math.max(1, totalQQLiquidado);

          // Para mostrar en la tabla principal
          const precioUnitario = detallesLiq[0]?.precioQQ || 0;

          return {
            depositoID: dep.depositoID,
            fecha: dep.fecha,
            producto: dep.producto || "-",
            cantidadQQ: dep.cantidadQQ || 0,
            precio: precioUnitario,
            totalQQLiquidado,
            totalLpsLiquidado,
            promedioPrecio,
            liquidado: totalQQLiquidado >= (dep.cantidadQQ || 0) ? "Sí" : "No",
            detalles: detallesLiq,
          };
        }
      );

      // FILA DE RESUMEN
      const filaDepositos = {
        tipo: "Depósito",

        totalQQPorLiquidar: detallesDepositos.reduce(
          (sum, d) => sum + ((d.cantidadQQ || 0) - d.totalQQLiquidado),
          0
        ),

        totalQQ: detallesDepositos.reduce(
          (sum, d) => sum + d.totalQQLiquidado,
          0
        ),

        totalLps: detallesDepositos.reduce(
          (sum, d) => sum + d.totalLpsLiquidado,
          0
        ),

        promedioPrecio:
          detallesDepositos.reduce(
            (sum, d) => sum + d.promedioPrecio * d.totalQQLiquidado,
            0
          ) /
          Math.max(
            1,
            detallesDepositos.reduce((sum, d) => sum + d.totalQQLiquidado, 0)
          ),

        detalles: detallesDepositos,
      };

      // 🔹 Prestamos
      const detallesPrestamos = (json.movimientos.Prestamos || []).map((p) => {
        const movimientos = (p.movimientos || []).map((m) => ({
          movimientoId: m.movimientoId,
          fecha: m.fecha,
          tipo: m.tipo,
          monto: Number(m.monto) || 0,
          interes: Number(m.interes) || 0,
          descripcion: m.descripcion || "-",
        }));

        // 🔹 Agregar el préstamo base como un "movimiento"
        movimientos.unshift({
          movimientoId: `prestamo-${p.prestamoId}`,
          fecha: p.fecha,
          tipo: "PRÉSTAMO",
          monto: Number(p.monto) || 0,
          interes: 0,
          descripcion: "Monto del préstamo",
        });

        // Totales por préstamo
        // Monto = préstamo base + ANTICIPO + Int-Cargo (solo monto)
        const monto = movimientos
          .filter((m) => ["PRÉSTAMO", "Int-Cargo"].includes(m.tipo))
          .reduce((sum, m) => sum + m.monto, 0);

        const abonado = movimientos
          .filter((m) => ["PAGO_INTERES", "ABONO"].includes(m.tipo))
          .reduce((sum, m) => sum + m.monto, 0);

        const total = monto - abonado;
        // 🔹 Determinar estado automático
        const estado = abonado >= monto ? "COMPLETADO" : "PENDIENTE";

        return {
          prestamoId: p.prestamoId,
          fecha: p.fecha,
          monto,
          abonado,
          total,
          tipo: p.tipo || "-",
          estado,
          tasaInteres: Number(p.tasaInteres) || 0,
          observacion: p.observacion || "-",
          movimientos, // detalles
        };
      });

      // 🔹 Anticipos
      const detallesAnticipos = (json.movimientos.Anticipos || []).map((a) => {
        const movimientos = (a.movimientos || []).map((m) => ({
          movimientoId: m.movimientoId,
          fecha: m.fecha,
          tipo: m.tipo,
          monto: Number(m.monto) || 0,
          interes: Number(m.interes) || 0,
          descripcion: m.descripcion || "-",
        }));

        // 🔹 Agregar el anticipo base como un movimiento principal
        movimientos.unshift({
          movimientoId: `anticipo-${a.anticipoId}`,
          fecha: a.fecha,
          tipo: "ANTICIPO",
          monto: Number(a.monto) || 0,
          interes: 0,
          descripcion: "Monto del anticipo",
        });

        const monto = movimientos
          .filter((m) => ["ANTICIPO", "CARGO_ANTICIPO"].includes(m.tipo))
          .reduce((sum, m) => sum + m.monto, 0);

        const abonado = movimientos
          .filter((m) =>
            ["ABONO_ANTICIPO", "INTERES_ANTICIPO"].includes(m.tipo)
          )
          .reduce((sum, m) => sum + m.monto, 0);

        const total = monto - abonado;
        const estado = abonado >= monto ? "COMPLETADO" : "PENDIENTE";

        return {
          anticipoId: a.anticipoId,
          fecha: a.fecha,
          monto,
          abonado,
          total,
          tipo: "ANTICIPO",
          estado,
          tasaInteres: Number(a.tasaInteres) || 0,
          observacion: a.observacion || "-",
          movimientos,
        };
      });

      // 🔹 Unir ambos en una sola tabla
      const prestamosYAnticipos = [...detallesPrestamos, ...detallesAnticipos];
      setPrestamos(prestamosYAnticipos);

      // 🔹 Calcular totales combinados
      const totalPrestamosMonto = prestamosYAnticipos.reduce(
        (sum, p) => sum + p.monto,
        0
      );
      const totalPrestamosAbonado = prestamosYAnticipos.reduce(
        (sum, p) => sum + p.abonado,
        0
      );
      const totalPrestamosRestante = prestamosYAnticipos.reduce(
        (sum, p) => sum + p.total,
        0
      );

      setData([filaCompras, filaContratos, filaDepositos]);

      // setTotales({
      //   totalQQ:
      //     filaCompras.totalQQ + filaContratos.totalQQ + filaDepositos.totalQQ,
      //   totalLps:
      //     filaCompras.totalLps +
      //     filaContratos.totalLps +
      //     filaDepositos.totalLps,
      //   promedioPrecio:
      //     (filaCompras.totalQQ * filaCompras.promedioPrecio +
      //       filaContratos.totalQQ * filaContratos.promedioPrecio +
      //       filaDepositos.totalQQ * filaDepositos.promedioPrecio) /
      //     Math.max(
      //       1,
      //       filaCompras.totalQQ + filaContratos.totalQQ + filaDepositos.totalQQ
      //     ),
      //   // 🔹 Totales de préstamos
      //   prestamosMonto: totalPrestamosMonto,
      //   prestamosAbonado: totalPrestamosAbonado,
      //   prestamosRestante: totalPrestamosRestante,
      // });

      const hayRegistros =
        [filaCompras, filaContratos, filaDepositos].some(
          (f) => f.detalles?.length > 0
        ) || detallesPrestamos.length > 0;

      if (hayRegistros) {
        messageApi.success("Se encontraron registros");
      } else {
        messageApi.info("No se encontraron registros");
      }
    } catch (err) {
      console.error(err);
      messageApi.error("No se pudieron cargar los movimientos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS", "AUDITORES"]}
    >
      {contextHolder}
      <Card>
        <SectionHeader
          isDesktop={isDesktop}
          loading={loading}
          icon={<CalendarOutlined />}
          titulo="Registros por Cliente"
          subtitulo="Resumen de actividades por cliente"
          onExportPDF={() => {
            // Validaciones iniciales
            if (!Array.isArray(data) || data.length === 0) {
              messageApi.warning(
                "No hay datos válidos para generar el reporte."
              );
              return;
            }

            if (!clienteID) {
              messageApi.warning(
                "Seleccione un cliente para generar el reporte."
              );
              return;
            }

            const key = "generandoPDF";
            messageApi.open({
              key,
              type: "loading",
              content: "Generando reporte...",
              duration: 0,
            });

            try {
              // Obtener nombre del cliente
              const cliente = clientes.find((c) => c.clienteID === clienteID);
              const clienteNombre = cliente?.clienteNombre || "-";

              // Llamada al PDF con data segura
              exportPDFMovimientosCliente({
                clienteID,
                clienteNombre,
                dataTabla: Array.isArray(data) ? data : [],
                prestamos: Array.isArray(prestamos) ? prestamos : [],
                rangoFechas: {
                  inicio: fechaRango?.[0]?.format("YYYY-MM-DD") || null,
                  fin: fechaRango?.[1]?.format("YYYY-MM-DD") || null,
                },
                options: {
                  fontSize: 8, // tamaño de letra más pequeño
                  colorPrimario: [41, 128, 185],
                  colorSecundario: [236, 240, 241],
                  colorTexto: [44, 62, 80],
                },
              });

              messageApi.success({
                content: "Reporte generado correctamente",
                key,
                duration: 2,
              });
            } catch (error) {
              console.error(error);
              messageApi.error({
                content: "Error al generar el reporte",
                key,
                duration: 2,
              });
            }
          }}
          disableExport={!data || data.length === 0}
        />

        <Divider />
        <Row
          gutter={[16, 16]}
          align="middle"
          justify="space-around" // <-- centramos los filtros horizontalmente
        >
          <Col xs={24} sm={12} md={8} lg={6}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>Cliente:</Text>
              <Select
                style={{ width: "100%" }}
                placeholder="Seleccione un cliente"
                showSearch
                optionFilterProp="label"
                value={clienteID}
                onChange={setClienteID}
                options={clientes.map((c) => ({
                  value: c.clienteID,
                  label: `${c.clienteNombre} ${c.clienteApellido}`,
                }))}
              />
            </Space>
          </Col>

          <Col xs={24} sm={12} md={10} lg={8}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>Rango de fechas:</Text>
              <RangePicker
                style={{ width: "100%" }}
                value={fechaRango}
                format="DD/MM/YYYY"
                onChange={(val) => setFechaRango(val || [])}
              />
            </Space>
          </Col>

          <Col xs={24} sm={12} md={10} lg={8}>
            <Button
              type="primary"
              size="large"
              onClick={fetchCompras}
              disabled={!clienteID}
              style={{ width: "100%", marginTop: 24 }}
            >
              Buscar Registros
            </Button>
          </Col>
        </Row>
        {/* {totales && (
          <>
            <Divider />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 18,
                justifyContent: "space-between",
              }}
            >
              <EstadisticasCards
                isDesktop={isDesktop}
                data={[
                  {
                    titulo: "QQ Entregados",
                    valor: formatNumber(totales.totalQQ, 2),
                    prefix: "QQ.",
                    color: "#52c41a",
                    icon: <AppstoreOutlined style={{ color: "#52c41a" }} />,
                  },
                  {
                    titulo: "Entregados Lps",
                    valor: formatNumber(totales.totalLps, 2),
                    prefix: "L.",
                    color: "#1890ff",
                    icon: <DollarOutlined style={{ color: "#1890ff" }} />,
                  },
                  {
                    titulo: "Promedio Precio",
                    valor: formatNumber(totales.promedioPrecio, 2),
                    prefix: "L.",
                    color: "#faad14",
                    icon: <LineChartOutlined style={{ color: "#faad14" }} />,
                  },
                  ...(prestamos.length > 0
                    ? [
                        {
                          titulo: "Monto Total Préstamos",
                          valor: formatNumber(totales.prestamosMonto, 2),
                          prefix: "L.",
                          color: "#722ed1",
                          icon: <DollarOutlined style={{ color: "#722ed1" }} />,
                        },
                        {
                          titulo: "Monto Abonado",
                          valor: formatNumber(totales.prestamosAbonado, 2),
                          prefix: "L.",
                          color: "#52c41a",
                          icon: <DollarOutlined style={{ color: "#52c41a" }} />,
                        },
                        {
                          titulo: "Monto Restante",
                          valor: formatNumber(totales.prestamosRestante, 2),
                          prefix: "L.",
                          color: "#cf1322",
                          icon: <DollarOutlined style={{ color: "#cf1322" }} />,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          </>
        )} */}
        <Divider />
        {loading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 40 }}
          >
            <Spin size="large" />
          </div>
        ) : data &&
          data.some((row) =>
            // Revisar si hay al menos un valor numérico >= 0
            Object.values(row).some(
              (val) => typeof val === "number" && val >= 0
            )
          ) ? (
          <Table
            columns={columns}
            dataSource={data}
            scroll={{ x: "max-content" }}
            rowKey={(r) => r.tipo}
            expandable={{
              expandedRowRender: (record) => {
                if (!record.detalles?.length) return null;
                const col =
                  columnasPorTipo[record.tipo] || columnasPorTipo.Compra;

                return (
                  <Table
                    size="small"
                    columns={col}
                    dataSource={record.detalles}
                    pagination={false}
                    scroll={{ x: "max-content" }}
                    rowKey={(r) =>
                      r.contratoID || r.depositoID || r.compraId || r.id
                    }
                    expandable={{
                      expandedRowRender: (item) =>
                        item.detalles?.length ? (
                          <Table
                            scroll={{ x: "max-content" }}
                            size="small"
                            columns={columnsDetalleInterno}
                            dataSource={item.detalles}
                            pagination={false}
                            rowKey={(r) => r.detalleID || r.id}
                          />
                        ) : null,
                    }}
                  />
                );
              },
            }}
            pagination={false}
            summary={() => (
              <ResumenTablaGenerico
                columns={columns}
                data={data}
                options={{
                  highlightColumn: "promedioPrecio",
                  weightedColumn: "totalQQ",
                  highlightColumns: [
                    { dataIndex: "totalQQPorLiquidar", type: "danger" },
                  ],
                }}
              />
            )}
          />
        ) : (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Text>No hay datos para mostrar</Text>
          </div>
        )}
        {!loading && data.length > 0 && (
          <>
            <Divider />
            {/* Tabla de Préstamos */}
            <Title level={4}>Préstamos</Title>
            <Table
              columns={columnsPrestamos}
              dataSource={prestamos.filter((p) => p.tipo !== "ANTICIPO")}
              rowKey={(r) => r.prestamoId}
              scroll={{ x: "max-content" }}
              expandable={{
                expandedRowRender: (record) => (
                  <Table
                    size="small"
                    columns={getPrestamosMoviColumns("PRESTAMO")}
                    dataSource={record.movimientos}
                    pagination={false}
                    rowKey="movimientoId"
                    scroll={{ x: "max-content" }}
                  />
                ),
              }}
              pagination={false}
              summary={() => (
                <ResumenTablaGenerico
                  columns={columnsPrestamos}
                  data={prestamos.filter((p) => p.tipo !== "ANTICIPO")}
                  options={{
                    highlightColumns: [{ dataIndex: "total", type: "danger" }],
                  }}
                />
              )}
            />

            <Divider />
            {/* Tabla de Anticipos */}
            <Title level={4}>Anticipos</Title>
            <Table
              columns={columnsPrestamos}
              dataSource={prestamos.filter((p) => p.tipo === "ANTICIPO")}
              rowKey={(r) => r.anticipoId}
              scroll={{ x: "max-content" }}
              expandable={{
                expandedRowRender: (record) => (
                  <Table
                    size="small"
                    columns={getPrestamosMoviColumns("ANTICIPO")}
                    dataSource={record.movimientos}
                    pagination={false}
                    rowKey="movimientoId"
                    scroll={{ x: "max-content" }}
                  />
                ),
              }}
              pagination={false}
              summary={() => (
                <ResumenTablaGenerico
                  columns={columnsPrestamos}
                  data={prestamos.filter((p) => p.tipo === "ANTICIPO")}
                  options={{
                    highlightColumns: [{ dataIndex: "total", type: "danger" }],
                  }}
                />
              )}
            />
            <Divider />
          </>
        )}
      </Card>
    </ProtectedPage>
  );
}
export function ResumenTablaGenerico({ columns, data, options = {} }) {
  const {
    highlightColumn,
    fixed,
    formatCell,
    weightedColumn,
    highlightColumns = [],
  } = options;

  // Calcular totales solo para columnas numéricas
  const totals = {};
  columns.forEach((col) => {
    if (!col.dataIndex) return;

    const numericValues = data
      .map((row) => row[col.dataIndex])
      .filter((v) => typeof v === "number" && !isNaN(v));

    // Sumar para columnas normales
    if (numericValues.length > 0) {
      totals[col.dataIndex] = numericValues.reduce((sum, v) => sum + v, 0);
    }

    // Calcular promedio ponderado si es la columna destacada y hay columna de peso
    if (col.dataIndex === highlightColumn && weightedColumn) {
      const weightedSum = data.reduce(
        (sum, row) =>
          sum + (row[col.dataIndex] || 0) * (row[weightedColumn] || 0),
        0
      );
      const totalWeight = data.reduce(
        (sum, row) => sum + (row[weightedColumn] || 0),
        0
      );
      totals[col.dataIndex] = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
  });

  return (
    <Table.Summary fixed={fixed}>
      <Table.Summary.Row>
        <Table.Summary.Cell colSpan={1}>
          <div style={{ textAlign: "left", paddingLeft: 8, fontWeight: 600 }}>
            Totales
          </div>
        </Table.Summary.Cell>

        {columns.map((col) => {
          if (!col.dataIndex)
            return <Table.Summary.Cell key={col.key}></Table.Summary.Cell>;

          const value = totals[col.dataIndex];
          if (value === undefined)
            return (
              <Table.Summary.Cell key={col.dataIndex}></Table.Summary.Cell>
            );

          // Buscar si la columna está en highlightColumns
          const highlightObj = highlightColumns.find(
            (h) => h.dataIndex === col.dataIndex
          );

          return (
            <Table.Summary.Cell key={col.dataIndex} align="center">
              <Text strong={!!highlightObj} type={highlightObj?.type}>
                {formatCell
                  ? formatCell(value, col.dataIndex)
                  : formatNumber(value, 2)}
              </Text>
            </Table.Summary.Cell>
          );
        })}
      </Table.Summary.Row>
    </Table.Summary>
  );
}
