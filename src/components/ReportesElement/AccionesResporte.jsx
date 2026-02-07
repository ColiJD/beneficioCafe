"use client";

import { Row, Col, Space, Button, Typography, message } from "antd";
import { ReloadOutlined, FilePdfOutlined } from "@ant-design/icons";
import { useState } from "react";

const { Title, Text } = Typography;

/** ======================
 *  Subcomponentes internos
 *  ====================== */

/** Componente del título */
const HeaderTitle = ({ isDesktop, icon, titulo, subtitulo }) => (
  <Col flex="auto">
    <Title level={isDesktop ? 2 : 3} style={{ margin: 0, color: "#1890ff" }}>
      <Space>
        {icon}
        {titulo}
      </Space>
    </Title>
    {subtitulo && <Text type="secondary">{subtitulo}</Text>}
  </Col>
);

/** Botón de refrescar */
const RefreshButton = ({ isDesktop, loading, onClick }) => (
  <Button
    type="primary"
    size={isDesktop ? "large" : "middle"}
    icon={<ReloadOutlined spin={loading} />}
    onClick={onClick}
    style={{ borderRadius: 6 }}
  >
    {isDesktop ? "Refrescar" : ""}
  </Button>
);

/** Botón de exportar PDF */
const ExportPDFButton = ({ isDesktop, onClick, disableExport, messageApi }) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disableExport) {
      messageApi.warning("No hay datos para exportar.");
      return;
    }

    setLoading(true); // activa el loading
    const key = "generandoPDF";

    messageApi.open({
      key,
      type: "loading",
      content: "Generando reporte...",
      duration: 0,
    });

    try {
      await onClick(); // espera a que se genere el PDF
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
    } finally {
      setLoading(false); // desactiva el loading
    }
  };

  return (
    <Button
      size={isDesktop ? "large" : "middle"}
      icon={<FilePdfOutlined />}
      onClick={handleClick}
      loading={loading}
      style={{ borderRadius: 6 }}
    >
      {isDesktop ? "Exportar PDF" : "PDF"}
    </Button>
  );
};

/** Contenedor de acciones */
const HeaderActions = ({
  isDesktop,
  loading,
  onRefresh,
  onExportPDF,
  disableExport,
  messageApi,
}) => (
  <Col flex="none">
    <Space
      wrap
      size="middle"
      style={{
        width: "100%",
        justifyContent: isDesktop ? "flex-end" : "center",
      }}
    >
      {onRefresh && (
        <RefreshButton
          isDesktop={isDesktop}
          loading={loading}
          onClick={onRefresh}
        />
      )}
      {onExportPDF && (
        <ExportPDFButton
          isDesktop={isDesktop}
          onClick={onExportPDF}
          disableExport={disableExport}
          messageApi={messageApi}
        />
      )}
    </Space>
  </Col>
);

/** ======================
 *  Componente principal
 *  ====================== */
const SectionHeader = ({
  isDesktop = true,
  loading = false,
  icon = null,
  titulo = "Título",
  subtitulo = "",
  onRefresh = null,
  onExportPDF = null,
  disableExport = false,
}) => {
  const [messageApi, contextHolder] = message.useMessage();

  return (
    <>
      {contextHolder}
      <Row align="middle" justify="space-between" gutter={[16, 16]} wrap>
        <HeaderTitle
          isDesktop={isDesktop}
          icon={icon}
          titulo={titulo}
          subtitulo={subtitulo}
        />
        <HeaderActions
          isDesktop={isDesktop}
          loading={loading}
          onRefresh={onRefresh}
          onExportPDF={onExportPDF}
          disableExport={disableExport}
          messageApi={messageApi}
        />
      </Row>
    </>
  );
};

export default SectionHeader;
