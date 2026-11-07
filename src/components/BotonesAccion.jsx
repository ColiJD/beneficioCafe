"use client";
import { Button } from "antd";
import { EditFilled, DeleteFilled, EyeOutlined } from "@ant-design/icons";

// Acciones de fila con icono (mismo estándar en todas las tablas). Llevan title y aria-label para el cursor y los lectores de pantalla.
export const BotonEditar = ({ titulo = "Editar", ...p }) => (
  <Button size="small" icon={<EditFilled />} title={titulo} aria-label={titulo} {...p} />
);

export const BotonEliminar = ({ titulo = "Eliminar", ...p }) => (
  <Button size="small" danger icon={<DeleteFilled />} title={titulo} aria-label={titulo} {...p} />
);

export const BotonVer = ({ titulo = "Ver", ...p }) => (
  <Button size="small" icon={<EyeOutlined />} title={titulo} aria-label={titulo} {...p} />
);
