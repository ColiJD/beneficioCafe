"use client";

import { useState, useMemo, useRef } from "react";
import {
  Table,
  Card,
  Typography,
  Divider,
  message,
  Popconfirm,
  Button,
} from "antd";
import dayjs from "dayjs";
import TarjetaMobile from "@/components/TarjetaMobile";
import Filtros from "@/components/Filtros";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import { eliminarRecurso } from "../registro/page";
import {
  CalendarOutlined,
  UserOutlined,
  FilePdfOutlined,
  DeleteFilled,
} from "@ant-design/icons";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import { useFetchReport } from "@/hook/useFetchReport";
import ProtectedPage from "@/components/ProtectedPage";
import EstadisticasCards from "@/components/ReportesElement/DatosEstadisticos";
import ProtectedButton from "@/components/ProtectedButton";
import { PDFComprobante } from "@/Doc/Documentos/generico";
import { rangoInicial } from "../../../informe/reporteCliente/page";

const { Title, Text } = Typography;

export default function ReporteLiqSalida() {
  const hoy = [dayjs().startOf("day"), dayjs().endOf("day")];

  const { mounted, isDesktop } = useClientAndDesktop();
  const [messageApi, contextHolder] = message.useMessage();
  const messageApiRef = useRef(messageApi);

  const [nombreFiltro, setNombreFiltro] = useState("");

  const { data, loading, rangoFechas, onFechasChange, fetchData } =
    useFetchReport("/api/salidas/liquidarSalida", rangoInicial);

  const datosFiltrados = useMemo(() => {
    const lista = Array.isArray(data) ? data : [];

    return lista
      .map((item) => ({
        ...item,
        compradorNombre: item.compradores?.compradorNombre || "—",
        acciones: (
          <div style={{ display: "flex", gap: 5 }}>
            <ProtectedButton allowedRoles={["ADMIN", "GERENCIA"]}>
              <Popconfirm
                title="¿Seguro que deseas eliminar este contrato?"
                onConfirm={() =>
                  eliminarRecurso({
                    direccion: `/api/salidas/liquidarSalida/${item.liqSalidaID}`,
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
      }))
      .filter((item) =>
        nombreFiltro
          ? item.compradorNombre
              .toLowerCase()
              .includes(nombreFiltro.toLowerCase())
          : true
      );
  }, [data, nombreFiltro, messageApi, rangoFechas, fetchData]);

  const estadisticas = useMemo(() => {
    if (!datosFiltrados.length) return null;
    return {
      totalRegistros: datosFiltrados.length,
      totalQQ: datosFiltrados.reduce(
        (acc, s) => acc + Number(s.liqCantidadQQ || 0),
        0
      ),
    };
  }, [datosFiltrados]);

  const columnasDesktop = [
    { title: "LiqSalida ID", dataIndex: "liqSalidaID", width: 90 },
    {
      title: "Fecha",
      dataIndex: "liqFecha",
      width: 120,
      render: (f) => dayjs(f).format("DD/MM/YYYY"),
    },
    {
      title: "Comprador ID",
      dataIndex: ["compradores", "compradorId"],
      width: 100,
    },
    {
      title: "Comprador",
      dataIndex: ["compradores", "compradorNombre"],
      width: 200,
      render: (text) => <Text style={{ color: "#1890ff" }}>{text}</Text>,
    },
    {
      title: "Movimiento",
      dataIndex: "liqMovimiento",
      width: 120,
      render: (text) => text || "—",
    },
    {
      title: "Cantidad QQ",
      dataIndex: "liqCantidadQQ",
      width: 120,
    },
    {
      title: "Descripción",
      dataIndex: "liqDescripcion",
      width: 200,
      render: (text) => text || "—",
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
                await PDFComprobante({
                  tipoComprobante:
                    "COMPROBANTE DE LIQUIDACION ",
                  cliente: record.compradores?.compradorNombre || "—",
                  productos: [
                    {
                      nombre: "Café Seco",
                      cantidad: parseFloat(record.liqCantidadQQ || 0),
                    },
                  ],
                  total:parseFloat(record.liqCantidadQQ || 0), // para mostrar en letras,
                  observaciones: record.liqDescripcion || "—",
                  comprobanteID: record.liqSalidaID,
                  columnas: [
                    { title: "Producto", key: "nombre" },
                    { title: "Cantidad (QQ)", key: "cantidad" },
                  ],
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
                  direccion: `/api/salidas/liquidarSalida/${record.liqSalidaID}`,
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
    { label: "ID", key: "liqSalidaID" },
    { label: "Fecha", key: "liqFecha" },
    { label: "Comprador", key: "compradores.compradorNombre" },
    { label: "Movimiento", key: "liqMovimiento" },
    { label: "Cantidad QQ", key: "liqCantidadQQ" },
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
            titulo="Reporte Liquidación de Salidas"
            subtitulo="Listado de liquidaciones por comprador"
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
            disableExport={true}
          />

          <Divider />

          <Filtros
            fields={[
              {
                type: "input",
                placeholder: "Buscar por comprador",
                value: nombreFiltro,
                setter: setNombreFiltro,
                allowClear: true,
              },
              {
                type: "date",
                value: rangoFechas,
                setter: onFechasChange,
                placeholder: "Seleccionar rango",
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
                    valor: estadisticas.totalQQ,
                    color: "#fa8c16",
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
              Detalle de Liquidaciones ({datosFiltrados.length} registros)
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
              rowKey="liqSalidaID"
              loading={loading}
              pagination={false}
              bordered
              scroll={{ x: 900 }}
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
