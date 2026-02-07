import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";

// Eliminar producto
export async function DELETE(req, context) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  const { params } = context; // ✅ correcto
  const id = parseInt(params.id);

  if (isNaN(id) || id <= 0) {
    return new Response(JSON.stringify({ error: "ID inválido" }), {
      status: 400,
    });
  }

  try {
    const productoExistente = await prisma.producto.findUnique({
      where: { productID: id },
    });

    if (!productoExistente) {
      return new Response(JSON.stringify({ error: "Producto no encontrado" }), {
        status: 404,
      });
    }

    await prisma.producto.delete({ where: { productID: id } });

    return new Response(JSON.stringify({ message: "Producto eliminado" }), {
      status: 200,
    });
  } catch (error) {
    console.error("Error eliminando producto:", error);
    // Validación especial para errores de FK (P2003)
    if (error.code === "P2003") {
      return new Response(
        JSON.stringify({
          error:
            "No se puede eliminar el producto porque está asociado a otras transacciones.",
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

// Actualizar producto
export async function PUT(req, { params }) {
  const sessionOrResponse = await checkRole(req, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  const id = parseInt(params.id);

  if (isNaN(id) || id <= 0) {
    return new Response(JSON.stringify({ error: "ID inválido" }), {
      status: 400,
    });
  }

  try {
    const body = await req.json();
    const { productName, tara, descuento, factorOro } = body;

    const productoExistente = await prisma.producto.findUnique({
      where: { productID: id },
    });

    if (!productoExistente) {
      return new Response(JSON.stringify({ error: "Producto no encontrado" }), {
        status: 404,
      });
    }
    // 🔹 Validar nombre único si se cambia
    if (productName && productName.trim() !== productoExistente.productName) {
      const duplicado = await prisma.producto.findUnique({
        where: { productName: productName.trim() },
      });
      if (duplicado) {
        return new Response(
          JSON.stringify({ error: "El nombre del producto ya existe" }),
          { status: 400 }
        );
      }
    }
    // Actualizar producto sin validar duplicados
    const productoActualizado = await prisma.producto.update({
      where: { productID: id },
      data: {
        productName: productName?.trim() || productoExistente.productName,
        tara: typeof tara === "number" ? tara : productoExistente.tara,
        descuento:
          typeof descuento === "number"
            ? descuento
            : productoExistente.descuento,
        factorOro:
          typeof factorOro === "number"
            ? factorOro
            : productoExistente.factorOro,
      },
    });

    return new Response(JSON.stringify(productoActualizado), { status: 200 });
  } catch (error) {
    console.error("Error actualizando producto:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor: " + error.message }),
      { status: 500 }
    );
  }
}
