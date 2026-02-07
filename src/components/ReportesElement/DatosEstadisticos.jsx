"use client";

import { Row, Col, Card, Statistic, Typography } from "antd";

const { Text } = Typography;

const EstadisticasCards = ({ data, isDesktop = true }) => {
  return (
    <Row gutter={[16, 16]}>
      {data.map((item, idx) => (
        <Col key={idx} xl={6} lg={8} md={12} sm={12}>
          <Card size="small" style={{ textAlign: "center", borderRadius: 6 }}>
            <Statistic
              title={
                <Text strong style={{ fontSize: isDesktop ? 14 : 12 }}>
                  {item.titulo}
                </Text>
              }
              value={item.valor}
              prefix={item.icon || item.prefix}
              precision={2}
              valueStyle={{
                color: item.color,
                fontSize: isDesktop ? 24 : 16,
              }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default EstadisticasCards;
