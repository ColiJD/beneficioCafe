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
import EstadisticasCards from "@/components/ReportesElement/DatosEstadisticos";
import dayjs from "dayjs";
import TarjetaMobile from "@/components/TarjetaMobile";
import Filtros from "@/components/Filtros";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import { UserOutlined, CalendarOutlined } from "@ant-design/icons";
import { generarReporteDepositosPDF } from "@/Doc/Reportes/FormatoDepositoDoc";
import { formatNumber } from "@/components/Formulario";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import { useFetchReport } from "@/hook/useFetchReport";
import ProtectedPage from "@/components/ProtectedPage";
import ProtectedButton from "@/components/ProtectedButton";
import { exportDeposito } from "@/Doc/Documentos/desposito";
import { FilePdfOutlined, DeleteFilled, EditFilled } from "@ant-design/icons";
import { rangoInicial } from "../reporteCliente/page";
import { useRouter } from "next/navigation";
import { DetalleDrawer } from "../../transacciones/contrato/detallecontrato/DrawerDetalle";

const { Title, Text } = Typography;

export default function ReporteRegistroDeposito() {
  const hoy = [dayjs().startOf("day"), dayjs().endOf("day")];
  const { mounted, isDesktop } = useClientAndDesktop();
  const [messageApi, contextHolder] = message.useMessage();
  const [nombreFiltro, setNombreFiltro] = useState("");
  const messageApiRef = useRef(messageApi);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detalleSeleccionado, setDetalleSeleccionado] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const {
    data,
    loading,
    rangoFechas,
    onFechasChange,

    fetchData,
  } = useFetchReport("/api/deposito/registrodeposito", rangoInicial);

  const cargarDetalle = async (id) => {
    try {
      setLoadingDetalle(true);
      const res = await fetch(`/api/deposito/${id}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error cargando deposito");

      // Aquí asignamos el resultado al estado
      setDetalleSeleccionado({
        detalleID: data.depositoID,
        fecha: data.depositoFecha,
        cantidadQQ: data.depositoCantidadQQ,
        retencionQQ: data.depositoRetencionQQ,
        observaciones: data.depositoDescripcion,
        clienteID: data.cliente.clienteID,
        clienteNombre: `${data.cliente.clienteNombre} ${data.cliente.clienteApellido}`,
        productoID: data.producto.productID,
        productoNombre: data.producto.productName,
      });

      setDrawerVisible(true); // Abrir drawer
    } catch (err) {
      messageApi.error("No se pudo cargar el deposito");
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleActualizarDetalle = async (values) => {
    if (!detalleSeleccionado) return;

    try {
      messageApi.open({
        type: "loading",
        content: "Actualizando depósito...",
        duration: 0,
      });

      const res = await fetch(
        `/api/deposito/${detalleSeleccionado.detalleID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            depositoID: detalleSeleccionado.detalleID,
            cantidadQQ: Number(values.cantidadQQ),
            retencionQQ: Number(values.retencionQQ),
            observaciones: values.observaciones,
          }),
        },
      );

      const data = await res.json();
      messageApi.destroy();

      if (!res.ok) {
        // Mostrar mensaje con botón para ir al registro de liquidaciones
        return messageApi.open({
          duration: 6,
          content: (
            <div>
              <b>{data.error || "No se pudo actualizar el depósito"}</b>
              <br />
              <Button
                type="primary"
                size="small"
                style={{ marginTop: 6 }}
                onClick={() =>
                  router.push(
                    "/private/page/transacciones/deposito/lipdedeposito",
                  )
                }
              >
                Ver liquidaciones asociadas
              </Button>
            </div>
          ),
        });
      }

      // ÉXITO
      messageApi.success("Depósito actualizado correctamente");
      // 🔄 Actualizar tabla llamando a fetchData
      if (rangoFechas?.[0] && rangoFechas?.[1]) {
        await fetchData(
          rangoFechas[0].startOf("day").toISOString(),
          rangoFechas[1].endOf("day").toISOString(),
        );
      } else {
        await fetchData();
      }

      // Cerrar Drawer
      setDrawerVisible(false);
    } catch (error) {
      console.error(error);
      messageApi.destroy();
      messageApi.error("Error inesperado al actualizar");
    }
  };
  const camposDetalle = [
    { label: "Cliente", key: "clienteNombre", editable: false },
    { label: "Producto", key: "productoNombre", editable: false },
    {
      label: "Cantidad QQ",
      key: "cantidadQQ",
      editable: true,
      type: "number",
      rules: [
        { required: true, message: "Ingrese cantidad" },
        { type: "number", min: 1, message: "Debe ser mayor a 0" },
      ],
    },
    {
      label: "Retención QQ",
      key: "retencionQQ",
      editable: false,
      render: (detalle, editValues) => {
        const cantidad = editValues?.cantidadQQ ?? detalle.cantidadQQ;
        const retencion = cantidad * 0.96; // 4%

        return `${formatNumber(retencion)}`;
      },
    },
    {
      label: "Observaciones",
      key: "observaciones",
      editable: true,
    },
    {
      label: "Fecha",
      key: "fecha",
      editable: false,
      render: (detalle) => dayjs(detalle.fecha).format("DD/MM/YYYY"),
    },
  ];

  const datosFiltrados = useMemo(() => {
    const lista = Array.isArray(data?.detalles) ? data.detalles : [];
    return lista.filter((item) =>
      !nombreFiltro
        ? true
        : item.nombreCliente
            ?.toLowerCase()
            .includes(nombreFiltro.toLowerCase()),
    );
  }, [data, nombreFiltro]);

  const estadisticas = useMemo(() => {
    if (!datosFiltrados.length) return null;
    return datosFiltrados.reduce(
      (acc, item) => ({
        totalRegistros: datosFiltrados.length,
        totalQQ: (acc.totalQQ || 0) + (parseFloat(item.cantidadQQ) || 0),
      }),
      {},
    );
  }, [datosFiltrados]);

  //Columnas Desktop
  const columnasDesktop = [
    {
      title: "Deposito ID",
      dataIndex: "id",
      width: 100,
      fixed: "left",
    },
    {
      title: "Fecha",
      dataIndex: "fecha",
      width: 120,
      render: (f) => dayjs(f).format("DD/MM/YYYY"),
    },
    {
      title: "Cliente ID",
      dataIndex: "clienteID",
      width: 100,
      fixed: "left",
    },
    {
      title: "Cliente",
      dataIndex: "nombreCliente",
      width: 180,
      render: (text) => <Text style={{ color: "#4A2E16" }}>{text}</Text>,
    },
    {
      title: "Tipo de Café",
      dataIndex: "tipoCafe",
      width: 150,
      render: (text) => text || "—",
    },
    {
      title: "Depósito QQ",
      dataIndex: "cantidadQQ",
      width: 120,
      render: (val) => <Text>{formatNumber(val)}</Text>,
    },
    {
      title: "Retención QQ",
      dataIndex: "retencionQQ",
      width: 120,
      render: (val) => <Text>{formatNumber(val)}</Text>,
    },
    {
      title: "Estado",
      dataIndex: "estadoDeposito",
      width: 120,
      render: (text) => (
        <Text
          style={{
            color:
              text === "Completado"
                ? "#2F5A3B"
                : text === "Pendiente"
                  ? "#B8801F"
                  : "#A6232B",
          }}
        >
          {text || "—"}
        </Text>
      ),
    },
    {
      title: "Descripción",
      dataIndex: "descripcion",
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
            title="¿Seguro que deseas EXPORTAR esta compra?"
            onConfirm={async () => {
              // Mostrar mensaje inicial
              messageApi.open({
                type: "loading",
                content:
                  "Generando comprobante de depósito, por favor espere...",
                duration: 0,
                key: "generandoComprobante",
              });

              try {
                // ✅ COMPRA
                await exportDeposito({
                  cliente: { label: record.nombreCliente },
                  productos: [
                    {
                      nombre: record.tipoCafe,
                      cantidad: parseFloat(record.cantidadQQ),
                    },
                  ],
                  total: parseFloat(record.totalLps),
                  observaciones: record.descripcion,
                  comprobanteID: record.id,
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
          <ProtectedButton accion="editar">
            <Button
              size="small"
              type="default"
              icon={<EditFilled />}
              onClick={() => cargarDetalle(record.id)}
            />
          </ProtectedButton>
          <ProtectedButton accion="eliminar">
            <Popconfirm
              title="¿Seguro que deseas eliminar este depósito?"
              onConfirm={() => eliminarDeposito(record.id)}
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

  const eliminarDeposito = async (id) => {
    try {
      const res = await fetch(`/api/deposito/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok) {
        messageApiRef.current.success("Depósito eliminado correctamente");
        // Recargar datos después de eliminar
        if (rangoFechas?.[0] && rangoFechas?.[1]) {
          await fetchData(
            rangoFechas[0].startOf("day").toISOString(),
            rangoFechas[1].endOf("day").toISOString(),
          );
        } else {
          await fetchData();
        }
      } else {
        // Si no se puede anular, mostrar mensaje con botón al registro de entregas
        messageApi.open({
          duration: 6,
          content: (
            <div>
              <b>{data.error || "No se puede anular el deposito"}</b>

              <br />
              <Button
                type="primary"
                size="small"
                onClick={() =>
                  router.push(
                    "/private/page/transacciones/deposito/lipdedeposito",
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
      messageApiRef.current.error("Error al eliminar el depósito");
    }
  };

  // Columnas Mobile
  const columnasMobile = [
    { label: "Deposito ID", key: "id" },
    { label: "Fecha", key: "fecha" },
    { label: "Cliente ID", key: "clienteID" },
    { label: "Cliente", key: "nombreCliente" },
    { label: "Tipo de Café", key: "tipoCafe" },
    { label: "Depósito QQ", key: "cantidadQQ" },
    { label: "Retención QQ", key: "retencionQQ" },
    { label: "Estado", key: "estadoDeposito" },
    { label: "Descripción", key: "descripcion" },
    { label: "Acciones", key: "acciones" },
  ];

  if (!mounted) return null;

  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "COLABORADORES", "AUDITORES"]}
    >
      <div
        style={{
          padding: isDesktop ? "24px" : "12px",
          background: "#EFE6D0",
          minHeight: "100vh",
        }}
      >
        {contextHolder}
        <DetalleDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          detalle={detalleSeleccionado}
          loading={loadingDetalle}
          isDesktop={isDesktop}
          onFinish={handleActualizarDetalle}
          campos={camposDetalle}
        />

        <Card>
          <SectionHeader
            isDesktop={isDesktop}
            loading={loading}
            icon={<CalendarOutlined />}
            titulo="Reporte de Depósitos"
            subtitulo="Resumen de depósitos por cliente"
            onRefresh={() => {
              if (rangoFechas?.[0] && rangoFechas?.[1]) {
                fetchData(
                  rangoFechas[0].startOf("day").toISOString(),
                  rangoFechas[1].endOf("day").toISOString(),
                );
              } else {
                fetchData();
              }
            }}
            onExportPDF={() =>
              generarReporteDepositosPDF(
                datosFiltrados,
                {
                  fechaInicio: rangoFechas?.[0]?.toISOString(),
                  fechaFin: rangoFechas?.[1]?.toISOString(),
                  nombreFiltro,
                },
                { title: "Reporte de Depósitos" },
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
                    icon: <UserOutlined style={{ color: "#4A2E16" }} />,
                    color: "#4A2E16",
                  },
                  {
                    titulo: "Total QQ",
                    valor: estadisticas.totalQQ,
                    color: "#B8801F",
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
                  "DD/MM/YYYY",
                )} - ${rangoFechas[1].format("DD/MM/YYYY")}`}
            </Text>
          </div>

          {isDesktop ? (
            <Table
              columns={columnasDesktop}
              dataSource={datosFiltrados}
              rowKey="id"
              loading={loading}
              pagination={false}
              bordered
              scroll={{ x: 1200 }}
              size="small"
            />
          ) : (
            <TarjetaMobile
              data={datosFiltrados.map((item) => ({
                ...item,
                acciones: (
                  <div style={{ display: "flex", gap: 6 }}>
                    <ProtectedButton accion="editar">
                      <Button
                        size="small"
                        type="default"
                        icon={<EditFilled />}
                        onClick={() => cargarDetalle(item.id)}
                      />
                    </ProtectedButton>

                    <Popconfirm
                      title="¿Seguro que deseas EXPORTAR esta compra?"
                      onConfirm={async () => {
                        // Mostrar mensaje inicial
                        messageApi.open({
                          type: "loading",
                          content:
                            "Generando comprobante de depósito, por favor espere...",
                          duration: 0,
                          key: "generandoComprobante",
                        });

                        try {
                          // ✅ COMPRA
                          await exportDeposito({
                            cliente: { label: item.nombreCliente },
                            productos: [
                              {
                                nombre: item.tipoCafe,
                                cantidad: parseFloat(item.cantidadQQ),
                              },
                            ],
                            total: parseFloat(item.totalLps),
                            observaciones: item.descripcion,
                            comprobanteID: item.id,
                            fecha: item.fecha,
                          });

                          // Éxito
                          messageApi.destroy("generandoComprobante");
                          messageApi.success(
                            "Comprobante generado correctamente",
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

                    <ProtectedButton accion="eliminar">
                      <Popconfirm
                        title="¿Seguro que deseas eliminar este depósito?"
                        onConfirm={() => eliminarDeposito(item.id)}
                        okText="Sí"
                        cancelText="No"
                      >
                        <Button size="small" danger icon={<DeleteFilled />} />
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
