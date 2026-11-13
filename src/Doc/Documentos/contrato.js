import { generarContrato } from "@/Doc/Documentos/contratoBase";

/** Contrato de compra-venta de café (la empresa compra al productor) */
export const exportContratoCafe = (formState) => generarContrato("compra", formState);
