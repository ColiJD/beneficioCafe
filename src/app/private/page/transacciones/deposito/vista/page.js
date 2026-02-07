"use client";
import { useEffect, useState } from "react";
import { Table, Row, Col, message, Button, Grid } from "antd";

import TarjetasDeTotales from "@/components/DetallesCard";
import Filtros from "@/components/Filtros";
import { FiltrosTarjetas } from "@/lib/FiltrosTarjetas";
import TarjetaMobile from "@/components/TarjetaMobile";
import dayjs from "dayjs";
import ProtectedPage from "@/components/ProtectedPage";
import { formatNumber } from "@/components/Formulario";

// Plugins para filtros de fechas
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const { useBreakpoint } = Grid;

export default function TablaSaldoDepositos() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [nombreFiltro, setNombreFiltro] = useState("");
  const [tipoCafeFiltro, setTipoCafeFiltro] = useState("");
  const [rangoFecha, setRangoFecha] = useState([
    dayjs().subtract(1, "year").startOf("year"),
    dayjs().endOf("year"),
  ]);

  const [estadoFiltro, setEstadoFiltro] = useState("Pendiente");

  // Cargar datos desde API
  const cargarDatos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deposito");
      if (!res.ok) throw new Error("Error al cargar los datos");
      const data = await res.json();

      // Filtrar según estado
      const dataFiltrada = data.filter((item) => {
        if (estadoFiltro === "Liquidado") {
          return parseFloat(item.cantidadLiquidada || 0) > 0;
        } else if (estadoFiltro === "Pendiente") {
          return (
            parseFloat(item.cantidadTotal || 0) -
              parseFloat(item.cantidadLiquidada || 0) >
            0
          );
        }
        return true;
      });

      // Agrupar datos por cliente y tipo de café
      const mapa = {};
      dataFiltrada.forEach((item) => {
        const key = `${item.clienteID}-${item.tipoCafeNombre}`;

        const cantidadTotal = parseFloat(item.cantidadTotal || 0);
        const cantidadLiquidada = parseFloat(item.cantidadLiquidada || 0);
        const saldoPendienteQQ = cantidadTotal - cantidadLiquidada;
        const precioPromedio = parseFloat(item.precioPromedio || 0);

        const liquidadoValor = cantidadLiquidada * precioPromedio;
        const saldoPendienteValor = saldoPendienteQQ * precioPromedio;

        if (!mapa[key]) {
          mapa[key] = {
            clienteID: item.clienteID,
            clienteNombre: item.clienteNombre,
            tipoCafeNombre: item.tipoCafeNombre,
            cantidadTotal: 0,
            cantidadLiquidada: 0,
            saldoPendienteQQ: 0,
            liquidadoValor: 0,
            saldoPendienteValor: 0,
            precioPromedio: 0,
            detalles: [],
          };
        }

        // Acumular totales
        mapa[key].cantidadTotal += cantidadTotal;
        mapa[key].cantidadLiquidada += cantidadLiquidada;
        mapa[key].saldoPendienteQQ += saldoPendienteQQ;
        mapa[key].liquidadoValor += liquidadoValor;
        mapa[key].saldoPendienteValor += saldoPendienteValor;

        // Guardar detalles con todos los valores calculados
        mapa[key].detalles.push({
          depositoID: item.depositoID,
          depositoFecha: item.depositoFecha,
          cantidadTotal,
          cantidadLiquidada,
          saldoPendienteQQ,
          precioPromedio,
          liquidadoValor,
          saldoPendienteValor,
        });

        // Precio promedio ponderado
        mapa[key].precioPromedio =
          mapa[key].cantidadLiquidada > 0
            ? mapa[key].liquidadoValor / mapa[key].cantidadLiquidada
            : 0;
      });

      const groupedData = Object.values(mapa);
      setData(groupedData);
      setFilteredData(groupedData);
    } catch (error) {
      console.error(error);
      message.error("No se pudieron cargar los saldos de depósitos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [estadoFiltro]);

  // Aplicar filtros
  const aplicarFiltros = () => {
    const filtros = {
      clienteNombre: nombreFiltro,
      tipoCafeNombre: tipoCafeFiltro,
    };
    const filtrados = FiltrosTarjetas(
      data,
      filtros,
      rangoFecha,
      "depositoFecha"
    );
    setFilteredData(filtrados);
  };

  useEffect(() => {
    aplicarFiltros();
  }, [nombreFiltro, tipoCafeFiltro, rangoFecha, data]);

  // Totales
  const totalQQ =
    estadoFiltro === "Pendiente"
      ? filteredData.reduce((acc, item) => acc + (item.cantidadTotal || 0), 0)
      : filteredData.reduce(
          (acc, item) => acc + (item.cantidadLiquidada || 0),
          0
        );

  const totalSaldo =
    estadoFiltro === "Pendiente"
      ? filteredData.reduce(
          (acc, item) => acc + (item.saldoPendienteQQ || 0),
          0
        )
      : filteredData.reduce((acc, item) => acc + (item.liquidadoValor || 0), 0);

  // Columnas tabla principal
  const columns = [
    { title: "ID Cliente", dataIndex: "clienteID", key: "clienteID" },
    { title: "Cliente", dataIndex: "clienteNombre", key: "clienteNombre" },
    { title: "Tipo Café", dataIndex: "tipoCafeNombre", key: "tipoCafeNombre" },
    ...(estadoFiltro === "Pendiente"
      ? [
          {
            title: "Total (QQ)",
            dataIndex: "cantidadTotal",
            key: "cantidadTotal",
            render: formatNumber,
          },
          {
            title: "Saldo (QQ)",
            dataIndex: "saldoPendienteQQ",
            key: "saldoPendienteQQ",
            render: formatNumber,
          },
        ]
      : [
          {
            title: "Liquidado (QQ)",
            dataIndex: "cantidadLiquidada",
            key: "cantidadLiquidada",
            render: formatNumber,
          },

          {
            title: "Total (Lps)",
            dataIndex: "liquidadoValor",
            key: "liquidadoValor",
            render: formatNumber,
          },
        ]),
  ];

  // Columnas detalles expandido
  const detalleColumns = [
    { title: "Depósito ID", dataIndex: "depositoID", key: "depositoID" },
    {
      title: "Fecha",
      dataIndex: "depositoFecha",
      key: "depositoFecha",
      render: (d) => new Date(d).toLocaleDateString("es-HN"),
    },
    ...(estadoFiltro === "Pendiente"
      ? [
          {
            title: "Total (QQ)",
            dataIndex: "cantidadTotal",
            key: "cantidadTotal",
            render: formatNumber,
          },
          {
            title: "Saldo (QQ)",
            dataIndex: "saldoPendienteQQ",
            key: "saldoPendienteQQ",
            render: (v) => (
              <span style={{ color: v > 0 ? "red" : "green" }}>
                {formatNumber(v)}
              </span>
            ),
          },
        ]
      : [
          {
            title: "Liquidado (QQ)",
            dataIndex: "cantidadLiquidada",
            key: "cantidadLiquidada",
            render: formatNumber,
          },
          {
            title: "Precio (Lps/QQ)",
            dataIndex: "precioPromedio",
            key: "precioPromedio",
            render: formatNumber,
          },
          {
            title: "Total (Lps)",
            dataIndex: "liquidadoValor",
            key: "liquidadoValor",
            render: formatNumber,
          },
        ]),
  ];

  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS", "AUDITORES"]}
    >
      <div>
        {/* Tarjetas */}
        <TarjetasDeTotales
          title="Registro de Depósitos"
          cards={[
            {
              title:
                estadoFiltro === "Pendiente" ? "Total (QQ)" : "Liquidado (QQ)",
              value: formatNumber(totalQQ),
            },
            {
              title:
                estadoFiltro === "Pendiente"
                  ? "Saldo Pendiente (QQ)"
                  : "Total (Lps)",
              value: formatNumber(totalSaldo),
            },
          ]}
        />

        {/* Filtros */}
        <Filtros
          fields={[
            {
              type: "input",
              placeholder: "Buscar por nombre",
              value: nombreFiltro,
              setter: setNombreFiltro,
            },
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
              value: estadoFiltro,
              setter: setEstadoFiltro,
              options: [
                { value: "Pendiente", label: "Pendiente" },
                { value: "Liquidado", label: "Liquidado" },
              ],
            },
            { type: "date", value: rangoFecha, setter: setRangoFecha },
          ]}
        />

        <Row style={{ marginBottom: 16 }}>
          <Col xs={24} sm={6} md={4}>
            <Button onClick={cargarDatos} block>
              Refrescar
            </Button>
          </Col>
        </Row>

        {/* Tabla responsive */}
        {isMobile ? (
          <TarjetaMobile
            data={filteredData}
            loading={loading}
            columns={[
              { label: "Cliente", key: "clienteNombre" },
              { label: "Tipo Café", key: "tipoCafeNombre" },
              {
                label: "Total (QQ)",
                key: "cantidadTotal",
                render: formatNumber,
                visible: estadoFiltro === "Pendiente",
              },
              {
                label: "Saldo Pendiente (QQ)",
                key: "saldoPendienteQQ",
                render: formatNumber,
                visible: estadoFiltro === "Pendiente",
                color: (v) => (v > 0 ? "red" : "green"),
              },
              {
                label: "Liquidado (QQ)",
                key: "cantidadLiquidada",
                render: formatNumber,
                visible: estadoFiltro !== "Pendiente",
              },
              {
                label: "Precio (Lps/QQ)",
                key: "precioPromedio",
                render: formatNumber,
                visible: estadoFiltro !== "Pendiente",
              },
              {
                label: "Total (Lps)",
                key: "liquidadoValor",
                render: formatNumber,
                visible: estadoFiltro !== "Pendiente",
              },
              { label: "Estado", key: () => estadoFiltro },
            ]}
            detailsKey="detalles"
            detailsColumns={[
              { label: "Depósito ID", key: "depositoID" },
              {
                label: "Fecha",
                key: "depositoFecha",
                render: (v) => new Date(v).toLocaleDateString("es-HN"),
              },
              {
                label: "Total (QQ)",
                key: "cantidadTotal",
                render: formatNumber,
                visible: estadoFiltro === "Pendiente",
              },
              {
                label: "Saldo (QQ)",
                key: "saldoPendienteQQ",
                render: formatNumber,
                visible: estadoFiltro === "Pendiente",
              },
              {
                label: "Liquidado (QQ)",
                key: "cantidadLiquidada",
                render: formatNumber,
                visible: estadoFiltro !== "Pendiente",
              },
              {
                label: "Precio (Lps/QQ)",
                key: "precioPromedio",
                render: formatNumber,
                visible: estadoFiltro !== "Pendiente",
              },
              {
                label: "Total (Lps)",
                key: "liquidadoValor",
                render: formatNumber,
                visible: estadoFiltro !== "Pendiente",
              },
            ]}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey={(row) => `${row.clienteID}-${row.tipoCafeNombre}`}
            loading={loading}
            bordered
            size="middle"
            pagination={{ pageSize: 6 }}
            scroll={{ x: "max-content" }}
            expandable={{
              expandedRowRender: (record) => (
                <Table
                  columns={detalleColumns}
                  dataSource={record.detalles}
                  rowKey="depositoID"
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
