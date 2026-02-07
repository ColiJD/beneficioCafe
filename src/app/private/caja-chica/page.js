"use client";

import { useState, useEffect, useRef } from "react";
import {
  message,
  Button,
  Space,
  Popconfirm,
  Table,
  DatePicker,
  Spin,
} from "antd";
import dayjs from "dayjs";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import {
  limpiarFormulario,
  validarFloatPositivo,
} from "@/config/validacionesForm";
import { formatNumber } from "@/components/Formulario";

import ProtectedPage from "@/components/ProtectedPage";
import EstadisticasCards from "@/components/ReportesElement/DatosEstadisticos";

export default function CajaChicaPage() {
  const [movimientos, setMovimientos] = useState([]);
  const [selectedMovimiento, setSelectedMovimiento] = useState(null);
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  // Initialize as object for react-select compatibility in Formulario
  const [tipo, setTipo] = useState({ label: "Salida", value: "Salida" });
  const [errors, setErrors] = useState({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filtroFecha, setFiltroFecha] = useState(dayjs());
  const [loading, setLoading] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();
  const messageApiRef = useRef(messageApi);

  const cargarMovimientos = async (fecha) => {
    try {
      setLoading(true);
      // If fecha is undefined, use current filtroFecha state.
      // If explicit null is passed (cleared), use null.
      const dateToUse = fecha === undefined ? filtroFecha : fecha;

      const day = dateToUse ? dayjs(dateToUse).format("YYYY-MM-DD") : "";
      const url = day ? `/api/caja-chica?date=${day}` : `/api/caja-chica`;

      const res = await fetch(url);

      if (!res.ok) return;
      const data = await res.json();

      setMovimientos(data);
    } catch (e) {
      console.error(e);
      messageApiRef.current.error("Error cargando movimientos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarMovimientos();
  }, []);

  // Derived state for filtered movements
  // If we fetched specific date from server, we show what we got.
  // If we fetched ALL history (date=null), we might still want to filter locally?
  // actually, if we fetch all, we show all. If we filter specific date, we fetch specific date.
  // The client side filter is redundant if the server is doing it, but harmless.
  // HOWEVER, if fetching 'all', we don't want to filter by 'filtroFecha' if 'filtroFecha' is null.
  // If 'filtroFecha' is set, we fetched that date, so filtering by it matches.
  const movimientosFiltrados = movimientos;

  // Calculate totals directly from filtered data
  const totales = movimientosFiltrados.reduce(
    (acc, mov) => {
      const m = parseFloat(mov.monto);
      if (mov.tipo === "Saldo Inicial") acc.saldoInicial += m;
      if (mov.tipo === "Entrada") acc.entradas += m;
      if (mov.tipo === "Salida") acc.salidas += m;
      return acc;
    },
    { saldoInicial: 0, entradas: 0, salidas: 0 }
  );

  totales.balance = totales.saldoInicial + totales.entradas - totales.salidas;

  useEffect(() => {
    if (!descripcion.trim()) {
      // Reset logic needs to handle object state for tipo
      setDescripcion("");
      setMonto("");
      setTipo({ label: "Salida", value: "Salida" });
      setErrors({});
      setSelectedMovimiento(null);
    }
  }, [descripcion]);

  const fields = [
    {
      label: "Descripción",
      value: descripcion,
      setter: setDescripcion,
      type: "text",
      required: true,
      error: errors["Descripción"],
      validator: (v) => (v?.trim() ? null : "Ingrese una descripción válida"),
    },
    {
      label: "Monto",
      value: monto,
      setter: setMonto,
      type: "Float",
      required: true,
      error: errors["Monto"],
      validator: validarFloatPositivo,
    },
    {
      label: "Tipo de Movimiento",
      value: tipo,
      setter: setTipo,
      type: "select",
      required: true,
      options: [
        { label: "Entrada", value: "Entrada" },
        { label: "Salida", value: "Salida" },
        { label: "Saldo Inicial", value: "Saldo Inicial" },
      ],
      error: errors["Tipo de Movimiento"],
      validator: (v) => (v ? null : "Seleccione un tipo"),
    },
  ];

  // Función de validación local
  const validarDatos = () => {
    const newErrors = {};
    let isValid = true;

    fields.forEach((field) => {
      if (field.required && field.validator) {
        const error = field.validator(field.value);
        if (error) {
          newErrors[field.label] = error;
          isValid = false;
        }
      }
    });

    setErrors(newErrors);

    if (!isValid) {
      messageApi.error("Por favor corrija los errores en el formulario");
    }

    return isValid;
  };

  const handleRegistrarClick = (e) => {
    if (e) e.preventDefault();
    if (validarDatos()) {
      setPreviewVisible(true);
    }
  };

  const handleConfirmar = async () => {
    setSubmitting(true);
    const payload = {
      descripcion: descripcion.trim(),
      monto: parseFloat(monto),
      tipo: tipo.value, // Extract value from object
      usuarioId: 1,
    };
    const url = selectedMovimiento
      ? `/api/caja-chica/${selectedMovimiento.id}`
      : "/api/caja-chica";
    const method = selectedMovimiento ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        messageApiRef.current.success(
          selectedMovimiento ? "Movimiento actualizado" : "Movimiento agregado"
        );

        setPreviewVisible(false);
        limpiarFormulario({
          descripcion: "",
          monto: "",
          tipo: { label: "Salida", value: "Salida" },
          errors: {},
          selectedMovimiento: null,
        });
        // Manual reset
        setDescripcion("");
        setMonto("");
        setTipo({ label: "Salida", value: "Salida" });
        setErrors({});
        setSelectedMovimiento(null);
        setSelectedMovimiento(null);
        await cargarMovimientos();
        // Notificar al widget
        window.dispatchEvent(new Event("caja-chica-updated"));
      } else {
        const err = await res.json();
        messageApiRef.current.error(err.error || "Error al guardar");
      }
    } catch {
      messageApiRef.current.error("Error de red o servidor");
    } finally {
      setSubmitting(false);
    }
  };

  const tipoOptions = [
    { label: "Entrada", value: "Entrada" },
    { label: "Salida", value: "Salida" },
    { label: "Saldo Inicial", value: "Saldo Inicial" },
  ];

  const handleEdit = (mov) => {
    setSelectedMovimiento(mov);
    setDescripcion(mov.descripcion);
    setMonto(mov.monto.toString());
    const opcion = tipoOptions.find(
      (o) => o.value.toLowerCase() === mov.tipo.trim().toLowerCase()
    );
    setTipo(opcion || { label: "Salida", value: "Salida" });
    messageApiRef.current.info("Modo edición activado");
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/caja-chica/${id}`, { method: "DELETE" });
      if (res.ok) {
        messageApiRef.current.success("Movimiento eliminado");
        await cargarMovimientos();
        window.dispatchEvent(new Event("caja-chica-updated"));
      } else {
        messageApiRef.current.error("Error al eliminar");
      }
    } catch {
      messageApiRef.current.error("Error de red o servidor");
    }
  };

  const columnas = [
    {
      title: "Fecha",
      dataIndex: "fecha",
      render: (f) => dayjs(f).format("DD/MM/YYYY"),
    },
    { title: "Descripción", dataIndex: "descripcion" },
    {
      title: "Tipo",
      dataIndex: "tipo",
      render: (t) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            t === "Entrada"
              ? "bg-green-100 text-green-800"
              : t === "Salida"
              ? "bg-red-100 text-red-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {t}
        </span>
      ),
    },
    {
      title: "Monto",
      dataIndex: "monto",
      align: "right",
      render: (m) => `L. ${formatNumber(m)}`,
    },
    {
      title: "Acciones",
      key: "acciones",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            onClick={() => handleEdit(record)}
          >
            Editar
          </Button>
          <Popconfirm
            title="¿Eliminar movimiento?"
            okText="Sí"
            cancelText="No"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button danger size="small">
              Eliminar
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const stats = [
    {
      titulo: "Saldo Inicial",
      valor: formatNumber(totales.saldoInicial),
      color: "#1677ff",
    },
    {
      titulo: "Entradas",
      valor: formatNumber(totales.entradas),
      color: "#52c41a",
    },
    {
      titulo: "Salidas",
      valor: formatNumber(totales.salidas),
      color: "#ff4d4f",
    },
    {
      titulo: "Balance Actual",
      valor: formatNumber(totales.balance),
      color: totales.balance >= 0 ? "#52c41a" : "#ff4d4f",
    },
  ];

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA"]}>
      {contextHolder}

      {/* Formulario */}
      <div className="mb-6">
        <Formulario
          title={
            selectedMovimiento ? "Editar Movimiento" : "Registrar Movimiento"
          }
          fields={fields}
          onSubmit={handleRegistrarClick}
          submitting={submitting}
          button={{
            text: selectedMovimiento ? "Actualizar" : "Guardar",
            onClick: handleRegistrarClick,
            type: "primary",
          }}
        />
      </div>

      {/* Modal */}
      <PreviewModal
        open={previewVisible}
        title="Confirmar Movimiento"
        onCancel={() => setPreviewVisible(false)}
        onConfirm={handleConfirmar}
        confirmLoading={submitting}
        fields={fields.map((f) => ({
          label: f.label,
          value: f.type === "select" ? f.value?.label : f.value,
        }))}
      />

      {/* Estadísticas */}
      <div className="mb-6">
        <EstadisticasCards data={stats} />
      </div>

      {/* Filtro por fecha */}
      <div className="mb-4 flex items-center gap-2">
        <DatePicker
          value={filtroFecha}
          onChange={(date) => {
            setFiltroFecha(date);
            cargarMovimientos(date);
          }}
          allowClear
          placeholder="Sin filtro (Ver todo)"
          className="rounded border-gray-300"
        />
        <Button
          onClick={() => {
            const today = dayjs();
            setFiltroFecha(today);
            cargarMovimientos(today);
          }}
        >
          Hoy
        </Button>
        <Popconfirm
          title="¿Cerrar caja del día seleccionado?"
          description="Esto generará el Saldo Inicial para el día siguiente basado en el balance actual."
          onConfirm={async () => {
            const dateToUse = filtroFecha || dayjs();
            const tomorrow = dateToUse.add(1, "day").format("YYYY-MM-DD");
            try {
              setLoading(true);
              // Trigger the lazy evaluation for tomorrow, which sums up today's balance
              const res = await fetch(`/api/caja-chica?date=${tomorrow}`);
              if (res.ok) {
                messageApiRef.current.success(
                  "Caja cerrada. Saldo inicial generado para mañana."
                );
                // Optionally switch view to tomorrow or stay?
                // User likely wants to stay, just confirm it's done.
              } else {
                messageApiRef.current.error("Error al cerrar caja");
              }
            } catch (e) {
              console.error(e);
              messageApiRef.current.error("Error de conexión");
            } finally {
              setLoading(false);
            }
          }}
          okText="Sí, Cerrar"
          cancelText="Cancelar"
        >
          <Button type="default" danger>
            Cerrar Caja
          </Button>
        </Popconfirm>
      </div>

      {/* Tabla */}
      <Spin spinning={loading} tip="Cargando movimientos...">
        <Table
          dataSource={movimientosFiltrados}
          columns={columnas}
          rowKey="id"
          bordered
          size="small"
          scroll={{ x: "max-content" }}
        />
      </Spin>
    </ProtectedPage>
  );
}
