"use client";

import { useState, useMemo, useRef } from "react";
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
import { CalendarOutlined, UserOutlined } from "@ant-design/icons";
import { generarReporteContratos } from "@/Doc/Reportes/FormatoContratoDoc";
import Filtros from "@/components/Filtros";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import EstadisticasCards from "@/components/ReportesElement/DatosEstadisticos";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import { useFetchReport } from "@/hook/useFetchReport";
import TarjetaMobile from "@/components/TarjetaMobile";
import ProtectedPage from "@/components/ProtectedPage";
import ProtectedButton from "@/components/ProtectedButton";
import { exportContratoSalida } from "@/Doc/Documentos/contratoSalida";
import { DeleteFilled, FilePdfOutlined, EditFilled } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { rangoInicial } from "../../../informe/reporteCliente/page";

const { Title, Text } = Typography;

export default function ReporteRegistroContrato() {
  const hoy = [dayjs().startOf("day"), dayjs().endOf("day")];
  const { mounted, isDesktop } = useClientAndDesktop();
  const [nombreFiltro, setNombreFiltro] = useState("");
  const [messageApi, contextHolder] = message.useMessage();

  const { data, loading, rangoFechas, onFechasChange, fetchData } =
    useFetchReport("/api/contratoSalida/registrocontrato", rangoInicial);

  const datosFiltrados = useMemo(() => {
    const lista = Array.isArray(data?.detalles) ? data.detalles : [];
    return lista.filter((item) =>
      !nombreFiltro
        ? true
        : item.nombreCliente?.toLowerCase().includes(nombreFiltro.toLowerCase())
    );
  }, [data, nombreFiltro]);

  const estadisticas = useMemo(() => {
    if (!datosFiltrados.length) return null;
    return datosFiltrados.reduce(
      (acc, item) => ({
        totalRegistros: datosFiltrados.length,
        totalQQ: (acc.totalQQ || 0) + (parseFloat(item.cantidadQQ) || 0),
        totalLps: (acc.totalLps || 0) + (parseFloat(item.totalLps) || 0),
      }),
      {}
    );
  }, [datosFiltrados]);

  // Columnas Desktop
  const columnasDesktop = [
    {
      title: "Contrato ID",
      dataIndex: "contratoID",
      width: 100,
      align: "center",
      fixed: "left",
    },

    {
      title: "Fecha",
      dataIndex: "fecha",
      width: 120,
      render: (f) => dayjs(f).format("DD/MM/YYYY"),
    },
    {
      title: "Comprador ID",
      dataIndex: "clienteID",
      width: 60,
      fixed: "left",
      align: "center",
    },
    {
      title: "Comprador",
      dataIndex: "nombreCliente",
      width: 200,
      render: (text) => <Text style={{ color: "#1890ff" }}>{text}</Text>,
    },
    {
      title: "Tipo de Café",
      dataIndex: "tipoCafe",
      width: 150,
      render: (text) => text || "—",
    },
    {
      title: "Cantidad QQ",
      dataIndex: "cantidadQQ",
      align: "right",
      render: (val) => <Text>{val.toFixed(2)}</Text>,
    },
    {
      title: "Precio (Lps)",
      dataIndex: "precio",
      align: "right",
      render: (val) =>
        val ? <Text>L. {val.toFixed(2)}</Text> : <Text>—</Text>,
    },
    {
      title: "Total (Lps)",
      dataIndex: "totalLps",
      align: "right",
      render: (val) => <Text>L. {val.toFixed(2)}</Text>,
    },

    {
      title: "Descripción",
      dataIndex: "descripcion",
      width: 250,
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
            title="¿Seguro que deseas EXPORTAR esta compra?"
            onConfirm={async () => {
              // Mostrar mensaje inicial
              messageApi.open({
                type: "loading",
                content:
                  "Generando comprobante de contrato, por favor espere...",
                duration: 0,
                key: "generandoComprobante",
              });

              try {
                // ✅ COMPRA
                await exportContratoSalida({
                  cliente: { label: record.nombreCliente },
                  producto: { label: record.tipoCafe },
                  contratoCantidadQQ: parseFloat(record.cantidadQQ),
                  contratoPrecio: parseFloat(record.precio),
                  contratoTotalLps: parseFloat(record.totalLps),
                  contratoDescripcion: record.descripcion,
                  contratoID: record.contratoID,
                  fecha: record.fecha,
                });

                // Éxito
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
          <ProtectedButton allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS"]}>
            <Popconfirm
              title="¿Seguro que deseas EDITAR este contrato?"
              onConfirm={() =>
                router.push(
                  `/private/page/transacciones/contratoSalida/${record.contratoID}`
                )
              }
              okText="Sí"
              cancelText="No"
            >
              <Button size="small" type="default" icon={<EditFilled />} />
            </Popconfirm>
          </ProtectedButton>
          <ProtectedButton allowedRoles={["ADMIN", "GERENCIA"]}>
            <Popconfirm
              title="¿Seguro que deseas eliminar este contrato"
              onConfirm={() => eliminarContrato(record.contratoID)}
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

  const router = useRouter();

  // Eliminar contrato
  const eliminarContrato = async (contratoID) => {
    try {
      const res = await fetch(`/api/contratoSalida/${contratoID}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok) {
        // Contrato anulado correctamente
        messageApi.success("Contrato anulado correctamente");

        // Recarga la tabla
        if (rangoFechas?.[0] && rangoFechas?.[1]) {
          fetchData(
            rangoFechas[0].startOf("day").toISOString(),
            rangoFechas[1].endOf("day").toISOString()
          );
        } else {
          fetchData();
        }
      } else {
        // Si no se puede anular, mostrar mensaje con botón al registro de entregas
        messageApi.open({
          duration: 6,
          content: (
            <div>
              <b>{data.error || "No se puede anular el contrato"}</b>

              <br />
              <Button
                type="primary"
                size="small"
                onClick={() =>
                  router.push(
                    "/private/page/transacciones/contratoSalida/detallecontrato"
                  )
                }
              >
                Ir al registro de entregas
              </Button>
            </div>
          ),
        });
      }
    } catch (error) {
      console.error(error);
      messageApi.error("Error al anular el contrato");
    }
  };

  // móviles
  const columnasMobile = [
    { label: "Contrato ID", key: "contratoID" },
    { label: "Fecha", key: "fecha" },
    { label: "Comprador", key: "nombreCliente" },
    { label: "Tipo de Café", key: "tipoCafe" },
    { label: "Cantidad QQ", key: "cantidadQQ" },
    { label: "Precio (Lps)", key: "precio" },
    { label: "Total Lps", key: "totalLps" },
    { label: "Estado", key: "estado" },
    { label: "Descripción", key: "descripcion" },
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
            titulo="Reporte de Contratos"
            subtitulo="Resumen de contratos por cliente"
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
              generarReporteContratos(
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
                placeholder: "Buscar por nombre de comprador",
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
                    valor: estadisticas.totalQQ,
                    color: "#fa8c16",
                  },
                  {
                    titulo: "Total Lps",
                    valor: estadisticas.totalLps,
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
              rowKey="contratoID"
              loading={loading}
              pagination={false}
              bordered
              scroll={{ x: "max-content" }}
              size="small"
            />
          ) : (
            <TarjetaMobile
              data={datosFiltrados.map((item) => ({
                ...item,
                acciones: (
                  <div style={{ display: "flex", gap: 6 }}>
                    <Popconfirm
                      title="¿Seguro que deseas EXPORTAR esta compra?"
                      onConfirm={async () => {
                        // Mostrar mensaje inicial
                        messageApi.open({
                          type: "loading",
                          content:
                            "Generando comprobante de contrato, por favor espere...",
                          duration: 0,
                          key: "generandoComprobante",
                        });

                        try {
                          await exportContratoSalida({
                            cliente: { label: item.nombreCliente },
                            producto: { label: item.tipoCafe },
                            contratoCantidadQQ: parseFloat(item.cantidadQQ),
                            contratoPrecio: parseFloat(item.precio),
                            contratoTotalLps: parseFloat(item.totalLps),
                            contratoDescripcion: item.descripcion,
                            contratoID: item.contratoID,
                            fecha: item.fecha,
                          });

                          // Éxito
                          messageApi.destroy("generandoComprobante");
                          messageApi.success(
                            "Comprobante generado correctamente"
                          );
                        } catch (err) {
                          console.error("Error generando comprobante:", err);
                          messageApi.destroy("generandoComprobante");
                          messageApi.error("Error generando comprobante PDF");
                        }
                      }}
                      okText="Sí"
                      cancelText="No"
                    >
                      <Button
                        size="small"
                        type="primary"
                        icon={<FilePdfOutlined />}
                      />
                    </Popconfirm>

                    <ProtectedButton allowedRoles={["ADMIN", "GERENCIA"]}>
                      <Popconfirm
                        title="¿Seguro que deseas eliminar este contrato?"
                        onConfirm={() => eliminarContrato(item.contratoID)}
                        okText="Sí"
                        cancelText="No"
                      >
                        <Button size="small" danger>
                          Eliminar
                        </Button>
                      </Popconfirm>
                    </ProtectedButton>
                  </div>
                ),
              }))}
              columns={columnasMobile}
              loading={loading}
            />
          )}
        </Card>
      </div>
    </ProtectedPage>
  );
}
