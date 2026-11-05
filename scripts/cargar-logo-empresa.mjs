// Guarda el logo (y opcionalmente el icono) de la empresa en su base de datos.
// Uso: node --env-file=.env scripts/cargar-logo-empresa.mjs <logo.png> [icono.ico]
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const TIPOS = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const [logo, icono] = process.argv.slice(2);
if (!logo) throw new Error("Uso: cargar-logo-empresa.mjs <logo> [icono]");
const leer = (f) => {
  const tipo = TIPOS[path.extname(f).toLowerCase()];
  if (!tipo) throw new Error(`Formato no admitido: ${f}`);
  return { datos: fs.readFileSync(f), tipo };
};
const data = {};
const l = leer(logo); (data.logoDatos = l.datos), (data.logoTipo = l.tipo);
if (icono) { const i = leer(icono); (data.iconoDatos = i.datos), (data.iconoTipo = i.tipo); }

const prisma = new PrismaClient();
const fila = await prisma.empresa.findFirst({ select: { empresaID: true } });
if (!fila) throw new Error("La tabla empresa está vacía: ejecute prisma/empresa.sql primero.");
await prisma.empresa.update({ where: { empresaID: fila.empresaID }, data });
console.log("Imágenes guardadas en la base:", process.env.DATABASE_URL.split("/").pop().split("?")[0]);
await prisma.$disconnect();
