import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function DELETE(req, { params }) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    // 1️⃣ Validar que params.id sea un número
    const id = parseInt(params.id);

    if (isNaN(id) || id <= 0) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    // 2️⃣ Verificar si el cliente existe
    const clienteExistente = await prisma.cliente.findUnique({
      where: { clienteID: id },
    });

    if (!clienteExistente) {
      return new Response(JSON.stringify({ error: "Cliente no encontrado" }), {
        status: 404,
      });
    }

    // 3️⃣ Verificar si hay registros relacionados
    // Ejemplo: contratos asociados al cliente
    const contratosRelacionados = await prisma.contrato.findFirst({
      where: { contratoclienteID: id },
    });

    if (contratosRelacionados) {
      return new Response(
        JSON.stringify({
          error:
            "No se puede eliminar este cliente porque tiene contratos asociados",
        }),
        { status: 400 }
      );
    }

    // 4️⃣ Eliminar cliente (solo si no tiene dependencias)
    await prisma.cliente.delete({ where: { clienteID: id } });

    return new Response(JSON.stringify({ message: "Cliente eliminado" }), {
      status: 200,
    });
  } catch (error) {
    console.error("Error eliminando cliente:", error);

    // Manejo de errores comunes de Prisma
    if (error.code === "P2025") {
      return new Response(
        JSON.stringify({ error: "Cliente no encontrado para eliminar" }),
        {
          status: 404,
        }
      );
    }
    if (error.code === "P2003") {
      return new Response(
        JSON.stringify({
          error:
            "No se puede eliminar este cliente por restricciones de integridad referencial",
        }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ error: "Error interno del servidor: " + error.message }),
      { status: 500 }
    );
  }
}

export async function PUT(req, context) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    // 1️⃣ Obtener params de manera segura (sin await)
    const { params } = await context;
    const id = parseInt(params.id);
    if (isNaN(id) || id <= 0) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
      });
    }

    // 2️⃣ Obtener datos del body
    const body = await req.json();

    // 3️⃣ Verificar que el cliente exista
    const clienteExistente = await prisma.cliente.findUnique({
      where: { clienteID: id },
    });
    if (!clienteExistente) {
      return new Response(JSON.stringify({ error: "Cliente no encontrado" }), {
        status: 404,
      });
    }

    // 4️⃣ Verificar duplicado de cédula en otro cliente
    if (
      body.clienteCedula &&
      body.clienteCedula !== clienteExistente.clienteCedula
    ) {
      const cedulaDuplicada = await prisma.cliente.findUnique({
        where: { clienteCedula: body.clienteCedula },
      });
      if (cedulaDuplicada) {
        return new Response(
          JSON.stringify({ error: "Ya existe un cliente con esa cédula" }),
          { status: 400 }
        );
      }
    }

    // 5️⃣ Actualizar cliente
    const clienteActualizado = await prisma.cliente.update({
      where: { clienteID: id },
      data: {
        clienteCedula: body.clienteCedula || clienteExistente.clienteCedula,
        clienteNombre:
          typeof body.clienteNombre === "string"
            ? body.clienteNombre
            : body.clienteNombre?.value || body.clienteNombre?.label || "",
        clienteApellido:
          body.clienteApellido || clienteExistente.clienteApellido,
        clienteDirecion:
          body.clienteDirecion || clienteExistente.clienteDirecion,
        clienteDepartament:
          body.clienteDepartament || clienteExistente.clienteDepartament,
        clienteMunicipio:
          body.clienteMunicipio || clienteExistente.clienteMunicipio,
        claveIHCAFE: body.claveIHCAFE || clienteExistente.claveIHCAFE,
        clienteTelefono:
          body.clienteTelefono || clienteExistente.clienteTelefono,
        clienteRTN: body.clienteRTN || clienteExistente.clienteRTN,
      },
    });

    return new Response(JSON.stringify(clienteActualizado), { status: 200 });
  } catch (error) {
    console.error("Error actualizando cliente:", error);

    if (error.code === "P2002") {
      return new Response(
        JSON.stringify({
          error: "Ya existe un registro con algún dato único duplicado",
        }),
        { status: 400 }
      );
    }
    if (error.code === "P2025") {
      return new Response(
        JSON.stringify({ error: "Cliente no encontrado para actualizar" }),
        { status: 404 }
      );
    }

    return new Response(
      JSON.stringify({ error: "Error interno del servidor: " + error.message }),
      { status: 500 }
    );
  }
}
