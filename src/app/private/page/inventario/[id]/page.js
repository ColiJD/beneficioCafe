"use client";

import { useEffect, useState } from "react";
import { Table, Button, Row, Col, message, Grid } from "antd";
import { useParams, useRouter } from "next/navigation";
import { truncarDosDecimalesSinRedondear } from "@/lib/calculoCafe";
import Filtros from "@/components/Filtros";
import { FiltrosTarjetas } from "@/lib/FiltrosTarjetas";
import TarjetaMobile from "@/components/TarjetaMobile";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import ProtectedPage from "@/components/ProtectedPage";
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

const { useBreakpoint } = Grid;

export default function DetalleCafePage() {
  const { id } = useParams(); // productoID
  const router = useRouter();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [rangoFecha, setRangoFecha] = useState([
    dayjs().startOf("year"),
    dayjs(),
  ]);
  const [movimientoFiltro, setMovimientoFiltro] = useState(""); // Entrada / Salida / Todos

  // 🔹 Cargar movimientos del café
  const cargarMovimientos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventario/movimientos/${id}`);
      if (!res.ok) throw new Error("No se pudieron cargar los movimientos");
      const json = await res.json();
      setData(json);
      setFilteredData(json);
    } catch (error) {
      console.error(error);
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const [nombreCafe, setNombreCafe] = useState("");

  useEffect(() => {
    if (data.length > 0) {
      // Tomamos el tipo de café del primer registro
      setNombreCafe(data[0].tipoCafe);
    }
  }, [data]);

  useEffect(() => {
    cargarMovimientos();
  }, [id]);

  // 🔹 Aplicar filtros
  const aplicarFiltros = () => {
    const filtros = { tipoMovimiento: movimientoFiltro };
    const filtrados = FiltrosTarjetas(data, filtros, rangoFecha, "fecha");
    setFilteredData(filtrados);
  };

  useEffect(() => {
    aplicarFiltros();
  }, [movimientoFiltro, rangoFecha, data]);

  // 🔹 Exportar PDF
  const exportarPDF = async () => {
    if (filteredData.length === 0) return;

    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const margin = 14;
    const lineHeight = 6;
    const pageHeight = 280;
    let y = 20;

    doc.setFontSize(14);
    doc.text(`Reporte de movimientos - Café #${nombreCafe}`, margin, y);
    y += 10;

    const headers = [
      "Fecha",
      "Movimiento",
      "Cantidad (QQ)",
      "Cliente",
      "Referencia",
    ];
    const colWidth = [25, 30, 30, 50, 40];

    doc.setFontSize(9);
    let x = margin;
    headers.forEach((h, i) => {
      doc.text(h, x, y);
      x += colWidth[i];
    });

    y += 2;
    doc.line(margin, y, margin + colWidth.reduce((a, b) => a + b, 0), y);
    y += 4;

    let totalQQ = 0;

    filteredData.forEach((item) => {
      x = margin;
      const row = [
        new Date(item.fecha).toLocaleDateString("es-HN"),
        item.tipoMovimiento,
        truncarDosDecimalesSinRedondear(item.cantidadQQ),
        `${item.clienteNombre} ${item.clienteApellido}`,
        item.referenciaTipo,
      ];

      row.forEach((val, i) => {
        doc.text(String(val ?? ""), x, y);
        x += colWidth[i];
      });

      totalQQ +=
        item.tipoMovimiento === "Entrada"
          ? parseFloat(item.cantidadQQ || 0)
          : -parseFloat(item.cantidadQQ || 0);

      y += lineHeight;

      if (y > pageHeight) {
        doc.addPage();
        y = 20;
        x = margin;
        headers.forEach((h, i) => {
          doc.text(h, x, y);
          x += colWidth[i];
        });
        y += 6;
      }
    });

    y += 2;
    doc.line(margin, y, margin + colWidth.reduce((a, b) => a + b, 0), y);
    y += lineHeight;
    doc.setFontSize(10);
    doc.text(
      `TOTAL QQ: ${truncarDosDecimalesSinRedondear(totalQQ)}`,
      margin,
      y
    );

    doc.save(`Movimientos_Cafe_${nombreCafe}.pdf`);
  };

  // 🔹 Columnas para tabla de escritorio
  const columns = [
    {
      title: "Fecha",
      dataIndex: "fecha",
      key: "fecha",
      render: (val) => new Date(val).toLocaleDateString(),
    },
    {
      title: "Tipo Movimiento",
      dataIndex: "tipoMovimiento",
      key: "tipoMovimiento",
    },
    {
      title: "Cantidad (QQ)",
      dataIndex: "cantidadQQ",
      key: "cantidadQQ",
      render: truncarDosDecimalesSinRedondear,
    },
    {
      title: "Cliente",
      dataIndex: "clienteNombre",
      key: "clienteNombre",
      render: (_, record) =>
        `${record.clienteNombre} ${record.clienteApellido}`,
    },
    { title: "Referencia", dataIndex: "referenciaTipo", key: "referenciaTipo" },
  ];

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS"]}>
      <div>
        <h2>{`Detalles de: ${nombreCafe || "Cargando..."}`}</h2>

        {/* Filtros */}
        <Filtros
          fields={[
            {
              type: "select",
              value: movimientoFiltro || undefined,
              setter: setMovimientoFiltro,
              allowClear: true,
              placeholder: "Movimiento",
              options: [
                { value: "Entrada", label: "Entrada" },
                { value: "Salida", label: "Salida" },
              ],
            },
            { type: "date", value: rangoFecha, setter: setRangoFecha },
          ]}
        />

        <Row style={{ marginBottom: 16 }} gutter={16}>
          <Col xs={12} sm={6} md={4}>
            <Button onClick={cargarMovimientos} block>
              Refrescar
            </Button>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Button onClick={exportarPDF} block type="default">
              Exportar PDF
            </Button>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Button
              onClick={() => router.push("/page/inventario")}
              block
              danger
            >
              Volver al Inventario
            </Button>
          </Col>
        </Row>

        {/* Tabla o Tarjetas mobile */}
        {isMobile ? (
          <TarjetaMobile
            data={filteredData}
            loading={loading}
            columns={[
              {
                label: "Fecha",
                key: "fecha",
                render: (val) => new Date(val).toLocaleDateString(),
              },
              { label: "Movimiento", key: "tipoMovimiento" },
              {
                label: "Cantidad (QQ)",
                key: "cantidadQQ",
                render: truncarDosDecimalesSinRedondear,
              },
              {
                label: "Cliente",
                key: (_, rec) => `${rec.clienteNombre} ${rec.clienteApellido}`,
              },
              { label: "Referencia", key: "referenciaTipo" },
            ]}
            detailsKey="detalles"
            detailsColumns={[]} // no hay sub-detalles por movimiento
          />
        ) : (
          <Table
            dataSource={filteredData}
            columns={columns}
            rowKey="movimientoID"
            loading={loading}
            bordered
          />
        )}
      </div>
    </ProtectedPage>
  );
}
