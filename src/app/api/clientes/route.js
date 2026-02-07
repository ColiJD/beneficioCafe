import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const clientes = await prisma.cliente.findMany();
    return new Response(JSON.stringify(clientes), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
export async function POST(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const body = await req.json();

    // Verificar si ya existe un cliente con la misma cédula
    // const existingCedula = await prisma.cliente.findUnique({
    //   where: { clienteCedula: body.clienteCedula },
    // });
    // if (existingCedula) {
    //   return new Response(
    //     JSON.stringify({ error: "Ya existe un cliente con esa cédula" }),
    //     { status: 400 }
    //   );
    // }

    // Crear el cliente
    const cliente = await prisma.cliente.create({
      data: {
        clienteCedula: body.clienteCedula,
        clienteNombre: body.clienteNombre,
        clienteApellido: body.clienteApellido,
        clienteDirecion: body.clienteDirecion,
        clienteMunicipio: body.clienteMunicipio,
        clienteDepartament: body.clienteDepartament,
        claveIHCAFE: body.claveIHCAFE,
        clienteTelefono: body.clienteTelefono,
        clienteRTN: body.clienteRTN || null, // solo lo guardamos tal cual
      },
    });

    return new Response(JSON.stringify(cliente), { status: 201 });
  } catch (error) {
    console.error("Error creando cliente:", error);

    if (error.code === "P2002") {
      return new Response(
        JSON.stringify({
          error: "Ya existe un registro con esa cédula o RTN",
        }),
        { status: 400 }
      );
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
