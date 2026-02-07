"use client";
import { useEffect, useState, useMemo } from "react";
import { Table, Row, Col, message, Button, Divider, Card } from "antd";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import EstadisticasCards from "@/components/ReportesElement/DatosEstadisticos";
import { CalendarOutlined } from "@ant-design/icons";
import { FloatingButton } from "@/components/Button";
import { PlusOutlined } from "@ant-design/icons";
import Filtros from "@/components/Filtros";
import { useRouter } from "next/navigation";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import ProtectedPage from "@/components/ProtectedPage";
import { formatNumber } from "@/components/Formulario";
import TarjetaMobile from "@/components/TarjetaMobile";

export default function InventarioActualPage() {
  const { mounted, isDesktop } = useClientAndDesktop();
  const [messageApi, contextHolder] = message.useMessage();
  const router = useRouter();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroProducto, setFiltroProducto] = useState("");

  // 🔹 Cargar inventario actual (productoID, productName, cantidadQQ)
  const cargarDatos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventario/Actual");
      if (!res.ok) throw new Error("Error al cargar inventario");
      const data = await res.json();
      setData(data);
    } catch (error) {
      console.error(error);
      messageApi.error("No se pudo cargar el inventario actual");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // 🔹 Columnas de la tabla
  const columns = [
    {
      title: "ID Producto",
      dataIndex: "productoID",
      key: "productoID",
      width: 120,
    },
    {
      title: "Producto",
      dataIndex: "productName",
      key: "productName",
      render: (text, record) => (
        <a
          onClick={() =>
            router.push(`/private/page/inventario/${record.productoID}`)
          }
        >
          {text}
        </a>
      ),
    },
    {
      title: "Cantidad (QQ)",
      dataIndex: "cantidadQQ",
      key: "cantidadQQ",
      render: formatNumber,
    },
  ];

  const columnsMobile = [
    {
      label: "ID Producto",
      key: "productoID",
      render: (text, record) => <b>{text}</b>,
    },
    {
      label: "Producto",
      key: "productName",
      render: (text, record) => (
        <a
          onClick={() =>
            router.push(`/private/page/inventario/${record.productoID}`)
          }
        >
          {text}
        </a>
      ),
    },
    { label: "Cantidad (QQ)", key: "cantidadQQ", render: formatNumber },
  ];

  // 🔹 Aplicar filtro
  const datosFiltrados = useMemo(() => {
    if (!filtroProducto) return data;
    return data.filter((d) => d.productName === filtroProducto);
  }, [data, filtroProducto]);

  // 🔹 Estadísticas básicas
  const estadisticas = useMemo(() => {
    if (!datosFiltrados.length) return null;
    const cantidades = datosFiltrados.map((d) => d.cantidadQQ);
    const total = cantidades.reduce((acc, val) => acc + val, 0);
    const numeroRegistro = cantidades.length;

    return { numeroRegistro, total };
  }, [datosFiltrados]);
  if (!mounted) return null;
  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS", "AUDITORES"]}
    >
      <FloatingButton
        title="Transferir Inventario"
        icon={<PlusOutlined />}
        top={20}
        right={50}
        route="/private/page/inventario/transferir"
      />
      {contextHolder}
      <div>
        <Card>
          <SectionHeader
            isDesktop={isDesktop}
            loading={loading}
            icon={<CalendarOutlined />}
            titulo="Inventario Actual"
            subtitulo="Resumen de existencias por producto"
            onRefresh={cargarDatos}
          />

          <Divider />

          {estadisticas && (
            <EstadisticasCards
              isDesktop={isDesktop}
              data={[
                {
                  titulo: "Número de Productos",
                  valor: estadisticas.numeroRegistro,
                  color: "#096dd9",
                },
                {
                  titulo: "Cantidad Total (QQ)",
                  valor: formatNumber(estadisticas.total),
                  color: "#3f8600",
                },
              ]}
            />
          )}
          <Divider />

          {/* 🔹 Filtros */}
          <Filtros
            fields={[
              {
                type: "select",
                placeholder: "Filtrar por producto",
                value: filtroProducto || undefined,
                setter: setFiltroProducto,
                allowClear: true,
                options: [...new Set(data.map((d) => d.productName))],
              },
            ]}
          />
          <Divider />

          {isDesktop ? (
            <Table
              columns={columns}
              dataSource={datosFiltrados}
              rowKey="productoID"
              loading={loading}
              bordered
              size="middle"
            />
          ) : (
            <TarjetaMobile
              data={datosFiltrados}
              columns={columnsMobile}
              loading={loading}
              rowKey="productoID"
            />
          )}
        </Card>
      </div>
    </ProtectedPage>
  );
}
