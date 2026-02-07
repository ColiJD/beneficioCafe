"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  Table,
  Row,
  Col,
  message,
  Button,
  Popconfirm,
  Dropdown,
  Divider,
  Card,
} from "antd";
import TarjetasDeTotales from "@/components/DetallesCard";
import Filtros from "@/components/Filtros";
import { FiltrosTarjetas } from "@/lib/FiltrosTarjetas";
import dayjs from "dayjs";
import TarjetaMobile from "@/components/TarjetaMobile";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import customParseFormat from "dayjs/plugin/customParseFormat";
import Link from "next/link";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import { exportCompraDirecta } from "@/Doc/Documentos/compra";
import { exportVentaDirecta } from "@/Doc/Documentos/venta";

import ProtectedPage from "@/components/ProtectedPage";
import { formatNumber } from "@/components/Formulario";
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(customParseFormat);
import ProtectedButton from "@/components/ProtectedButton";
import { useRouter } from "next/navigation";

import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import { generarReportePDF } from "@/Doc/Reportes/compraVenta";

import {
  FilePdfOutlined,
  CalendarOutlined,
  EditFilled,
  DeleteFilled,
} from "@ant-design/icons";

export default function TablaCompras() {
  const { mounted, isDesktop } = useClientAndDesktop();
  const isMobile = mounted && !isDesktop;

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const messageApiRef = useRef(messageApi);
  const router = useRouter();

  const [nombreFiltro, setNombreFiltro] = useState("");
  const [rangoFecha, setRangoFecha] = useState([dayjs(), dayjs()]);
  const [movimientoFiltro, setMovimientoFiltro] = useState("Entrada"); // Entrada o Salida

  // 🔹 Cargar datos desde API
  const cargarDatos = async () => {
    setLoading(true);
    try {
      // 🔹 Elegir la API según el tipo de movimiento
      const apiURL =
        movimientoFiltro === "Salida" ? "/api/compras/salidas" : "/api/compras";

      const res = await fetch(apiURL);
      if (!res.ok) throw new Error("Error al cargar los datos");
      const data = await res.json();

      // 🔹 Filtrar solo los movimientos si la API devuelve ambos tipos
      const dataFiltrada = data.filter(
        (item) => item.compraMovimiento === movimientoFiltro
      );

      // 🔹 Agrupar por cliente y tipo de café
      const mapa = {};
      dataFiltrada.forEach((item) => {
        const cantidad = parseFloat(item.compraCantidadQQ || 0);
        const precio = parseFloat(item.compraPrecioQQ || 0);
        const totalLps = cantidad * precio;

        // 🔹 Cambios para mostrar comprador en Salidas
        const key =
          movimientoFiltro === "Salida"
            ? `${item.compradorID}` // Agrupar por comprador
            : `${item.clienteID}`;

        const nombreCompleto =
          movimientoFiltro === "Salida"
            ? item.compradorNombre // Nombre del comprador
            : item.clienteNombreCompleto;

        if (!mapa[key]) {
          mapa[key] = {
            clienteID:
              movimientoFiltro === "Salida" ? item.compradorID : item.clienteID, // ID dinámico
            clienteNombreCompleto: nombreCompleto,
            tipoCafeNombre: item.tipoCafeNombre,
            cantidadTotal: 0,
            totalLps: 0,
            compraMovimiento: item.compraMovimiento,
            detalles: [],
          };
        } else {
          if (!mapa[key].compraMovimiento.includes(item.compraMovimiento)) {
            mapa[key].compraMovimiento += `, ${item.compraMovimiento}`;
          }
        }

        mapa[key].cantidadTotal += cantidad;
        mapa[key].totalLps += totalLps;

        mapa[key].detalles.push({
          ...item,
          compraCantidadQQ: parseFloat(item.compraCantidadQQ || 0),
          compraPrecioQQ: parseFloat(item.compraPrecioQQ || 0),
          totalLps,
          clienteNombreCompleto:
            movimientoFiltro === "Salida"
              ? item.compradorNombre
              : item.clienteNombreCompleto,
        });
      });

      const groupedData = Object.values(mapa);
      setData(groupedData);
      setFilteredData(groupedData);
    } catch (error) {
      console.error(error);
      messageApiRef.current.error("No se pudieron cargar las compras");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [movimientoFiltro]);

  // 🔹 Aplicar filtros
  const aplicarFiltros = () => {
    const filtros = {
      clienteNombreCompleto: nombreFiltro,
    };

    const filtrados = FiltrosTarjetas(data, filtros, rangoFecha, "compraFecha");
    setFilteredData(filtrados);
  };

  useEffect(() => {
    aplicarFiltros();
  }, [nombreFiltro, rangoFecha, data]);

  // 🔹 Totales
  const totalQQ = filteredData.reduce(
    (acc, item) => acc + (item.cantidadTotal || 0),
    0
  );
  const totalLps = filteredData.reduce(
    (acc, item) => acc + (item.totalLps || 0),
    0
  );

  // 🔹 Columnas de tabla principal
  const columns = [
    {
      title: movimientoFiltro === "Salida" ? "ID Comprador" : "ID Cliente",
      dataIndex: "clienteID",
      key: "clienteID",
      width: 50,
      fixed: "left",
      align: "center",
    },
    {
      title: movimientoFiltro === "Salida" ? "Comprador" : "Cliente",
      align: "center",
      dataIndex: "clienteNombreCompleto",
      key: "clienteNombreCompleto",
      render: (text, record) =>
        movimientoFiltro === "Salida" ? (
          <span>{text}</span> // Para salidas, solo mostrar texto
        ) : (
          <Link
            href={`/private/page/transacciones/compra/vista/${record.clienteID}`}
          >
            {text}
          </Link>
        ),
    },
    {
      title: "Total (QQ)",
      align: "center",
      dataIndex: "cantidadTotal",
      key: "cantidadTotal",
      render: (val) => formatNumber(val),
    },
    {
      title: "Total (Lps)",
      align: "center",
      dataIndex: "totalLps",
      key: "totalLps",
      render: (val) => formatNumber(val),
    },
  ];

  // 🔹 Columnas de detalles
  const detalleColumns = [
    {
      title: "Compra ID",
      dataIndex: "compraId",
      key: "compraId",
      fixed: "left",
      align: "center",
    },
    {
      title: "Tipo Café",
      dataIndex: "tipoCafeNombre",
      key: "tipoCafeNombre",
      align: "center",
    },
    {
      title: "Fecha",
      dataIndex: "compraFecha",
      align: "center",
      key: "compraFecha",
      render: (val) => dayjs(val, "YYYY-MM-DD").format("DD/MM/YYYY"),
    },
    {
      title: "Cantidad (QQ)",
      dataIndex: "compraCantidadQQ",
      align: "center",
      key: "compraCantidadQQ",
      render: (val) => formatNumber(val),
    },
    {
      title: "Precio (Lps)",
      dataIndex: "compraPrecioQQ",
      align: "center",
      key: "compraPrecioQQ",
      render: (val) => formatNumber(val),
    },

    {
      title: "Total (Lps)",
      dataIndex: "totalLps",
      align: "center",
      key: "totalLps",
      render: (val) => formatNumber(val),
    },
    {
      title: "Sacos",
      dataIndex: "compraTotalSacos",
      align: "center",
      key: "compraTotalSacos",
      render: (val) => formatNumber(val),
    },
    {
      title: "Descripción",
      dataIndex: "compraDescripcion",
      align: "center",
      key: "compraDescripcion",
    },
    {
      title: "Acciones",
      key: "acciones",
      fixed: "right",
      align: "center",
      width: 120,
      render: (text, record) => (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 5,
          }}
        >
          {" "}
          <Popconfirm
            title="¿Seguro que deseas EXPORTAR esta compra?"
            onConfirm={async () => {
              const esVenta = movimientoFiltro === "Salida";

              // Mostrar mensaje inicial
              messageApi.open({
                type: "loading",
                content: esVenta
                  ? "Generando comprobante de venta, por favor espere..."
                  : "Generando comprobante de compra, por favor espere...",
                duration: 0,
                key: "generandoComprobante",
              });

              try {
                if (esVenta) {
                  // ✅ VENTA
                  const { exportVentaDirecta } = await import(
                    "@/Doc/Documentos/venta"
                  );

                  await exportVentaDirecta({
                    comprador: { label: record.clienteNombreCompleto },
                    productos: [
                      {
                        nombre: record.tipoCafeNombre,
                        cantidad: parseFloat(record.compraCantidadQQ),
                        precio: parseFloat(record.compraPrecioQQ),
                        total: parseFloat(record.totalLps),
                      },
                    ],
                    total: parseFloat(record.totalLps),
                    observaciones: record.compraDescripcion,
                    comprobanteID: record.compraId,
                    fecha: record.compraFecha,
                  });
                } else {
                  // ✅ COMPRA
                  await exportCompraDirecta({
                    cliente: { label: record.clienteNombreCompleto },
                    productos: [
                      {
                        nombre: record.tipoCafeNombre,
                        cantidad: parseFloat(record.compraCantidadQQ),
                        precio: parseFloat(record.compraPrecioQQ),
                        total: parseFloat(record.totalLps),
                      },
                    ],
                    total: parseFloat(record.totalLps),
                    observaciones: record.compraDescripcion,
                    comprobanteID: record.compraId,
                    fecha: record.compraFecha,
                  });
                }

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
              title="¿Seguro que deseas EDITAR esta compra"
              onConfirm={() =>
                router.push(
                  movimientoFiltro === "Salida"
                    ? `/private/page/transacciones/venta/${record.compraId}`
                    : `/private/page/transacciones/compra/${record.compraId}`
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
              title="¿Seguro que deseas eliminar esta compra"
              onConfirm={() => eliminarCompra(record.compraId)}
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

  // Eliminar compra
  const eliminarCompra = async (compraId) => {
    try {
      const res = await fetch(`/api/compras/${compraId}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        messageApiRef.current.success("Compra eliminada correctamente");
        // Recargar datos después de eliminar
        cargarDatos();
      } else {
        messageApiRef.current.error(
          data.error || "Error al eliminar la compra"
        );
      }
    } catch (error) {
      console.error(error);
      messageApiRef.current.error("Error al eliminar la compra");
    }
  };

  // 🔹 Preparar datos normalizados según tipo de movimiento

  // Evitar renderizado hasta detectar dispositivo
  if (!mounted) return null;

  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS", "AUDITORES"]}
    >
      <>
        {contextHolder}
        <div
          style={{
            padding: isDesktop ? "24px" : "12px",
            background: "#f5f5f5",
            minHeight: "100vh",
          }}
        >
          <Card>
            <SectionHeader
              isDesktop={isDesktop}
              loading={loading}
              icon={<CalendarOutlined />}
              titulo="Registro de compra y venta directa"
              subtitulo="Resumen de compras y ventas por cliente o comprador"
              onRefresh={cargarDatos}
              onExportPDF={() => {
                const inicio = rangoFecha?.[0]?.isValid()
                  ? rangoFecha[0].toISOString()
                  : null;
                const fin = rangoFecha?.[1]?.isValid()
                  ? rangoFecha[1].toISOString()
                  : null;

                generarReportePDF(
                  filteredData,
                  {
                    nombreFiltro,
                    fechaInicio: inicio,
                    fechaFin: fin,
                    movimiento: movimientoFiltro,
                  },
                  {
                    title: `Registro de ${
                      movimientoFiltro === "Salida" ? "ventas" : "compras"
                    }`,
                  }
                );
              }}
            />

            <TarjetasDeTotales
              cards={[
                {
                  title: "Total (QQ)",
                  value: formatNumber(totalQQ),
                },
                {
                  title: "Total (Lps)",
                  value: formatNumber(totalLps),
                },
              ]}
            />

            <Divider />
            <Filtros
              fields={[
                {
                  type: "input",
                  placeholder:
                    movimientoFiltro === "Salida"
                      ? "Buscar por comprador"
                      : "Buscar por cliente",
                  value: nombreFiltro,
                  setter: setNombreFiltro,
                },
                { type: "date", value: rangoFecha, setter: setRangoFecha },
                {
                  type: "select",
                  label: "Movimiento",
                  options: [
                    { label: "Entrada (POR CLIENTE)", value: "Entrada" },
                    { label: "Salida (POR COMPRADOR)", value: "Salida" },
                  ],
                  value: movimientoFiltro,
                  setter: setMovimientoFiltro,
                },
              ]}
            />
            <Divider />

            {/* Tabla responsive */}
            {isMobile ? (
              <TarjetaMobile
                loading={loading}
                data={filteredData}
                columns={[
                  {
                    label: "Cliente / Comprador",
                    key: "clienteNombreCompleto",
                    render: (text, record) => {
                      // ✅ Si tiene compradorID → es una venta
                      const isVenta = !!record.compradorID;
                      const targetId = isVenta
                        ? record.compradorID
                        : record.clienteID;
                      const tipoRuta = isVenta ? "venta" : "compra";

                      return (
                        <Link
                          href={`/private/page/transacciones/${tipoRuta}/vista/${targetId}`}
                        >
                          {text}
                        </Link>
                      );
                    },
                  },
                  {
                    label: "Total (QQ)",
                    key: "cantidadTotal",
                    render: (val) => formatNumber(val),
                  },
                  {
                    label: "Total (Lps)",
                    key: "totalLps",
                    render: (val) => formatNumber(val),
                  },
                ]}
                detailsKey="detalles"
                detailsColumns={[
                  { label: "Registro ID", key: "compraId" },
                  { label: "Tipo Café", key: "tipoCafeNombre" },
                  {
                    label: "Fecha",
                    key: "compraFecha",
                    render: (val) =>
                      dayjs(val, "YYYY-MM-DD").format("DD/MM/YYYY"),
                  },
                  {
                    label: "Cantidad (QQ)",
                    key: "compraCantidadQQ",
                    render: (val) => formatNumber(val),
                  },
                  {
                    label: "Precio (Lps/QQ)",
                    key: "compraPrecioQQ",
                    render: (val) => formatNumber(val),
                  },
                  {
                    label: "Total (Lps)",
                    key: "totalLps",
                    render: (val) => formatNumber(val),
                  },
                  {
                    label: "Sacos",
                    key: "compraTotalSacos",
                    render: (val) => formatNumber(val),
                  },
                  { label: "Movimiento", key: "compraMovimiento" },
                  { label: "Descripción", key: "compraDescripcion" },
                  {
                    label: "Acciones",
                    key: "acciones",
                    render: (_, record) => {
                      const isVenta = !!record.compradorID;
                      const tipoRuta = isVenta ? "venta" : "compra";
                      const titulo = isVenta ? "venta" : "compra";

                      return (
                        <Dropdown
                          menu={{
                            items: [
                              {
                                key: "exportar",
                                label: (
                                  <Button
                                    type="text"
                                    block
                                    onClick={async () => {
                                      // Mensaje de carga
                                      messageApi.open({
                                        type: "loading",
                                        content: `Generando comprobante de ${titulo}, por favor espere...`,
                                        duration: 0,
                                        key: "generandoComprobante",
                                      });

                                      try {
                                        if (isVenta) {
                                          await exportVentaDirecta({
                                            comprador: {
                                              label:
                                                record.clienteNombreCompleto,
                                            },
                                            productos: [
                                              {
                                                nombre: record.tipoCafeNombre,
                                                cantidad: parseFloat(
                                                  record.compraCantidadQQ
                                                ),
                                                precio: parseFloat(
                                                  record.compraPrecioQQ
                                                ),
                                                total: parseFloat(
                                                  record.totalLps
                                                ),
                                              },
                                            ],
                                            total: parseFloat(record.totalLps),
                                            observaciones:
                                              record.compraDescripcion,
                                            comprobanteID: record.compraId,
                                            fecha: record.compraFecha,
                                          });
                                        } else {
                                          await exportCompraDirecta({
                                            cliente: {
                                              label:
                                                record.clienteNombreCompleto,
                                            },
                                            productos: [
                                              {
                                                nombre: record.tipoCafeNombre,
                                                cantidad: parseFloat(
                                                  record.compraCantidadQQ
                                                ),
                                                precio: parseFloat(
                                                  record.compraPrecioQQ
                                                ),
                                                total: parseFloat(
                                                  record.totalLps
                                                ),
                                              },
                                            ],
                                            total: parseFloat(record.totalLps),
                                            observaciones:
                                              record.compraDescripcion,
                                            comprobanteID: record.compraId,
                                            fecha: record.compraFecha,
                                          });
                                        }

                                        messageApi.destroy(
                                          "generandoComprobante"
                                        );
                                        messageApi.success(
                                          `Comprobante de ${titulo} generado`
                                        );
                                      } catch (err) {
                                        console.error(err);
                                        messageApi.destroy(
                                          "generandoComprobante"
                                        );
                                        messageApi.error(
                                          `Error generando comprobante de ${titulo}`
                                        );
                                      }
                                    }}
                                  >
                                    Exportar PDF
                                  </Button>
                                ),
                              },
                              {
                                key: "editar",
                                label: (
                                  <ProtectedButton
                                    allowedRoles={[
                                      "ADMIN",
                                      "GERENCIA",
                                      "OPERARIOS",
                                    ]}
                                  >
                                    <Popconfirm
                                      title={`¿Seguro que deseas EDITAR esta ${titulo}?`}
                                      onConfirm={() =>
                                        router.push(
                                          `/private/page/transacciones/${tipoRuta}/${record.compraId}`
                                        )
                                      }
                                      okText="Sí"
                                      cancelText="No"
                                    >
                                      <Button type="text" block>
                                        Editar
                                      </Button>
                                    </Popconfirm>
                                  </ProtectedButton>
                                ),
                              },
                              {
                                key: "eliminar",
                                label: (
                                  <ProtectedButton
                                    allowedRoles={["ADMIN", "GERENCIA"]}
                                  >
                                    <Popconfirm
                                      title={`¿Seguro que deseas eliminar esta ${titulo}?`}
                                      onConfirm={() =>
                                        eliminarCompra(record.compraId)
                                      }
                                      okText="Sí"
                                      cancelText="No"
                                    >
                                      <Button type="text" danger block>
                                        Eliminar
                                      </Button>
                                    </Popconfirm>
                                  </ProtectedButton>
                                ),
                              },
                            ],
                          }}
                          trigger={["click"]}
                        >
                          <Button size="small" type="default" block>
                            Acciones
                          </Button>
                        </Dropdown>
                      );
                    },
                  },
                ]}
                rowKey={(item, index) =>
                  `${item.clienteID || item.compradorID}-${
                    item.tipoCafeID ?? index
                  }`
                }
                detailsRowKey={(item) => item.compraId}
              />
            ) : (
              <Table
                columns={columns}
                dataSource={filteredData}
                rowKey={(row) =>
                  `${row.clienteID}-${row.detalles[0]?.compraId}`
                }
                loading={loading}
                bordered
                size="middle"
                scroll={{ x: true }}
                expandable={{
                  expandedRowRender: (record) => (
                    <Table
                      columns={detalleColumns}
                      dataSource={record.detalles}
                      rowKey="compraId"
                      pagination={false}
                      size="small"
                      bordered
                      scroll={{ x: true }}
                    />
                  ),
                }}
              />
            )}
          </Card>
        </div>
      </>
    </ProtectedPage>
  );
}
