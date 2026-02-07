import { Row, Col, Card, Statistic } from "antd";

export default function TarjetasDeTotales({ title, cards }) {
  return (
    <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
      {title && (
        <Col span={24}>
          <h3 style={{ marginBottom: 6, fontWeight: 600, color: "#333" }}>
            {title}
          </h3>
        </Col>
      )}

      {cards.map((c, idx) => (
        <Col key={idx} xs={24} sm={12} md={8} lg={6}>
          <Card
            size="small"
            style={{
              borderRadius: 6,
              border: "1.5px solid #d9d9d9", // borde más visible
              background: "#f9f9f9",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
              padding: "0",
            }}
          >
            <Statistic
              title={<span style={{ fontSize: 14, color: "#666" }}>{c.title}</span>}
              value={c.value}
              precision={c.precision || 2}
              valueStyle={{ fontSize: 16, fontWeight: 500, color: "#111" }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
