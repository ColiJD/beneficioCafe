import { checkRole } from "@/lib/checkRole";
import prisma from "@/lib/prisma";
import {
  capitalizarNombre,
  validarEmail,
  validarRTN,
  validarTelefono,
  validarRequerido,
  validarDatosGenerico,
} from "@/lib/validacionesBackend";

export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  try {
    const compradores = await prisma.compradores.findMany();
    return new Response(JSON.stringify(compradores), { status: 200 });
  } catch (error) {
    console.error("Error obteniendo compradores:", error);
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

    // Crear comprador
    const comprador = await prisma.compradores.create({
      data: {
        compradorNombre: capitalizarNombre(body.compradorNombre),
        compradorRTN: body.compradorRTN || null,
        compradorDireccion: body.compradorDireccion || null,
        compradorTelefono: body.compradorTelefono,
        compradorEmail: body.compradorEmail.toLowerCase(),
      },
    });

    return new Response(JSON.stringify(comprador), { status: 201 });
  } catch (error) {
    console.error("Error creando comprador:", error);

    // Error de duplicado de RTN
    if (error.code === "P2002") {
      return new Response(
        JSON.stringify({ error: "Ya existe un registro con ese RTN" }),
        { status: 400 }
      );
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
