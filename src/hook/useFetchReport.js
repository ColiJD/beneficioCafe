import { useState, useEffect } from "react";
import { message } from "antd";

export const useFetchReport = (endpoint, defaultRange = null) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rangoFechas, setRangoFechas] = useState(defaultRange);
  const [messageApi, contextHolder] = message.useMessage();

  const fetchData = async (desde, hasta) => {
    try {
      setLoading(true);
      let url = endpoint;

      // Solo agregamos parámetros si ambos existen
      if (desde && hasta) {
        url += `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(
          hasta
        )}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Error en la API");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      messageApi.error("Error cargando datos.");
    } finally {
      setLoading(false);
    }
  };

  const onFechasChange = (val) => {
    setRangoFechas(val);

    // Si no hay rango completo, traer todos los datos
    if (!val || !val[0] || !val[1]) {
      fetchData();
      return;
    }

    const desde = val[0].startOf("day").toISOString();
    const hasta = val[1].endOf("day").toISOString();
    fetchData(desde, hasta);
  };

  useEffect(() => {
    // Si defaultRange tiene rango válido, lo usamos
    if (defaultRange && defaultRange[0] && defaultRange[1]) {
      fetchData(
        defaultRange[0].startOf("day").toISOString(),
        defaultRange[1].endOf("day").toISOString()
      );
    } else {
      fetchData();
    }
  }, []);

  return {
    data,
    loading,
    rangoFechas,
    setRangoFechas,
    fetchData,
    onFechasChange,
    messageApi,
    contextHolder,
  };
};
