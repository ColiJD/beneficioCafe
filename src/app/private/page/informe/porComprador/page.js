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
import { exportPDFMovimientosComprador } from "@/Doc/Reportes/porComprador";

import { CalendarOutlined } from "@ant-design/icons";
import { columnasPorTipo, columns } from "./columnas";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function MovimientosCompradorPage() {
  const [compradores, setCompradores] = useState([]);
  const [compradorID, setCompradorID] = useState(null);
  const [fechaRango, setFechaRango] = useState([
    dayjs().subtract(1, "year").startOf("year"),
    dayjs().endOf("year"),
  ]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const { mounted, isDesktop } = useClientAndDesktop();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const fetchCompradores = async () => {
      try {
        const res = await fetch("/api/reportes/porComprador");
        if (!res.ok) throw new Error("Error al cargar compradores");
        const json = await res.json();
        setCompradores(json || []);
      } catch (err) {
        console.error(err);
        messageApi.error("No se pudieron cargar los compradores");
      }
    };
    fetchCompradores();
  }, [messageApi]);

  const fetchMovimientos = async () => {
    if (!compradorID) {
      messageApi.warning("Seleccione un comprador primero");
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
        `/api/reportes/porComprador?compradorID=${compradorID}&fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
      );
      if (!res.ok) throw new Error("Error al obtener movimientos");

      const json = await res.json();
      const movimientos = json.movimientos || {};

      // 🔹 Procesar ConfirmacionVenta
      const detallesConfirmacion = (movimientos.ConfirmacionVenta || []).map(
        (c) => {
          const cantidadQQ = Number(c.cantidadQQ) || 0;
          const totalQQEntregado = Number(c.totalQQ) || 0;
          const totalQQPorLiquidar = Number(c.totalQQPorLiquidar) || 0;
          const precioQQ = Number(c.precioQQ) || 0;
          const totalLps = cantidadQQ * precioQQ; // Total con INICIAL

          return {
            ...c,
            cantidadQQ,
            totalQQ: totalQQEntregado,
            totalQQPorLiquidar,
            precioQQ,
            totalLps,
            liquidado: totalQQPorLiquidar <= 0 ? "Sí" : "No",
          };
        }
      );

      const filaConfirmacion = {
        tipo: "ConfirmacionVenta",
        totalQQ: detallesConfirmacion.reduce((sum, d) => sum + d.cantidadQQ, 0), // Suma INICIAL
        totalLps: detallesConfirmacion.reduce((sum, d) => sum + d.totalLps, 0),
        totalQQPorLiquidar: detallesConfirmacion.reduce(
          (sum, d) => sum + d.totalQQPorLiquidar,
          0
        ),
        promedioPrecio:
          detallesConfirmacion.reduce((sum, d) => sum + d.totalLps, 0) /
          (detallesConfirmacion.reduce((sum, d) => sum + d.cantidadQQ, 0) || 1),
        detalles: detallesConfirmacion,
      };

      // 🔹 Procesar Ventas
      const detallesVentas = (movimientos.Ventas || []).map((v) => {
        const cantidadQQ = Number(v.cantidadQQ) || 0;
        const precioQQ = Number(v.precioQQ) || 0;
        const totalLps = cantidadQQ * precioQQ;
        return { ...v, cantidadQQ, precioQQ, totalLps };
      });

      const filaVentas = {
        tipo: "Venta",
        totalQQ: detallesVentas.reduce((sum, d) => sum + d.cantidadQQ, 0),
        totalLps: detallesVentas.reduce((sum, d) => sum + d.totalLps, 0),
        promedioPrecio:
          detallesVentas.reduce((sum, d) => sum + d.totalLps, 0) /
          (detallesVentas.reduce((sum, d) => sum + d.cantidadQQ, 0) || 1),
        detalles: detallesVentas,
      };

      // 🔹 Procesar Contratos
      const detallesContratos = (movimientos.Contratos || []).map(
        (contrato) => {
          const detalles = (contrato.detalles || []).map((d) => {
            const cantidadQQ = Number(d.cantidadQQ) || 0;
            const precioQQ = Number(d.precioQQ) || 0;
            return {
              ...d,
              cantidadQQ,
              precioQQ,
              totalLps: cantidadQQ * precioQQ,
            };
          });

          const totalQQ = detalles.reduce((sum, d) => sum + d.cantidadQQ, 0);
          const totalLps = detalles.reduce((sum, d) => sum + d.totalLps, 0);
          const cantidadContrato = Number(contrato.cantidadContrato) || 0;
          const totalQQPorLiquidar = cantidadContrato - totalQQ;
          const liquidado = totalQQPorLiquidar <= 0 ? "Sí" : "No";

          return {
            ...contrato,
            detalles,
            totalQQ,
            totalLps,
            totalQQPorLiquidar,
            liquidado,
          };
        }
      );

      const filaContratos = {
        tipo: "Contrato",
        totalQQ: detallesContratos.reduce((sum, c) => sum + c.totalQQ, 0),
        totalLps: detallesContratos.reduce((sum, c) => sum + c.totalLps, 0),
        totalQQPorLiquidar: detallesContratos.reduce(
          (sum, c) => sum + c.totalQQPorLiquidar,
          0
        ),
        promedioPrecio:
          detallesContratos.reduce((sum, c) => sum + c.totalLps, 0) /
          (detallesContratos.reduce((sum, c) => sum + c.totalQQ, 0) || 1),
        detalles: detallesContratos,
      };

      setData([filaConfirmacion, filaVentas, filaContratos]);

      const hayRegistros = [filaConfirmacion, filaVentas, filaContratos].some(
        (f) => f.detalles?.length > 0
      );
      hayRegistros
        ? messageApi.success("Se encontraron registros")
        : messageApi.info("No se encontraron registros");
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
          titulo="Registros por Comprador"
          subtitulo="Resumen de actividades por comprador"
          onExportPDF={() => {
            if (!Array.isArray(data) || data.length === 0) {
              messageApi.warning(
                "No hay datos válidos para generar el reporte."
              );
              return;
            }
            if (!compradorID) {
              messageApi.warning(
                "Seleccione un comprador para generar el reporte."
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
              const comprador = compradores.find(
                (c) => (c.compradorId || c.compradorID) === compradorID
              );
              const compradorNombre = comprador?.compradorNombre || "-";

              exportPDFMovimientosComprador({
                dataTabla: data,
                compradorNombre,
                rangoFechas: {
                  inicio: fechaRango?.[0]?.format("YYYY-MM-DD") || null,
                  fin: fechaRango?.[1]?.format("YYYY-MM-DD") || null,
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
        <Row gutter={[16, 16]} align="middle" justify="space-around">
          <Col xs={24} sm={12} md={8} lg={6}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>Comprador:</Text>
              <Select
                style={{ width: "100%" }}
                placeholder="Seleccione un comprador"
                showSearch
                optionFilterProp="label"
                value={compradorID}
                onChange={setCompradorID}
                options={compradores.map((c) => ({
                  value: c.compradorId || c.compradorID,
                  label: c.compradorNombre,
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
              onClick={fetchMovimientos}
              disabled={!compradorID}
              style={{ width: "100%", marginTop: 24 }}
            >
              Buscar Registros
            </Button>
          </Col>
        </Row>

        <Divider />
        {loading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 40 }}
          >
            <Spin size="large" />
          </div>
        ) : data && data.length > 0 ? (
          <Table
            columns={columns}
            dataSource={data}
            scroll={{ x: "max-content" }}
            rowKey={(r) => r.tipo}
            expandable={{
              expandedRowRender: (record) => {
                if (!record.detalles?.length) return null;
                const col =
                  columnasPorTipo[record.tipo] || columnasPorTipo.Venta;

                return (
                  <Table
                    size="small"
                    columns={col}
                    dataSource={record.detalles}
                    pagination={false}
                    scroll={{ x: "max-content" }}
                    rowKey={(r) =>
                      r.contratoID || r.salidaID || r.compraId || r.id
                    }
                  />
                );
              },
            }}
            pagination={false}
            summary={() => (
              <ResumenTablaGenerico
                columns={columns}
                data={data}
                hasExpandable={true}
                options={{
                  highlightColumn: "promedioPrecio",
                  weightedColumn: "totalQQ",
                  highlightColumns: [
                    { dataIndex: "totalQQPorLiquidar", type: "warning" },
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
      </Card>
    </ProtectedPage>
  );
}

export function ResumenTablaGenerico({
  columns,
  data,
  options = {},
  hasExpandable = false,
}) {
  const { highlightColumn, weightedColumn, highlightColumns = [] } = options;
  const totals = {};

  columns.forEach((col) => {
    if (!col.dataIndex) return;

    const numericValues = data
      .map((row) => row[col.dataIndex])
      .filter((v) => typeof v === "number" && !isNaN(v));

    if (numericValues.length > 0)
      totals[col.dataIndex] = numericValues.reduce((sum, v) => sum + v, 0);

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
    <Table.Summary.Row>
      {hasExpandable && <Table.Summary.Cell index={0} />}
      {columns.map((col, index) => {
        const cellIndex = hasExpandable ? index + 1 : index;

        if (index === 0)
          return (
            <Table.Summary.Cell index={cellIndex} key={index}>
              <strong>Total</strong>
            </Table.Summary.Cell>
          );
        const val = totals[col.dataIndex];
        const highlightStyle = highlightColumns.find(
          (h) => h.dataIndex === col.dataIndex
        );
        const color =
          highlightStyle?.type === "danger"
            ? "red"
            : highlightStyle?.type === "warning"
            ? "orange"
            : "inherit";

        return (
          <Table.Summary.Cell index={cellIndex} key={index} align={col.align}>
            {val !== undefined ? (
              <Text strong style={{ color }}>
                {col.dataIndex === "totalLps" ||
                col.dataIndex === "promedioPrecio"
                  ? "L. "
                  : ""}
                {formatNumber(val, 2)}
              </Text>
            ) : null}
          </Table.Summary.Cell>
        );
      })}
    </Table.Summary.Row>
  );
}
