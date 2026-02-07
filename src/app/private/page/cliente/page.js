"use client";
import { useState, useEffect, useRef } from "react";
import { message, Popconfirm, Button, Row, Col } from "antd";
import CreatableSelect from "react-select/creatable";
import Formulario from "@/components/Formulario";
import PreviewModal from "@/components/Modal";
import { departamentos, municipiosPorDepartamento } from "./data";
import { obtenerClientesSelect } from "@/lib/consultas";
import {
  capitalizarNombre,
  validarCedula,
  validarRTN,
  validarTelefono,
} from "@/config/validacionesForm";
import { validarDatos } from "@/lib/validacionesForm";
import ProtectedPage from "@/components/ProtectedPage";

export default function ClienteForm() {
  // 🔹 Estados de datos seleccionables
  const [clientesOptions, setClientesOptions] = useState([]);
  const [municipiosOptions, setMunicipiosOptions] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState(null);

  // 🔹 Estado centralizado del formulario
  const [formState, setFormState] = useState({
    clienteNombre: "",
    clienteApellido: "",
    clienteCedula: "",
    clienteDirecion: "",
    clienteDepartament: null,
    clienteMunicipio: null,
    claveIHCAFE: "",
    clienteTelefono: "",
    clienteRTN: "",
  });

  // 🔹 Estado para errores de validación
  const [errors, setErrors] = useState({});

  // 🔹 Estado para mostrar modal de previsualización
  const [previewVisible, setPreviewVisible] = useState(false);

  // 🔹 Estado para mostrar carga durante envío
  const [submitting, setSubmitting] = useState(false);

  // 🔹 API de mensajes de Ant Design
  const [messageApi, contextHolder] = message.useMessage();

  // 🔹 Referencia para el select
  const selectRef = useRef(null);

  // 🔹 useEffect para cargar clientes desde la API
  useEffect(() => {
    async function cargarClientes() {
      try {
        const clientes = await obtenerClientesSelect(messageApi);
        setClientesOptions(clientes);
      } catch (err) {
        console.error(err);
        messageApi.error("Error cargando clientes");
      }
    }
    cargarClientes();
    setTimeout(() => selectRef.current?.focus(), 200);
  }, [messageApi]);

  // 🔹 Función para manejar cambio de departamento
  const handleDepartamentoChange = (selected) => {
    setFormState((prev) => ({
      ...prev,
      clienteMunicipio: null,
    }));
    setMunicipiosOptions(
      selected
        ? (municipiosPorDepartamento[selected.value] || []).map((m) => ({
            value: m,
            label: m,
          }))
        : []
    );
  };

  // 🔹 Función para manejar selección de cliente existente
  const handleClienteSelect = (selected) => {
    setSelectedCliente(selected);
    if (selected?.data) {
      const c = selected.data;
      setFormState({
        clienteCedula: c.clienteCedula || "",
        clienteNombre: c.clienteNombre || "",
        clienteApellido: c.clienteApellido || "",
        clienteDirecion: c.clienteDirecion || "",
        clienteDepartament: c.clienteDepartament
          ? { value: c.clienteDepartament, label: c.clienteDepartament }
          : null,
        clienteMunicipio: c.clienteMunicipio
          ? { value: c.clienteMunicipio, label: c.clienteMunicipio }
          : null,
        claveIHCAFE: c.claveIHCAFE || "",
        clienteTelefono: c.clienteTelefono || "",
        clienteRTN: c.clienteRTN || "",
      });

      if (c.clienteDepartament) {
        setMunicipiosOptions(
          (municipiosPorDepartamento[c.clienteDepartament] || []).map((m) => ({
            value: m,
            label: m,
          }))
        );
      }
    }
  };

  // 🔹 Configuración dinámica de campos del formulario
  const fieldsConfig = [
    {
      key: "clienteNombre",
      label: "Nombre",
      type: "text",
      required: true,
      maxLength: 50,
      validator: (v) => (!v ? "Ingrese el nombre" : null),
    },
    {
      key: "clienteApellido",
      label: "Apellido",
      type: "text",
      required: true,
      maxLength: 50,
      validator: (v) => (!v ? "Ingrese el apellido" : null),
    },
    {
      key: "clienteCedula",
      label: "Cédula",
      type: "text",
      required: false,
      maxLength: 15,
      placeholder: "0000-0000-00000",
      validator: (v) =>
        v && !validarCedula(v)
          ? "Cédula inválida, formato: 0000-0000-00000"
          : null,
    },
    {
      key: "clienteDirecion",
      label: "Dirección",
      type: "text",
      required: true,
      maxLength: 200,
      validator: (v) => (!v ? "Ingrese la dirección" : null),
    },
    {
      key: "clienteDepartament",
      label: "Departamento",
      type: "select",
      options: departamentos.map((dep) => ({ value: dep, label: dep })),
      required: true,
      validator: (v) => (!v ? "Seleccione departamento" : null),
      onChange: handleDepartamentoChange,
    },
    {
      key: "clienteMunicipio",
      label: "Municipio",
      type: "select",
      options: municipiosOptions,
      required: true,
      disabled: municipiosOptions.length === 0,
      validator: (v) => (!v ? "Seleccione municipio" : null),
    },
    {
      key: "claveIHCAFE",
      label: "Clave IHCAFE",
      type: "text",
      required: false,
    },
    {
      key: "clienteTelefono",
      label: "Teléfono",
      type: "phone",
      required: true,
      country: "hn",
      validator: (v) => (!v ? "Teléfono inválido, solo números" : null),
    },
    {
      key: "clienteRTN",
      label: "RTN",
      type: "text",
      required: false,
      maxLength: 17,
      placeholder: "0000-0000-0000000",
      validator: (v) =>
        v && !validarRTN(v) ? "RTN inválido, formato: 0000-0000-0000000" : null,
    },
  ];

  // 🔹 Mapear configuración a campos completos con setters y errores
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

  // 🔹 Función para confirmar registro/actualización de cliente
  const handleConfirmar = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    // 🔹 Construcción de objeto a enviar
    const data = {
      clienteCedula: formState.clienteCedula || null,
      clienteNombre: capitalizarNombre(formState.clienteNombre) || "",
      clienteApellido: capitalizarNombre(formState.clienteApellido) || "",
      clienteDirecion: formState.clienteDirecion || "",
      clienteDepartament: formState.clienteDepartament?.value || "",
      clienteMunicipio: formState.clienteMunicipio?.value || "",
      claveIHCAFE: formState.claveIHCAFE || "",
      clienteTelefono: formState.clienteTelefono || "",
      clienteRTN: formState.clienteRTN || "",
    };

    const method = selectedCliente?.data?.clienteID ? "PUT" : "POST";
    const url = selectedCliente?.data?.clienteID
      ? `/api/clientes/${selectedCliente.data.clienteID}`
      : "/api/clientes";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        messageApi.success(
          selectedCliente?.data?.clienteID
            ? "Cliente actualizado con éxito"
            : "Cliente creado con éxito"
        );

        // 🔹 Limpiar formulario
        setFormState({
          clienteNombre: "",
          clienteApellido: "",
          clienteCedula: "",
          clienteDirecion: "",
          clienteDepartament: null,
          clienteMunicipio: null,
          claveIHCAFE: "",
          clienteTelefono: "",
          clienteRTN: "",
        });
        setSelectedCliente(null);
        setMunicipiosOptions([]);
        setPreviewVisible(false);

        // Recargar clientes
        const clientes = await obtenerClientesSelect(messageApi);
        setClientesOptions(clientes);
        setTimeout(() => selectRef.current?.focus(), 200);
      } else {
        const err = await res.json();
        messageApi.error(
          "Error: " + (err.error || "No se pudo guardar el cliente")
        );
      }
    } catch (error) {
      console.error(error);
      messageApi.error("Error de red o servidor");
    } finally {
      setSubmitting(false);
    }
  };

  // 🔹 Función para eliminar cliente
  const handleDelete = async (clienteID) => {
    try {
      const res = await fetch(`/api/clientes/${clienteID}`, {
        method: "DELETE",
      });

      if (res.ok) {
        messageApi.success("Cliente eliminado con éxito");

        if (selectedCliente?.data?.clienteID === clienteID) {
          setFormState({
            clienteNombre: "",
            clienteApellido: "",
            clienteCedula: "",
            clienteDirecion: "",
            clienteDepartament: null,
            clienteMunicipio: null,
            claveIHCAFE: "",
            clienteTelefono: "",
            clienteRTN: "",
          });
          setSelectedCliente(null);
          setMunicipiosOptions([]);
        }

        const clientes = await obtenerClientesSelect(messageApi);
        setClientesOptions(clientes);
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

        {/* Selector de cliente existente */}
        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}
          >
            Buscar cliente existente
          </label>
          <CreatableSelect
            ref={selectRef}
            options={clientesOptions}
            placeholder="Seleccione un cliente"
            value={selectedCliente}
            getOptionValue={(option) => option.value}
            getOptionLabel={(option) => option.label}
            formatCreateLabel={(inputValue) =>
              `Crear nuevo cliente: "${inputValue}"`
            }
            onCreateOption={(inputValue) => {
              const newOption = {
                value: inputValue,
                label: inputValue,
                data: { clienteNombre: inputValue },
              };
              setSelectedCliente(newOption);
              setFormState((prev) => ({
                ...prev,
                clienteNombre: inputValue,
              }));
            }}
            onChange={(selected) => {
              setSelectedCliente(selected);
              if (selected?.data) {
                handleClienteSelect(selected);
              } else {
                setFormState({
                  clienteNombre: selected?.label || "",
                  clienteApellido: "",
                  clienteCedula: "",
                  clienteDirecion: "",
                  clienteDepartament: null,
                  clienteMunicipio: null,
                  claveIHCAFE: "",
                  clienteTelefono: "",
                  clienteRTN: "",
                });
                setMunicipiosOptions([]);
              }
            }}
            isClearable
            autoFocus
          />
        </div>

        {/* Componente de formulario principal */}
        <Formulario
          title="Cliente"
          fields={fields}
          onSubmit={handleSubmitClick}
          submitting={submitting}
          button={{
            text: selectedCliente?.data?.clienteID
              ? "Actualizar Cliente"
              : "Crear Cliente",
            onClick: handleSubmitClick,
            type: "primary",
          }}
        />
        {/* Botón de eliminar si es cliente existente */}
        {selectedCliente?.data?.clienteID && (
          <Row style={{ marginTop: "1rem", justifyContent: "flex-start" }}>
            <Col>
              <Popconfirm
                title="¿Seguro que quieres eliminar?"
                onConfirm={() => handleDelete(selectedCliente.data.clienteID)}
                okText="Sí"
                cancelText="No"
              >
                <Button danger disabled={submitting}>
                  Eliminar Cliente
                </Button>
              </Popconfirm>
            </Col>
          </Row>
        )}

        {/* Modal de previsualización */}
        <PreviewModal
          open={previewVisible}
          title="Previsualización del Cliente"
          onCancel={() => setPreviewVisible(false)}
          onConfirm={handleConfirmar}
          confirmLoading={submitting}
          fields={fields.map((f) => ({
            label: f.label,
            value:
              f.type === "select"
                ? (f.value?.label || "-").toString()
                : (f.value || "-").toString(),
          }))}
        />
      </>
    </ProtectedPage>
  );
}
