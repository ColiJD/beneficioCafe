"use client";

import { useMemo } from "react";
import { Table, Card, Divider, Typography, message } from "antd";
import dayjs from "dayjs";
import { formatNumber } from "@/components/Formulario";
import { FileFilled } from "@ant-design/icons";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import Filtros from "@/components/Filtros";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import { useFetchReport } from "@/hook/useFetchReport";
import { exportPDFGeneralConPrestamos } from "@/Doc/Reportes/General";
import ProtectedPage from "@/components/ProtectedPage";
import { rangoInicial } from "../reporteCliente/page";

const { Title, Text } = Typography;

export default function ResumenMovimientos() {
  const {
    data,
    loading,
    rangoFechas,
    onFechasChange,
    contextHolder,
    messageApi,
    fetchData,
  } = useFetchReport("/api/reportes", rangoInicial);

  const { mounted, isDesktop } = useClientAndDesktop();

  // 🔹 Normalizar y calcular totales
  const datosTabla = useMemo(() => {
    if (!data) return [];

    const filas = [
      {
        key: "entradas",
        tipo: "Entradas",
        compraQQ: Number(data?.compras?.entradas?._sum?.compraCantidadQQ ?? 0),
        compraLps: Number(data?.compras?.entradas?._sum?.compraTotal ?? 0),
        depositoQQ: Number(data?.depositos?.entradas?._sum?.cantidadQQ ?? 0),
        depositoLps: Number(data?.depositos?.entradas?._sum?.totalLps ?? 0),
        depositoPendienteQQ:
          Number(data?.depositos?.totalDepositosQQ ?? 0) -
          Number(data?.depositos?.entradas?._sum?.cantidadQQ ?? 0),
        contratoQQ: Number(data?.contratos?.entradas?.cantidadQQ ?? 0),
        contratoLps: Number(data?.contratos?.entradas?.total ?? 0),
      },
      {
        key: "salidas",
        tipo: "Salidas",
        compraQQ: Number(data?.compras?.salidas?._sum?.compraCantidadQQ ?? 0),
        compraLps: Number(data?.compras?.salidas?._sum?.compraTotal ?? 0),
        depositoQQ: Number(data?.salidas?.cantidadQQ ?? 0),
        depositoLps: Number(data?.salidas?.total ?? 0),
        depositoPendienteQQ: Number(data?.pendiente ?? 0),
        contratoQQ: Number(data?.contratoSalidasTotal?.cantidadQQ ?? 0),
        contratoLps: Number(data?.contratoSalidasTotal?.total ?? 0),
      },
    ];

    const filasConTotales = filas.map((row) => {
      const totalQQ =
        (row.compraQQ || 0) +
        (row.depositoQQ || 0) +
        // Para entradas suma, para salidas resta
        (row.key === "salidas"
          ? -(row.depositoPendienteQQ || 0)
          : row.depositoPendienteQQ || 0) +
        (row.contratoQQ || 0);
      const totalLps = row.compraLps + row.depositoLps + row.contratoLps;
      const promedio =
        totalQQ + row.depositoPendienteQQ > 0
          ? totalLps / (totalQQ + row.depositoPendienteQQ)
          : 0;
      return { ...row, totalQQ, totalLps, promedio };
    });

    // 🔥 NUEVA FILA — SALDO RESTANTE
    const entradas = filasConTotales.find((f) => f.key === "entradas");
    const salidas = filasConTotales.find((f) => f.key === "salidas");

    const saldoQQ = (entradas?.totalQQ ?? 0) - (salidas?.totalQQ ?? 0);
    const saldoLps = (entradas?.totalLps ?? 0) - (salidas?.totalLps ?? 0);
    const saldoProm = saldoQQ > 0 ? saldoLps / saldoQQ : 0;

    // filasConTotales.push({
    //   key: "saldo",
    //   tipo: "Saldo Restante",
    //   compraQQ: null, // 👈 null evita que aparezca en DESGLOSE
    //   compraLps: null,
    //   depositoQQ: null,
    //   depositoLps: null,
    //   contratoQQ: null,
    //   contratoLps: null,
    //   totalQQ: saldoQQ,
    //   totalLps: saldoLps,
    //   promedio: saldoProm,
    //   esSaldo: true, // para aplicar estilo especial
    // });

    return filasConTotales;
  }, [data]);

  // 🔹 Columnas de la tabla
  const columnas = [
    {
      title: "",
      dataIndex: "tipo",
      key: "tipo",
      fixed: "left",
      render: (v) => <span style={{ fontWeight: "bold" }}>{v}</span>, // tipo en negrita
    },
    {
      title: <span style={{ fontWeight: "bold", color: "#fff" }}>Totales</span>,
      children: ["totalQQ", "totalLps", "promedio"].map((key) => ({
        title:
          key === "totalQQ"
            ? "QQ Total"
            : key === "totalLps"
            ? "Total Lps"
            : "Promedio",
        dataIndex: key,
        key,
        align: "left",
        render: (v) => (
          <span style={{ fontWeight: "bold" }}>{formatNumber(v)}</span>
        ),
        onCell: () => ({
          style: { backgroundColor: "#e6f7ff", fontWeight: "bold" }, // celdas azul claro y negrita
        }),
        onHeaderCell: () => ({
          style: {
            backgroundColor: "#1890ff",
            color: "#fff",
            fontWeight: "bold",
            textAlign: "center",
          },
        }),
      })),
      onHeaderCell: () => ({
        style: {
          backgroundColor: "#1890ff",
          color: "#fff",
          fontWeight: "bold",
          textAlign: "center",
        }, // header azul oscuro
      }),
    },
    {
      title: (
        <span style={{ fontWeight: "bold", color: "#fff" }}>Desglose</span>
      ),
      children: [
        {
          title: "Compra / Venta",
          children: ["compraQQ", "compraLps"].map((key) => ({
            title: key === "compraQQ" ? "QQ" : "Lps",
            dataIndex: key,
            key,
            align: "left",
            render: (v) =>
              key.includes("Lps") ? `${formatNumber(v)}` : formatNumber(v),
            onHeaderCell: () => ({
              style: { textAlign: "center" },
            }),
          })),
          onHeaderCell: () => ({
            style: { textAlign: "center" },
          }),
        },
        {
          title: "Depósito Liquidado",
          children: ["depositoQQ", "depositoLps"].map((key) => ({
            title: key === "depositoQQ" ? "QQ" : "Lps",
            dataIndex: key,
            key,
            align: "left",
            render: (v) =>
              key.includes("Lps") ? `${formatNumber(v)}` : formatNumber(v),
            onHeaderCell: () => ({
              style: { textAlign: "center" },
            }),
          })),
          onHeaderCell: () => ({
            style: { textAlign: "center" },
          }),
        },
        {
          title: "Depósito Pendiente",
          children: ["depositoPendienteQQ"].map((key) => ({
            title: "QQ",
            dataIndex: key,
            key,
            align: "left",
            render: (v, record) => {
              // Si es la fila de salidas, mostrar con signo negativo
              const valor = record.key === "salidas" ? -v : v;
              return formatNumber(valor);
            },
            onCell: () => ({
              style: { backgroundColor: "#fff0f6", fontWeight: "bold" }, // color diferente
            }),
            onHeaderCell: () => ({
              style: { textAlign: "center" },
            }),
          })),
          onHeaderCell: () => ({
            style: { textAlign: "center" },
          }),
        },
        {
          title: "Contrato",
          children: ["contratoQQ", "contratoLps"].map((key) => ({
            title: key === "contratoQQ" ? "QQ" : "Lps",
            dataIndex: key,
            key,
            align: "left",
            render: (v) =>
              key.includes("Lps") ? `${formatNumber(v)}` : formatNumber(v),
            onHeaderCell: () => ({
              style: { textAlign: "center" },
            }),
          })),
          onHeaderCell: () => ({
            style: { textAlign: "center" },
          }),
        },
      ],
      onHeaderCell: () => ({
        style: {
          backgroundColor: "#1890ff",
          color: "#fff",
          fontWeight: "bold",
          textAlign: "center",
        },
      }),
    },
  ];

  const hayDatos = datosTabla.some(
    (row) =>
      row.compraQQ > 0 ||
      row.compraLps > 0 ||
      row.contratoQQ > 0 ||
      row.contratoLps > 0 ||
      row.depositoQQ > 0 ||
      row.depositoLps > 0
  );

  // 🔹 Normalizar y calcular totales de préstamos
  // 🔹 Normalizar y calcular totales de préstamos
  const datosPrestamosYAnticipos = useMemo(() => {
    const filas = [];

    // 🔹 Préstamos
    if (data?.prestamos) {
      const movimientos = data.prestamos.movimientos || {};

      const filaPrestamos = {
        key: "prestamos",
        tipo: "Préstamos Activos",
        totalPrestamos: Number(data.prestamos.totalPrestamosActivos ?? 0),
        abono: Number(movimientos.ABONO ?? 0),
        pagoInteres: Number(movimientos.PAGO_INTERES ?? 0),
        intCargo: Number(movimientos["Int-Cargo"] ?? 0),
      };

      const totalCreditos =
        filaPrestamos.totalPrestamos + filaPrestamos.intCargo;
      const totalAbonos = filaPrestamos.abono + filaPrestamos.pagoInteres;
      const saldo = totalCreditos - totalAbonos;

      filas.push({
        ...filaPrestamos,
        totalCreditos,
        totalAbonos,
        saldo,
      });
    }

    // 🔹 Anticipos
    if (data?.anticipos) {
      const movimientos = data.anticipos.movimientos || {};

      const filaAnticipos = {
        key: "anticipos",
        tipo: "Anticipos Activos",
        totalPrestamos: Number(data.anticipos.totalAnticiposActivos ?? 0),
        abono: Number(movimientos.ABONO_ANTICIPO ?? 0), // se mantiene como pagoInteres
        pagoInteres: Number(movimientos.INTERES_ANTICIPO ?? 0),
        intCargo: Number(movimientos.CARGO_ANTICIPO ?? 0), // ahora mapeado igual que intCargo
      };

      const totalCreditos =
        filaAnticipos.totalPrestamos + filaAnticipos.intCargo;
      const totalAbonos = filaAnticipos.abono + filaAnticipos.pagoInteres;
      const saldo = totalCreditos - totalAbonos;

      filas.push({
        ...filaAnticipos,
        totalCreditos,
        totalAbonos,
        saldo,
      });
    }

    return filas;
  }, [data]);

  // 🔹 Columnas de la tabla de préstamos
  const columnasPrestamos = [
    {
      title: "",
      dataIndex: "tipo",
      key: "tipo",
      fixed: "left",
      render: (v) => <span style={{ fontWeight: "bold" }}>{v}</span>, // tipo en negrita
    },
    {
      title: <span style={{ fontWeight: "bold", color: "#fff" }}>Totales</span>,
      children: ["totalCreditos", "totalAbonos", "saldo"].map((key) => ({
        title:
          key === "totalCreditos"
            ? "Total Créditos"
            : key === "totalAbonos"
            ? "Total Abonos"
            : "Saldo",
        dataIndex: key,
        key,
        align: "left",
        render: (v) => `L. ${formatNumber(v)}`,
        onCell: () => ({
          style: { backgroundColor: "#e6f7ff", fontWeight: "bold" }, // celdas azul claro y negrita
        }),
      })),
      onHeaderCell: () => ({
        style: {
          backgroundColor: "#1890ff",
          color: "#fff",
          fontWeight: "bold",
          align: "left",
        }, // header azul oscuro
      }),
    },
    {
      title: (
        <span style={{ fontWeight: "bold", color: "#fff" }}>Desglose</span>
      ),
      children: ["totalPrestamos", "abono", "pagoInteres", "intCargo"].map(
        (key) => ({
          title:
            key === "totalPrestamos"
              ? "Monto Inicial"
              : key === "abono"
              ? "Abono"
              : key === "pagoInteres"
              ? "Pago de interes"
              : "Cargar Interes",
          dataIndex: key,
          key,
          align: "left",
          render: (v) => `L. ${formatNumber(v)}`,
        })
      ),
      onHeaderCell: () => ({
        style: {
          backgroundColor: "#1890ff",
          color: "#fff",
          fontWeight: "bold",
        },
      }),
    },
  ];

  const flattenColumns = (cols, parentTitle = "") => {
    return cols.flatMap((col) => {
      if (col.children) {
        return flattenColumns(
          col.children,
          parentTitle ? `${parentTitle} ${col.title}` : col.title
        );
      }
      return {
        header: parentTitle ? `${parentTitle} ${col.title}` : col.title,
        key: col.dataIndex || col.key,
        format: col.format, // toma directamente el valor definido en la columna
        isCantidad: [
          "compraQQ",
          "depositoQQ",
          "contratoQQ",
          "totalQQ",
        ].includes(col.dataIndex),
        isTotal: [
          "compraLps",
          "depositoLps",
          "contratoLps",
          "totalLps",
          "promedio",
        ].includes(col.dataIndex),
      };
    });
  };

  const datosInventario = useMemo(() => {
    if (!data) return [];

    return [
      {
        key: "inv",
        descripcion: "Inventario Disponible (QQ)",
        cantidad: Number(data?.inventario?.disponibleQQ ?? 0),
      },
    ];
  }, [data]);

  const columnasInventario = [
    {
      title: "Descripción",
      dataIndex: "descripcion",
      key: "descripcion",
      width: 200,
    },
    {
      title: "Cantidad (QQ)",
      dataIndex: "cantidad",
      key: "cantidad",
      align: "right",
      width: 50,
      render: (v, record) => {
        let color = "inherit"; // color por defecto

        if (record.key === "inv") color = "green"; // Inventario en verde
        if (record.key === "pend") color = "red"; // Pendiente en rojo

        return <span style={{ color }}>{formatNumber(v)}</span>;
      },
    },
  ];

  if (!mounted) return <div style={{ padding: 24 }}>Cargando...</div>;

  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS", "AUDITORES"]}
    >
      <div
        style={{
          padding: isDesktop ? 24 : 12,
          background: "#f5f5f5",
          minHeight: "100vh",
        }}
      >
        {contextHolder}

        <Card>
          <SectionHeader
            isDesktop={isDesktop}
            loading={loading}
            icon={<FileFilled />}
            titulo="Totales Generales"
            subtitulo="Totales generales de entradas y salidas"
            onRefresh={() =>
              fetchData(
                rangoFechas?.[0]?.startOf("day").toISOString(),
                rangoFechas?.[1]?.endOf("day").toISOString()
              )
            }
            onExportPDF={() => {
              if (!hayDatos) {
                messageApi.warning(
                  "No hay datos válidos para generar el reporte."
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
                exportPDFGeneralConPrestamos(
                  [
                    ...datosTabla,
                    ...datosPrestamosYAnticipos,
                    ...datosInventario,
                  ],
                  { fechaInicio: rangoFechas?.[0], fechaFin: rangoFechas?.[1] },
                  { title: "Reporte Completo" }
                );
                messageApi.success({
                  content: "Reporte generado correctamente",
                  key,
                  duration: 2,
                });
              } catch (error) {
                messageApi.error({
                  content: "Error al generar el reporte",
                  key,
                  duration: 2,
                });
              }
            }}
            disableExport={!hayDatos}
          />
          <Divider />
          <Filtros
            fields={[
              {
                type: "date",
                value: rangoFechas,
                setter: onFechasChange,
                placeholder: "Rango de fechas",
              },
            ]}
          />
        </Card>

        <Card style={{ borderRadius: 6, marginTop: 16 }}>
          <div style={{ marginBottom: isDesktop ? 16 : 12 }}>
            <Title
              level={4}
              style={{ margin: 0, fontSize: isDesktop ? 16 : 14 }}
            >
              Inventario y Salidas
            </Title>
          </div>

          <Table
            columns={columnasInventario}
            dataSource={datosInventario}
            rowKey="key"
            loading={loading}
            pagination={false}
            bordered
            size="small"
            style={{ tableLayout: "fixed" }}
          />
        </Card>

        <Card style={{ borderRadius: 6, marginTop: 16 }}>
          <div style={{ marginBottom: isDesktop ? 16 : 12 }}>
            <Title
              level={4}
              style={{ margin: 0, fontSize: isDesktop ? 16 : 14 }}
            >
              Resumen General
            </Title>
            <Text type="secondary" style={{ fontSize: isDesktop ? 14 : 12 }}>
              {rangoFechas?.[0] &&
                rangoFechas?.[1] &&
                `Período: ${rangoFechas[0].format(
                  "DD/MM/YYYY"
                )} - ${rangoFechas[1].format("DD/MM/YYYY")}`}
            </Text>
          </div>

          <Table
            columns={columnas}
            dataSource={datosTabla}
            rowKey="key"
            loading={loading}
            pagination={false}
            bordered
            size="small"
            scroll={{ x: "max-content" }}
            onRow={(record) => ({
              style: { backgroundColor: "#fffbe6" },
            })}
          />
        </Card>

        <Card style={{ borderRadius: 6, marginTop: 16 }}>
          <div style={{ marginBottom: isDesktop ? 16 : 12 }}>
            <Title
              level={4}
              style={{ margin: 0, fontSize: isDesktop ? 16 : 14 }}
            >
              Resumen de Préstamos y Anticipos
            </Title>
          </div>

          <Table
            columns={columnasPrestamos}
            dataSource={datosPrestamosYAnticipos}
            rowKey="key"
            loading={loading}
            pagination={false}
            bordered
            size="small"
            scroll={{ x: "max-content" }}
            onRow={(record) => ({
              style: { backgroundColor: "#fffbe6" },
            })}
          />
        </Card>
      </div>
    </ProtectedPage>
  );
}
