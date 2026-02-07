"use client";

import { Table, Typography } from "antd";
const { Text } = Typography;

/**
 * Componente Summary Avanzado para Ant Design Table
 * - Calcula totales de columnas numéricas, incluyendo columnas anidadas (children)
 * - Detecta automáticamente si es Lps para agregar prefijo "L."
 *
 * @param {Object} props
 * @param {Array} props.columns - Columnas de la tabla (pueden tener children)
 * @param {Array} props.data - Datos de la tabla
 * @param {number} props.offset - Número de columnas iniciales que no se suman (ID, nombre, etc.)
 * @param {Function} props.formatNumber - Función para formatear números
 */
const TablaTotales = ({
  columns,
  data,
  offset = 2,
  formatNumber = (v) => v,
}) => {
  if (!data || !data.length || !columns || !columns.length) return null;

  // Flatten columns to get all leaf dataIndex columns after offset
  const flattenColumns = (cols) => {
    let result = [];
    cols.forEach((col) => {
      if (col.children && col.children.length) {
        result = result.concat(flattenColumns(col.children));
      } else {
        result.push(col);
      }
    });
    return result;
  };

  const leafColumns = flattenColumns(columns).slice(offset);

  // Calcular totales
  const totales = {};
  data.forEach((row) => {
    leafColumns.forEach((col) => {
      const key = col.dataIndex;
      // Excluir columna promedio
      if (key?.toLowerCase().includes("promedio")) return;
      const value = parseFloat(row[key]);
      if (!isNaN(value)) totales[key] = (totales[key] || 0) + value;
    });
  });

  // Calcular promedio general ponderado
  const totalQQ = totales.totalQQ || 0;
  const totalLps = totales.totalLps || 0;
  const promedioGeneral = totalQQ > 0 ? totalLps / totalQQ : 0;

  return (
    <Table.Summary.Row>
      {/* Celdas vacías iniciales */}
      <Table.Summary.Cell index={0} colSpan={offset}>
        <Text strong>Total</Text>
      </Table.Summary.Cell>

      {leafColumns.map((col, idx) => {
        const key = col.dataIndex;

        // Mostrar el promedio general solo en la columna promedio
        if (key?.toLowerCase().includes("promedio")) {
          return (
            <Table.Summary.Cell key={key} index={offset + idx} align="right">
              <Text strong>L. {formatNumber(promedioGeneral)}</Text>
            </Table.Summary.Cell>
          );
        }

        return (
          <Table.Summary.Cell key={key} index={offset + idx} align="right">
            <Text strong>
              {col.title && col.title.toString().toLowerCase().includes("lps")
                ? "L. "
                : ""}
              {formatNumber(totales[key])}
            </Text>
          </Table.Summary.Cell>
        );
      })}
    </Table.Summary.Row>
  );
};

export default TablaTotales;
