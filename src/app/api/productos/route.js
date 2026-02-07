import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

// GET para obtener todos los productos
export async function GET(req) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const productos = await prisma.producto.findMany();
    return new Response(JSON.stringify(productos), { status: 200 });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Error al obtener productos" }),
      { status: 500 }
    );
  }
}

// POST para agregar un producto
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
    const { productName, tara = 0, descuento = 0, factorOro = 1 } = body;

    if (!productName?.trim()) {
      return new Response(
        JSON.stringify({ error: "El nombre del producto es obligatorio" }),
        { status: 400 }
      );
    }
    // 🔹 Validación de nombre único
    const existente = await prisma.producto.findUnique({
      where: { productName: productName.trim() },
    });

    if (existente) {
      return new Response(
        JSON.stringify({ error: "El nombre del producto ya existe" }),
        { status: 400 }
      );
    }

    const nuevoProducto = await prisma.producto.create({
      data: {
        productName: productName.trim(),
        tara: Number(tara),
        descuento: Number(descuento),
        factorOro: Number(factorOro),
      },
    });

    return new Response(JSON.stringify(nuevoProducto), { status: 201 });
  } catch (error) {
    console.error("Error creando producto:", error);
    return new Response(JSON.stringify({ error: "Error al crear producto" }), {
      status: 500,
    });
  }
}
