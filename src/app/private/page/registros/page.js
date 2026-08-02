"use client";

import { useMemo, useState } from "react";
import {
  AppstoreOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Row,
  Space,
  Tag,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";

import Filtros from "@/components/Filtros";
import ProtectedPage from "@/components/ProtectedPage";
import SectionHeader from "@/components/ReportesElement/AccionesResporte";
import useClientAndDesktop from "@/hook/useClientAndDesktop";
import { registroRoutes } from "@/lib/registroRoutes";

const { Paragraph, Text } = Typography;

export default function RegistrosCentralPage() {
  const router = useRouter();
  const { mounted, isDesktop } = useClientAndDesktop();
  const [busqueda, setBusqueda] = useState("");

  const registrosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return registroRoutes;

    return registroRoutes.filter((item) => {
      const origenes = item.origenes.join(" ").toLowerCase();
      return (
        item.titulo.toLowerCase().includes(termino) ||
        item.descripcion.toLowerCase().includes(termino) ||
        item.grupo.toLowerCase().includes(termino) ||
        item.route.toLowerCase().includes(termino) ||
        origenes.includes(termino)
      );
    });
  }, [busqueda]);

  const grupos = useMemo(() => {
    return registrosFiltrados.reduce((acc, item) => {
      if (!acc[item.grupo]) acc[item.grupo] = [];
      acc[item.grupo].push(item);
      return acc;
    }, {});
  }, [registrosFiltrados]);

  if (!mounted) return null;

  return (
    <ProtectedPage
      allowedRoles={["ADMIN", "GERENCIA", "COLABORADORES", "AUDITORES"]}
    >
      <Card>
        <SectionHeader
          isDesktop={isDesktop}
          icon={<AppstoreOutlined />}
          titulo="Central de Registros"
          subtitulo="Resumen de las rutas que hoy se usan en botones y accesos de registro."
        />

        <Divider />

        <Filtros
          fields={[
            {
              type: "input",
              placeholder: "Buscar por nombre, ruta o archivo origen",
              value: busqueda,
              setter: setBusqueda,
            },
          ]}
        />

        {Object.keys(grupos).length === 0 ? (
          <Empty description="No se encontraron registros para esa busqueda" />
        ) : (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {Object.entries(grupos).map(([grupo, items]) => (
              <div key={grupo}>
                <Space
                  align="center"
                  style={{ marginBottom: 16, flexWrap: "wrap" }}
                >
                  <Tag color={grupo === "Entradas" ? "blue" : "green"}>
                    {grupo}
                  </Tag>
                  <Text type="secondary">
                    {items.length} ruta{items.length === 1 ? "" : "s"}
                  </Text>
                </Space>

                <Row gutter={[16, 16]}>
                  {items.map((item) => (
                    <Col xs={24} md={12} xl={8} key={item.key}>
                      <Card
                        bordered
                        hoverable
                        style={{ height: "100%" }}
                        bodyStyle={{
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <Space direction="vertical" size={6} style={{ width: "100%" }}>
                          <Text strong style={{ fontSize: 16 }}>
                            {item.titulo}
                          </Text>
                          <Tag color={item.grupo === "Entradas" ? "blue" : "green"}>
                            {item.grupo}
                          </Tag>
                        </Space>

                        <Paragraph style={{ minHeight: 66, marginTop: 12 }}>
                          {item.descripcion}
                        </Paragraph>

                        <Text strong>Ruta:</Text>
                        <Text code style={{ whiteSpace: "pre-wrap", marginBottom: 12 }}>
                          {item.route}
                        </Text>
                        <div style={{ flex: 1 }} />

                        <Divider style={{ margin: "16px 0" }} />

                        <Button
                          type="primary"
                          icon={<EyeOutlined />}
                          block
                          onClick={() => router.push(item.route)}
                        >
                          Abrir Registro
                        </Button>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            ))}
          </Space>
        )}
      </Card>
    </ProtectedPage>
  );
}
