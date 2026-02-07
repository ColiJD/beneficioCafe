"use client";

import { useState, useEffect, useRef } from "react";
import { message, Popconfirm, Button, Row, Col } from "antd";
import CreatableSelect from "react-select/creatable";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import { obtenerSelectData } from "@/lib/consultas";
import ProtectedPage from "@/components/ProtectedPage";

import {
  capitalizarNombre,
  validarRTN,
  validarEmail,
} from "@/config/validacionesForm";
import { validarDatos } from "@/lib/validacionesForm";

export default function CompradorForm() {
  const [compradoresOptions, setCompradoresOptions] = useState([]);
  const [selectedComprador, setSelectedComprador] = useState(null);

  const [formState, setFormState] = useState({
    compradorNombre: "",
    compradorRTN: "",
    compradorDireccion: "",
    compradorTelefono: "",
    compradorEmail: "",
  });

  const [errors, setErrors] = useState({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const selectRef = useRef(null);

  const cargarCompradores = async () => {
    try {
      const data = await obtenerSelectData({
        url: "/api/compradores",
        messageApi,
        valueField: "compradorId",
        labelField: "compradorNombre",
      });
      setCompradoresOptions(data);
    } catch (err) {
      console.error(err);
      messageApi.error("Error cargando compradores");
    }
  };

  useEffect(() => {
    cargarCompradores();
    setTimeout(() => selectRef.current?.focus(), 200);
  }, []); // ✅ solo al montar

  const handleCompradorSelect = (selected) => {
    setSelectedComprador(selected);
    if (selected?.data) {
      const c = selected.data;
      setFormState({
        compradorNombre: c.compradorNombre || "",
        compradorRTN: c.compradorRTN || "",
        compradorDireccion: c.compradorDireccion || "",
        compradorTelefono: c.compradorTelefono || "",
        compradorEmail: c.compradorEmail || "",
      });
    }
  };

  const fieldsConfig = [
    {
      key: "compradorNombre",
      label: "Nombre del Comprador",
      type: "text",
      required: true,
      maxLength: 255,
      validator: (v) => (!v ? "Ingrese el nombre del comprador" : null),
    },
    {
      key: "compradorEmail",
      label: "Email",
      type: "text",
      required: true,
      maxLength: 255,
      placeholder: "ejemplo@correo.com",
      validator: (v) =>
        v && !validarEmail(v)
          ? "Email inválido formato: ejemplo@correo.com"
          : null,
    },

    {
      key: "compradorTelefono",
      label: "Teléfono",
      type: "phone",
      required: true,
      country: "hn",
      validator: (v) => (!v ? "Teléfono inválido, solo números" : null),
    },

    {
      key: "compradorRTN",
      label: "RTN",
      type: "text",
      required: false,
      maxLength: 50,
      placeholder: "0000-0000-0000000",
      validator: (v) =>
        v && !validarRTN(v) ? "RTN inválido, formato: 0000-0000-0000000" : null,
    },

    {
      key: "compradorDireccion",
      label: "Dirección",
      type: "textarea",
      required: false,
      maxLength: 300,
    },
  ];

  const fields = fieldsConfig.map((f) => ({
    ...f,
    value: formState[f.key],
    setter: (val) => {
      setFormState((prev) => ({ ...prev, [f.key]: val }));
      if (f.onChange) f.onChange(val);
    },
    error: errors[f.label],
  }));

  // 🔹 Función para manejar clic en "Crear/Actualizar Cliente"
  const handleSubmitClick = () => {
    if (validarDatos(fields, messageApi, setErrors)) {
      messageApi.info("Revisa la previsualización antes de confirmar");
      setPreviewVisible(true);
    }
  };
  const handleConfirmar = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const data = {
      compradorNombre: capitalizarNombre(formState.compradorNombre),
      compradorRTN: formState.compradorRTN || null,
      compradorDireccion: formState.compradorDireccion || null,
      compradorTelefono: formState.compradorTelefono,
      compradorEmail: formState.compradorEmail?.toLowerCase(),
    };

    const method = selectedComprador?.data?.compradorId ? "PUT" : "POST";
    const url = selectedComprador?.data?.compradorId
      ? `/api/compradores/${selectedComprador.data.compradorId}`
      : "/api/compradores";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const resJson = await res.json();

      if (res.ok) {
        messageApi.success(
          selectedComprador?.data?.compradorId
            ? "Comprador actualizado con éxito"
            : "Comprador creado con éxito"
        );
        setFormState({
          compradorNombre: "",
          compradorRTN: "",
          compradorDireccion: "",
          compradorTelefono: "",
          compradorEmail: "",
        });
        setSelectedComprador(null);
        setPreviewVisible(false);
        await cargarCompradores();
        setTimeout(() => selectRef.current?.focus(), 200);
      } else {
        if (typeof resJson.error === "object") {
          const errores = Object.values(resJson.error).join(", ");
          messageApi.error("Error: " + errores);
        } else {
          messageApi.error(
            "Error: " + (resJson.error || "No se pudo guardar el comprador")
          );
        }
      }
    } catch (error) {
      console.error(error);
      messageApi.error("Error de red o servidor");
    } finally {
      setSubmitting(false);
    }
  };
  const handleDelete = async (compradorId) => {
    try {
      const res = await fetch(`/api/compradores/${compradorId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        messageApi.success("Comprador eliminado con éxito");

        if (selectedComprador?.data?.compradorId === compradorId) {
          setFormState({
            compradorNombre: "",
            compradorRTN: "",
            compradorDireccion: "",
            compradorTelefono: "",
            compradorEmail: "",
          });
          setSelectedComprador(null);
        }

        await cargarCompradores();
        setTimeout(() => selectRef.current?.focus(), 200);
      } else {
        const err = await res.json();
        messageApi.error(
          "Error eliminando: " + (err.error || "Error desconocido")
        );
      }
    } catch (error) {
      console.error(error);
      messageApi.error("Error de red o servidor");
    }
  };

  return (
    <ProtectedPage allowedRoles={["ADMIN", "GERENCIA", "OPERARIOS"]}>
      <>
        {contextHolder}

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}
          >
            Buscar comprador existente
          </label>
          <CreatableSelect
            ref={selectRef}
            options={compradoresOptions}
            placeholder="Seleccione un comprador"
            value={selectedComprador}
            getOptionValue={(option) => option.value}
            getOptionLabel={(option) => option.label}
            formatCreateLabel={(inputValue) =>
              `Crear nuevo comprador: "${inputValue}"`
            }
            onCreateOption={(inputValue) => {
              const newOption = {
                value: inputValue,
                label: inputValue,
                data: { compradorNombre: inputValue },
              };
              setSelectedComprador(newOption);
              setFormState((prev) => ({
                ...prev,
                compradorNombre: inputValue,
              }));
            }}
            onChange={(selected) => {
              if (selected?.data) {
                handleCompradorSelect(selected);
              } else {
                setSelectedComprador(selected);
                setFormState({
                  compradorNombre: selected?.label || "",
                  compradorRTN: "",
                  compradorDireccion: "",
                  compradorTelefono: "",
                  compradorEmail: "",
                });
              }
            }}
            isClearable
            autoFocus
          />
        </div>

        <Formulario
          title="Comprador"
          fields={fields}
          onSubmit={handleSubmitClick}
          submitting={submitting}
          buttons={[
            {
              text: selectedComprador?.data?.compradorId
                ? "Actualizar Comprador"
                : "Crear Comprador",
              type: "primary",
              onClick: handleSubmitClick,
            },
            selectedComprador?.data?.compradorId && {
              render: (
                <Popconfirm
                  title="¿Seguro que quieres eliminar este comprador?"
                  okText="Sí"
                  cancelText="No"
                  onConfirm={() =>
                    handleDelete(selectedComprador.data.compradorId)
                  }
                >
                  <Button danger>Eliminar Comprador</Button>
                </Popconfirm>
              ),
            },
          ].filter(Boolean)}
        />

        <PreviewModal
          open={previewVisible}
          title="Previsualización del Comprador"
          onCancel={() => setPreviewVisible(false)}
          onConfirm={handleConfirmar}
          confirmLoading={submitting}
          fields={fields.map((f) => ({
            label: f.label,
            value: (f.value || "-").toString(),
          }))}
        />
      </>
    </ProtectedPage>
  );
}
