import { Row, Col, Input, Select, DatePicker, Grid } from "antd";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { useBreakpoint } = Grid;

export default function Filtros({ fields }) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {fields.map((f, idx) => {
        const fechaInicio = f.value?.[0] || null;
        const fechaFin = f.value?.[1] || null;

        return (
          <Col key={idx} xs={24} sm={18} md={12}>
            {f.type === "input" ? (
              <Input
                placeholder={f.placeholder}
                value={f.value}
                onChange={(e) => f.setter(e.target.value)}
              />
            ) : f.type === "select" ? (
              <Select
                placeholder={f.placeholder}
                value={f.value}
                onChange={f.setter}
                allowClear={f.allowClear}
              >
                {f.options?.map((o) =>
                  typeof o === "string" ? (
                    <Option key={o} value={o}>
                      {o}
                    </Option>
                  ) : (
                    <Option key={o.value} value={o.value}>
                      {o.label}
                    </Option>
                  )
                )}
              </Select>
            ) : f.type === "date" ? (
              isMobile ? (
                <Row>
                  <Col>
                    <DatePicker
                      placeholder="Fecha inicio"
                      value={fechaInicio}
                      format="DD/MM/YYYY"
                      onChange={(date) => f.setter([date || null, fechaFin])}
                    />
                  </Col>
                  <Col>
                    <DatePicker
                      placeholder="Fecha fin"
                      format="DD/MM/YYYY"
                      value={fechaFin}
                      onChange={(date) => f.setter([fechaInicio, date || null])}
                    />
                  </Col>
                </Row>
              ) : (
                <RangePicker
               
                  placeholder={["Fecha inicio", "Fecha fin"]}
                  format="DD/MM/YYYY"
                  value={f.value}
                  allowEmpty={[true, true]}
                  onChange={f.setter}
                />
              )
            ) : null}
          </Col>
        );
      })}
    </Row>
  );
}
