import { Prisma } from "@prisma/client";

/**
 * Envoltorio seguro para consultas de Prisma.
 * Captura errores de conexión y lanza mensajes amigables.
 * @param {Function} operation - Función asíncrona que ejecuta la consulta de Prisma.
 * @returns {Promise<any>} - El resultado de la operación.
 * @throws {Error} - Lanza error con mensaje amigable si hay fallo de conexión.
 */
export async function prismaSafe(operation) {
  try {
    return await operation();
  } catch (error) {
    console.error("Prisma Error Details:", error);

    // Errores de inicialización o conexión (ej. DB apagada, firewall, credenciales inválidas)
    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientRustPanicError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error.message.includes("Can't reach database server") ||
      error.code === "P1001" // Can't reach database server
    ) {
      throw new Error(
        "Error de conexión: No se puede acceder. Por favor, verifique su conexión o intente más tarde.",
      );
    }

    // Relanzar otros errores para que sean manejados por quien llama o por NextAuth
    throw error;
  }
}
