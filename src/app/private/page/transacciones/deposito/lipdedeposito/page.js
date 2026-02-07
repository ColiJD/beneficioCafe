"use client";

import { useState, useMemo } from "react";
import {
  Table,
  Card,
  Typography,
  Divider,
  Popconfirm,
  Button,
  message,
} from "antd";
import dayjs from "dayjs";
import {
  CalendarOutlined,
  UserOutlined,
  FilePdfOutlined,
  DeleteOutlined,
  DeleteFilled,
} from "@ant-design/icons";
import ProtectedButton from "@/components/ProtectedButton";
import { exportLiquidacionDeposito } from "@/Doc/Documentos/liqDepositp";
import Filtros from "@/components/Filtros";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import EstadisticasCards from "@/components/ReportesElement/DatosEstadisticos";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import { useFetchReport } from "@/hook/useFetchReport";
import TarjetaMobile from "@/components/TarjetaMobile";
import ProtectedPage from "@/components/ProtectedPage";
import { formatNumber } from "@/components/Formulario";
import { eliminarRecurso } from "../../salidas/registro/page";
import { rangoInicial } from "../../../informe/reporteCliente/page";

const { Title, Text } = Typography;

export default function ReporteLiquidacionDeposito() {
  const hoy = [dayjs().startOf("month"), dayjs().endOf("month")];
  const { mounted, isDesktop } = useClientAndDesktop();
  const [nombreFiltro, setNombreFiltro] = useState("");
  const [messageApi, contextHolder] = message.useMessage();

  const { data, loading, rangoFechas, onFechasChange, fetchData } =
    useFetchReport("/api/liqDeposito/RedDeLiquidacion", rangoInicial);

  const datosFiltrados = useMemo(() => {
    const lista = Array.isArray(data?.detalles) ? data.detalles : [];

    return lista
      .map((item) => ({
        ...item,
        // Campos planos para la tabla
        nombreCliente:
          (item.cliente?.clienteNombre || "") +
          " " +
          (item.cliente?.clienteApellido || ""),
        tipoCafe: item.producto?.productName || "—",
        acciones: (
          <div style={{ display: "flex", gap: 5 }}>
            <Popconfirm
              title="¿Seguro que deseas EXPORTAR este registro?"
              onConfirm={async () => {
                try {
                  messageApi.open({
                    type: "loading",
                    content: "Generando comprobante, por favor espere...",
                    duration: 0,
                    key: "generandoComprobante",
                  });

                  await exportLiquidacionDeposito({
                    tipoCafe: item.producto?.productName || "Tipo de Café",
                    cliente:
                      item.cliente?.clienteNombre +
                        " " +
                        item.cliente?.clienteApellido || "Cliente",
                    cantidadLiquidar: parseFloat(item.liqCatidadQQ || 0),
                    precio: parseFloat(item.liqPrecio || 0),
                    totalPagar: parseFloat(item.liqTotalLps || 0),
                    descripcion: item.liqDescripcion || "",
                    comprobanteID: item.liqID,
                    formaPago: item.liqEn || "",
                  });

                  messageApi.destroy("generandoComprobante");
                  messageApi.success("Comprobante generado correctamente");
                } catch (err) {
                  console.error(err);
                  messageApi.destroy("generandoComprobante");
                  messageApi.error("Error generando comprobante PDF");
                }
              }}
              okText="Sí"
              cancelText="No"
            >
              <Button size="small" type="primary" icon={<FilePdfOutlined />} />
            </Popconfirm>

            <ProtectedButton allowedRoles={["ADMIN", "GERENCIA"]}>
              <Popconfirm
                title="¿Seguro que deseas eliminar este registro?"
                onConfirm={() =>
                  eliminarRecurso({
                    direccion: `/api/liqDeposito/${item.liqID}`,
                    mensajeExito: "Registro anulado correctamente",
                    mensajeError: "Error al anular el registro",
                    messageApi,
                    onRefresh: async () => fetchData(),
                  })
                }
                okText="Sí"
                cancelText="No"
              >
                <Button size="small" danger icon={<DeleteFilled />} />
              </Popconfirm>
            </ProtectedButton>
          </div>
        ),
      }))
      .filter((item) =>
        nombreFiltro
          ? item.nombreCliente
              .toLowerCase()
              .includes(nombreFiltro.toLowerCase())
          : true
      );
  }, [data, nombreFiltro, messageApi, fetchData]);

  const estadisticas = useMemo(() => {
    if (!datosFiltrados.length) return null;
    return datosFiltrados.reduce(
      (acc, item) => ({
        totalRegistros: datosFiltrados.length,
        totalQQ: (acc.totalQQ || 0) + (parseFloat(item.liqCatidadQQ) || 0),
        totalLps: (acc.totalLps || 0) + (parseFloat(item.liqTotalLps) || 0),
      }),
      {}
    );
  }, [datosFiltrados]);

  const columnasDesktop = [
    {
      title: "Liq ID",
      dataIndex: "liqID",
      width: 90,
      align: "center",
      fixed: "left",
    },
    {
      title: "Fecha",
      dataIndex: "liqFecha",
      render: (f) => (f ? dayjs(f).format("DD/MM/YYYY") : "—"),
      width: 120,
    },
    {
      title: "Cliente ID",
      dataIndex: "liqclienteID",
      align: "center",
      width: 100,
      fixed: "left",
    },
    {
      title: "Cliente",
      dataIndex: "nombreCliente",
      render: (text) => (
        <Text style={{ color: "#1890ff", fontWeight: 500 }}>{text}</Text>
      ),
      width: 180,
    },
    {
      title: "Tipo de Café",
      dataIndex: "tipoCafe",
      render: (text) => text || "—",
      width: 150,
    },
    {
      title: "Cantidad QQ",
      dataIndex: "liqCatidadQQ",
      align: "right",
      render: (val) => formatNumber(val),
      width: 120,
    },
    {
      title: "Precio (Lps)",
      dataIndex: "liqPrecio",
      align: "right",
      render: (val) => formatNumber(val),
      width: 130,
    },
    {
      title: "Total (Lps)",
      dataIndex: "liqTotalLps",
      align: "right",
      render: (val) => formatNumber(val),
      width: 130,
    },

    {
      title: "Descripción",
      dataIndex: "liqDescripcion",
      render: (text) => text || "—",
      width: 250,
    },
    {
      title: "Acciones",
      key: "acciones",
      fixed: "right",
      align: "center",
      width: 160,
      render: (text, record) => (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Popconfirm
            title="¿Seguro que deseas EXPORTAR este registro?"
            onConfirm={async () => {
              try {
                messageApi.open({
                  type: "loading",
                  content: "Generando comprobante, por favor espere...",
                  duration: 0,
                  key: "generandoComprobante",
                });

                // Datos a exportar
                await exportLiquidacionDeposito({
                  tipoCafe: record.producto?.productName || "Tipo de Café",
                  cliente:
                    record.cliente?.clienteNombre +
                      " " +
                      record.cliente?.clienteApellido || "Cliente",
                  cantidadLiquidar: parseFloat(record.liqCatidadQQ || 0),
                  precio: parseFloat(record.liqPrecio || 0),
                  totalPagar: parseFloat(record.liqTotalLps || 0),
                  descripcion: record.liqDescripcion || "",
                  comprobanteID: record.liqID,
                  formaPago: record.liqEn || "",
                });

                messageApi.destroy("generandoComprobante");
                messageApi.success("Comprobante generado correctamente");
              } catch (err) {
                console.error("Error generando comprobante:", err);
                messageApi.destroy("generandoComprobante");
                messageApi.error("Error generando comprobante PDF");
              }
            }}
            okText="Sí"
            cancelText="No"
          >
            <Button size="small" type="primary" icon={<FilePdfOutlined />} />
          </Popconfirm>

          <ProtectedButton allowedRoles={["ADMIN", "GERENCIA"]}>
            <Popconfirm
              title="¿Seguro que deseas eliminar este contrato?"
              onConfirm={() =>
                eliminarRecurso({
                  direccion: `/api/liqDeposito/${record.liqID}`,
                  mensajeExito: "Registro anulado correctamente",
                  mensajeError: "Error al anular el registro",
                  messageApi,
                  onRefresh: async () => {
                    if (rangoFechas?.[0] && rangoFechas?.[1]) {
                      await fetchData(
                        rangoFechas[0].startOf("day").toISOString(),
                        rangoFechas[1].endOf("day").toISOString()
                      );
                    } else {
                      await fetchData();
                    }
                  },
                })
              }
              okText="Sí"
              cancelText="No"
            >
              <Button size="small" danger icon={<DeleteFilled />} />
            </Popconfirm>
          </ProtectedButton>
        </div>
      ),
    },
  ];

  const columnasMobile = [
    { label: "Liq ID", key: "liqID" },
    { label: "Fecha", key: "liqFecha" },
    { label: "Cliente", key: "nombreCliente" },
    { label: "Tipo de Café", key: "tipoCafe" },
    { label: "Cantidad QQ", key: "liqCatidadQQ" },
    { label: "Precio (Lps)", key: "liqPrecio" },
    { label: "Total (Lps)", key: "liqTotalLps" },
    { label: "Estado", key: "estado" },
    { label: "Descripción", key: "liqDescripcion" },
    { label: "Acciones", key: "acciones" },
  ];

  if (!mounted) return null;

  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS", "AUDITORES"]}
    >
      <div
        style={{
          padding: isDesktop ? "24px" : "12px",
          background: "#f5f5f5",
          minHeight: "100vh",
        }}
      >
        {contextHolder}

        <Card>
          <SectionHeader
            isDesktop={isDesktop}
            loading={loading}
            icon={<CalendarOutlined />}
            titulo="Reporte de Liquidación de Depósitos"
            subtitulo="Resumen de liquidaciones por cliente"
            onRefresh={() => {
              if (rangoFechas?.[0] && rangoFechas?.[1]) {
                fetchData(
                  rangoFechas[0].startOf("day").toISOString(),
                  rangoFechas[1].endOf("day").toISOString()
                );
              } else {
                fetchData();
              }
            }}
            onExportPDF={() =>
              exportLiquidacionDeposito(
                datosFiltrados,
                {
                  fechaInicio: rangoFechas?.[0]?.toISOString(),
                  fechaFin: rangoFechas?.[1]?.toISOString(),
                  nombreFiltro,
                },
                {
                  totalRegistros: estadisticas?.totalRegistros || 0,
                  totalQQ: estadisticas?.totalQQ || 0,
                  totalLps: estadisticas?.totalLps || 0,
                }
              )
            }
            disableExport={!datosFiltrados.length}
          />

          <Divider />

          <Filtros
            fields={[
              {
                type: "input",
                placeholder: "Buscar por nombre de cliente",
                value: nombreFiltro,
                setter: setNombreFiltro,
                allowClear: true,
              },
              {
                type: "date",
                value: rangoFechas,
                setter: onFechasChange,
                placeholder: "Seleccionar rango de fechas",
              },
            ]}
          />

          {estadisticas && (
            <>
              <Divider />
              <EstadisticasCards
                isDesktop={isDesktop}
                data={[
                  {
                    titulo: "Registros",
                    valor: estadisticas.totalRegistros,
                    icon: <UserOutlined style={{ color: "#1890ff" }} />,
                    color: "#1890ff",
                  },
                  {
                    titulo: "Total QQ",
                    valor: estadisticas.totalQQ.toFixed(2),
                    color: "#fa8c16",
                  },
                  {
                    titulo: "Total Lps",
                    valor: estadisticas.totalLps.toFixed(2),
                    color: "#52c41a",
                  },
                ]}
              />
            </>
          )}
        </Card>

        <Card style={{ borderRadius: 6 }}>
          <div style={{ marginBottom: isDesktop ? 16 : 12 }}>
            <Title
              level={4}
              style={{ margin: 0, fontSize: isDesktop ? 16 : 14 }}
            >
              Detalle por Cliente ({datosFiltrados.length} registros)
            </Title>
            <Text type="secondary" style={{ fontSize: isDesktop ? 14 : 12 }}>
              {rangoFechas?.[0] &&
                rangoFechas?.[1] &&
                `Período: ${rangoFechas[0].format(
                  "DD/MM/YYYY"
                )} - ${rangoFechas[1].format("DD/MM/YYYY")}`}
            </Text>
          </div>

          {isDesktop ? (
            <Table
              columns={columnasDesktop}
              dataSource={datosFiltrados}
              rowKey="liqID"
              loading={loading}
              pagination={false}
              bordered
              scroll={{ x: "max-content" }}
              size="small"
            />
          ) : (
            <TarjetaMobile
              data={datosFiltrados}
              columns={columnasMobile}
              loading={loading}
            />
          )}
        </Card>
      </div>
    </ProtectedPage>
  );
}
