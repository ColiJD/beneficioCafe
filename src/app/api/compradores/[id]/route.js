import prisma from "@/lib/prisma";
import {
  capitalizarNombre,
  validarEmail,
  validarRTN,
  validarTelefono,
  validarRequerido,
  validarDatosGenerico,
} from "@/lib/validacionesBackend";
import { checkRole } from "@/lib/checkRole";

// PUT: actualizar comprador
export async function PUT(req, { params }) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const id = parseInt(params.id);
    if (isNaN(id) || id <= 0) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    const body = await req.json();

    // Verificar si existe el comprador
    const compradorExistente = await prisma.compradores.findUnique({
      where: { compradorId: id },
    });
    if (!compradorExistente) {
      return new Response(
        JSON.stringify({ error: "Comprador no encontrado" }),
        { status: 404 }
      );
    }

    // Validaciones
    const { valido, errores } = validarDatosGenerico(body, {
      compradorNombre: [(v) => validarRequerido(v, "Nombre")],
      compradorEmail: [(v) => validarRequerido(v, "Email"), validarEmail],
      compradorTelefono: [
        (v) => validarRequerido(v, "Teléfono"),
        validarTelefono,
      ],
      compradorRTN: [validarRTN], // opcional
    });

    if (!valido) {
      return new Response(JSON.stringify({ error: errores }), { status: 400 });
    }

    // Verificar duplicado de RTN
    if (
      body.compradorRTN &&
      body.compradorRTN !== compradorExistente.compradorRTN
    ) {
      const rtnDuplicado = await prisma.compradores.findUnique({
        where: { compradorRTN: body.compradorRTN },
      });
      if (rtnDuplicado) {
        return new Response(
          JSON.stringify({ error: "Ya existe un comprador con ese RTN" }),
          { status: 400 }
        );
      }
    }

    // Actualizar comprador
    const compradorActualizado = await prisma.compradores.update({
      where: { compradorId: id },
      data: {
        compradorNombre: capitalizarNombre(body.compradorNombre),
        compradorRTN: body.compradorRTN || null,
        compradorDireccion: body.compradorDireccion || null,
        compradorTelefono: body.compradorTelefono,
        compradorEmail: body.compradorEmail?.toLowerCase(),
      },
    });

    return new Response(JSON.stringify(compradorActualizado), { status: 200 });
  } catch (error) {
    console.error("Error actualizando comprador:", error);

    if (error.code === "P2002") {
      return new Response(JSON.stringify({ error: "Dato único duplicado" }), {
        status: 400,
      });
    }
    if (error.code === "P2025") {
      return new Response(
        JSON.stringify({ error: "Comprador no encontrado para actualizar" }),
        { status: 404 }
      );
    }

    return new Response(
      JSON.stringify({ error: "Error interno: " + error.message }),
      { status: 500 }
    );
  }
}

// DELETE: eliminar comprador
export async function DELETE(req, { params }) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const id = parseInt(params.id);
    if (isNaN(id) || id <= 0) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    const compradorExistente = await prisma.compradores.findUnique({
      where: { compradorId: id },
    });
    if (!compradorExistente) {
      return new Response(
        JSON.stringify({ error: "Comprador no encontrado" }),
        { status: 404 }
      );
    }

    // Aquí podrías verificar dependencias relacionadas si las hay
    // Ej: si existen órdenes asociadas
    // const ordenesRelacionadas = await prisma.orden.findFirst({ where: { compradorId: id } });
    // if (ordenesRelacionadas) return new Response(JSON.stringify({ error: "No se puede eliminar, tiene órdenes asociadas" }), { status: 400 });

    await prisma.compradores.delete({ where: { compradorId: id } });

    return new Response(JSON.stringify({ message: "Comprador eliminado" }), {
      status: 200,
    });
  } catch (error) {
    console.error("Error eliminando comprador:", error);

    if (error.code === "P2025") {
      return new Response(
        JSON.stringify({ error: "Comprador no encontrado para eliminar" }),
        { status: 404 }
      );
    }
    if (error.code === "P2003") {
      return new Response(
        JSON.stringify({
          error:
            "No se puede eliminar por restricciones de integridad referencial",
        }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ error: "Error interno: " + error.message }),
      { status: 500 }
    );
  }
}
