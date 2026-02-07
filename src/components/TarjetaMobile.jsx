import { Card, Row, Col, Spin } from "antd";

/**
 * ListadoCards - componente genérico de tarjetas
 *
 * Props:
 *  - data: arreglo de objetos a mostrar
 *  - columns: arreglo de definiciones de columna { label, key, render?, visible?, color? }
 *      - label: nombre a mostrar
 *      - key: clave en el objeto
 *      - render: función opcional para formatear el valor
 *      - visible: boolean opcional para mostrar/ocultar
 *      - color: función opcional que recibe el valor y devuelve un color
 *  - detailsKey: clave en el objeto que contiene un array de detalles
 *  - detailsColumns: columnas para los detalles
 */
export default function TarjetaMobile({
  data,
  columns,
  detailsKey,
  detailsColumns,
  loading = false,
}) {
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 24 }}>
        <Spin size="large" />
      </div>
    );
  }
  return (
    <Row gutter={[12, 12]}>
      {data.map((item, idx) => (
        <Col key={idx} xs={24} sm={12} md={8} style={{ display: "flex" }}>
          <Card
            style={{
              flex: 1,
              marginBottom: 16,
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            {columns.map((col, i) => {
              if (col.visible === false) return null;
              const value = col.render
                ? col.render(item[col.key], item)
                : item[col.key];
              const color = col.color
                ? col.color(item[col.key], item)
                : undefined;

              return (
                <div key={i} style={{ marginBottom: 4, color }}>
                  <strong>{col.label}:</strong> {value}
                </div>
              );
            })}

            {/* Detalles opcionales */}
            {detailsKey && item[detailsKey]?.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary>Ver detalles</summary>
                {item[detailsKey].map((d, j) => (
                  <div
                    key={j}
                    style={{
                      borderTop: "1px dashed #ccc",
                      padding: 4,
                      marginTop: 4,
                    }}
                  >
                    {detailsColumns.map((dc, k) => {
                      const val = dc.render
                        ? dc.render(d[dc.key], d)
                        : d[dc.key];
                      const color = dc.color
                        ? dc.color(d[dc.key], d)
                        : undefined;
                      if (dc.visible === false) return null;

                      return (
                        <div key={k} style={{ color, marginBottom: 2 }}>
                          <strong>{dc.label}:</strong> {val}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </details>
            )}
          </Card>
        </Col>
      ))}
    </Row>
  );
}
