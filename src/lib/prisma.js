import { PrismaClient } from '@prisma/client';
import { guardaDeFechas } from '@/lib/cosechaGuard';
import { bitacoraExt } from '@/lib/bitacoraExt';

const globalForPrisma = global;

// Cliente con la guarda de cosechas (no se pueden registrar fechas dentro de una cosecha cerrada)
// y la bitácora de escrituras (quién cambió qué).
const crear = () => {
  const base = new PrismaClient();
  return base.$extends(guardaDeFechas(base)).$extends(bitacoraExt(base));
};

const prisma = globalForPrisma.prisma || crear();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
