import { generarContrato } from "@/Doc/Documentos/contratoBase";

/** Contrato de venta de café (la empresa vende al comprador) */
export const exportContratoSalida = (formState) => generarContrato("venta", formState);
