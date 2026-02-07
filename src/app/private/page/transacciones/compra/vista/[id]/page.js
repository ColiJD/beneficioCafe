"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Table, Row, Col, message, Button } from "antd";
import dynamic from "next/dynamic";
import TarjetasDeTotales from "@/components/DetallesCard";
import Filtros from "@/components/Filtros";
import { FiltrosTarjetas } from "@/lib/FiltrosTarjetas";
import { truncarDosDecimalesSinRedondear } from "@/lib/calculoCafe";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import ProtectedPage from "@/components/ProtectedPage";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

// Lazy load para mobile
const TarjetaMobile = dynamic(() => import("@/components/TarjetaMobile"), {
  ssr: false,
});

export default function ClienteDetalle() {
  const { id } = useParams();
  const { mounted, isDesktop } = useClientAndDesktop();
  const isMobile = mounted && !isDesktop;

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clienteNombreCompleto, setClienteNombreCompleto] = useState("");

  const [tipoCafeFiltro, setTipoCafeFiltro] = useState("");
  const [rangoFecha, setRangoFecha] = useState([
    dayjs().startOf("year"),
    dayjs(),
  ]);
  const [movimientoFiltro, setMovimientoFiltro] = useState("Entrada");

  // Cargar compras del cliente
  const cargarDatos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/compras?clienteID=${id}`);
      if (!res.ok) throw new Error("Error al cargar los datos");
      const compras = await res.json();

      if (compras.length > 0) {
        setClienteNombreCompleto(compras[0].clienteNombreCompleto);
      }

      // Filtrar por movimiento
      const dataFiltrada = compras.filter(
        (item) => item.compraMovimiento === movimientoFiltro
      );

      // Agrupar por tipo de café
      const mapa = {};
      dataFiltrada.forEach((item, index) => {
        const key = item.tipoCafeID ?? index;

        // Convertir a número los decimales
        const cantidad = Number(item.compraCantidadQQ || 0);
        const precio = Number(item.compraPrecioQQ || 0);
        const totalLps = cantidad * precio;

        if (!mapa[key]) {
          mapa[key] = {
            clienteID: item.clienteID,
            clienteNombreCompleto: item.clienteNombreCompleto,
            tipoCafeNombre: item.tipoCafeNombre,
            cantidadTotal: 0,
            totalLps: 0,
            detalles: [],
          };
        }

        mapa[key].cantidadTotal += cantidad;
        mapa[key].totalLps += totalLps;

        mapa[key].detalles.push({
          ...item,
          compraCantidadQQ: cantidad,
          compraPrecioQQ: precio,
          totalLps,
        });
      });

      const groupedData = Object.values(mapa);
      setData(groupedData);
      setFilteredData(groupedData);
    } catch (error) {
      console.error(error);
      message.error("No se pudieron cargar las compras del cliente");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [movimientoFiltro]);

  // Aplicar filtros
  const aplicarFiltros = () => {
    const filtros = { tipoCafeNombre: tipoCafeFiltro };
    const filtrados = FiltrosTarjetas(data, filtros, rangoFecha, "compraFecha");
    setFilteredData(filtrados);
  };

  useEffect(() => {
    aplicarFiltros();
  }, [tipoCafeFiltro, rangoFecha, data]);

  // Totales
  const totalQQ = filteredData.reduce(
    (acc, item) => acc + (item.cantidadTotal || 0),
    0
  );
  const totalLps = filteredData.reduce(
    (acc, item) => acc + (item.totalLps || 0),
    0
  );

  // Exportar PDF
  const exportarPDF = async () => {
    if (filteredData.length === 0) return;
    const { default: jsPDF } = await import("jspdf");

    const doc = new jsPDF();
    const margin = 14;
    const lineHeight = 6;
    const pageHeight = 280;
    let y = 20;

    doc.setFontSize(14);
    doc.text(`Reporte de compras - ${clienteNombreCompleto}`, margin, y);
    y += 10;

    const headers = [
      "Compra ID",
      "Fecha",
      "Tipo Café",
      "Cantidad (QQ)",
      "Precio (Lps/QQ)",
      "Total (Lps)",
      "Movimiento",
      "Descripción",
    ];
    const colWidth = [20, 25, 25, 20, 25, 25, 20, 40];

    doc.setFontSize(9);
    let x = margin;
    headers.forEach((h, i) => {
      doc.text(h, x, y);
      x += colWidth[i];
    });
    y += 2;
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + colWidth.reduce((a, b) => a + b, 0), y);
    y += 4;

    let totalQQPDF = 0;
    let totalLpsPDF = 0;

    filteredData.forEach((item) => {
      item.detalles.forEach((d) => {
        x = margin;
        const row = [
          d.compraId,
          new Date(d.compraFecha).toLocaleDateString("es-HN"),
          item.tipoCafeNombre,
          truncarDosDecimalesSinRedondear(d.compraCantidadQQ),
          truncarDosDecimalesSinRedondear(d.compraPrecioQQ),
          truncarDosDecimalesSinRedondear(d.totalLps),
          d.compraMovimiento,
          d.compraDescripcion,
        ];
        row.forEach((val, i) => {
          doc.text(String(val), x, y);
          x += colWidth[i];
        });
        y += lineHeight;
        totalQQPDF += Number(d.compraCantidadQQ || 0);
        totalLpsPDF += Number(d.totalLps || 0);

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
    });

    y += 2;
    doc.line(margin, y, margin + colWidth.reduce((a, b) => a + b, 0), y);
    y += lineHeight;
    x = margin;
    doc.setFontSize(10);
    doc.text("TOTALES:", x, y);
    x += colWidth[0] + colWidth[1] + colWidth[2];
    doc.text(truncarDosDecimalesSinRedondear(totalQQPDF).toString(), x, y);
    x += colWidth[3] + colWidth[4];
    doc.text(truncarDosDecimalesSinRedondear(totalLpsPDF).toString(), x, y);
    y += 2;
    doc.line(margin, y, margin + colWidth.reduce((a, b) => a + b, 0), y);
    doc.save(`Reporte_Compras_${clienteNombreCompleto}.pdf`);
  };

  // Columnas tabla principal
  const columns = [
    { title: "Tipo Café", dataIndex: "tipoCafeNombre", key: "tipoCafeNombre" },
    {
      title: "Total (QQ)",
      dataIndex: "cantidadTotal",
      key: "cantidadTotal",
      render: truncarDosDecimalesSinRedondear,
    },
    {
      title: "Total (Lps)",
      dataIndex: "totalLps",
      key: "totalLps",
      render: truncarDosDecimalesSinRedondear,
    },
  ];

  const detalleColumns = [
    { title: "Compra ID", dataIndex: "compraId", key: "compraId" },
    {
      title: "Fecha",
      dataIndex: "compraFecha",
      key: "compraFecha",
      render: (val) => dayjs(val, "YYYY-MM-DD").format("DD/MM/YYYY"),
    },
    {
      title: "Cantidad (QQ)",
      dataIndex: "compraCantidadQQ",
      key: "compraCantidadQQ",
      render: truncarDosDecimalesSinRedondear,
    },
    {
      title: "Precio (Lps/QQ)",
      dataIndex: "compraPrecioQQ",
      key: "compraPrecioQQ",
      render: truncarDosDecimalesSinRedondear,
    },
    {
      title: "Total (Lps)",
      dataIndex: "totalLps",
      key: "totalLps",
      render: truncarDosDecimalesSinRedondear,
    },
    {
      title: "Movimiento",
      dataIndex: "compraMovimiento",
      key: "compraMovimiento",
    },
    {
      title: "Descripción",
      dataIndex: "compraDescripcion",
      key: "compraDescripcion",
    },
  ];

  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS", "AUDITORES"]}
    >
      <div>
        <TarjetasDeTotales
          title={`Resumen de compras del cliente: ${
            clienteNombreCompleto || "Cargando..."
          }`}
          cards={[
            {
              title: "Total (QQ)",
              value: truncarDosDecimalesSinRedondear(totalQQ),
            },
            {
              title: "Total (Lps)",
              value: truncarDosDecimalesSinRedondear(totalLps),
            },
          ]}
        />

        <Filtros
          fields={[
            {
              type: "select",
              placeholder: "Tipo de café",
              value: tipoCafeFiltro || undefined,
              setter: setTipoCafeFiltro,
              allowClear: true,
              options: [...new Set(data.map((d) => d.tipoCafeNombre))],
            },
            {
              type: "select",
              value: movimientoFiltro,
              setter: setMovimientoFiltro,
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
            <Button onClick={cargarDatos} block>
              Refrescar
            </Button>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Button onClick={exportarPDF} block type="default">
              Exportar PDF
            </Button>
          </Col>
        </Row>

        {isMobile ? (
          <TarjetaMobile
            loading={loading}
            data={filteredData}
            columns={[
              { label: "Tipo Café", key: "tipoCafeNombre" },
              {
                label: "Total (QQ)",
                key: "cantidadTotal",
                render: truncarDosDecimalesSinRedondear,
              },
              {
                label: "Total (Lps)",
                key: "totalLps",
                render: truncarDosDecimalesSinRedondear,
              },
            ]}
            detailsKey="detalles"
            detailsColumns={[
              { label: "Compra ID", key: "compraId" },
              {
                label: "Fecha",
                key: "compraFecha",
                render: (val) => dayjs(val, "YYYY-MM-DD").format("DD/MM/YYYY"),
              },
              {
                label: "Cantidad (QQ)",
                key: "compraCantidadQQ",
                render: truncarDosDecimalesSinRedondear,
              },
              {
                label: "Precio (Lps/QQ)",
                key: "compraPrecioQQ",
                render: truncarDosDecimalesSinRedondear,
              },
              {
                label: "Total (Lps)",
                key: "totalLps",
                render: truncarDosDecimalesSinRedondear,
              },
              { label: "Movimiento", key: "compraMovimiento" },
              { label: "Descripción", key: "compraDescripcion" },
            ]}
            rowKey={(item, index) => `${item.tipoCafeID ?? index}`}
            detailsRowKey={(item) =>
              item.compraId ?? `detalle-${Math.random()}`
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey={(row) =>
              `${row.tipoCafeID}-${row.detalles[0]?.compraId ?? Math.random()}`
            }
            loading={loading}
            bordered
            size="middle"
            scroll={{ x: "max-content" }}
            expandable={{
              expandedRowRender: (record) => (
                <Table
                  columns={detalleColumns}
                  dataSource={record.detalles}
                  rowKey={(item) => item.compraId ?? `detalle-${Math.random()}`}
                  pagination={false}
                  size="small"
                  bordered
                  scroll={{ x: "max-content" }}
                />
              ),
            }}
          />
        )}
      </div>
    </ProtectedPage>
  );
}
