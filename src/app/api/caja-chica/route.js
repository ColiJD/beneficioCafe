import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date"); // YYYY-MM-DD

    let whereClause = {};

    if (dateParam) {
      // Logic for Balance Carry Over (Smart Update / Self-Healing)
      const startOfDay = new Date(`${dateParam}T06:00:00Z`);
      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

      // 1. Calculate what the balance SHOULD be (Theoretical)
      // Find LAST "Saldo Inicial" before today
      const lastSaldo = await prisma.caja_chica.findFirst({
        where: {
          fecha: { lt: startOfDay },
          tipo: "Saldo Inicial",
        },
        orderBy: { fecha: "desc" },
      });

      let calculationStartDate = new Date("1970-01-01T00:00:00Z");
      let baseAmount = 0;

      if (lastSaldo) {
        calculationStartDate = lastSaldo.fecha;
        baseAmount = parseFloat(lastSaldo.monto);
      }

      const movementsObj = await prisma.caja_chica.findMany({
        where: {
          fecha: {
            gt: calculationStartDate,
            lt: startOfDay,
          },
          tipo: { not: "Saldo Inicial" },
        },
      });

      const sumDiff = movementsObj.reduce((acc, curr) => {
        const m = parseFloat(curr.monto);
        if (curr.tipo === "Entrada") return acc + m;
        if (curr.tipo === "Salida") return acc - m;
        return acc;
      }, 0);

      const theoreticalBalance = baseAmount + sumDiff;

      // 2. Check if a record exists for today
      const existingSaldo = await prisma.caja_chica.findFirst({
        where: {
          fecha: {
            gte: startOfDay,
            lt: endOfDay,
          },
          tipo: "Saldo Inicial",
        },
      });

      if (!existingSaldo) {
        // CREATE
        await prisma.caja_chica.create({
          data: {
            fecha: startOfDay,
            descripcion: "Saldo Inicial del Día (Automático)",
            monto: theoreticalBalance,
            tipo: "Saldo Inicial",
            usuarioId: 1,
            estado: "Activo",
          },
        });
      } else {
        // UPDATE if different (Re-Close / Smart Correction)
        const currentMonto = parseFloat(existingSaldo.monto);
        // Use small epsilon for float comparison safety
        if (Math.abs(currentMonto - theoreticalBalance) > 0.01) {
          await prisma.caja_chica.update({
            where: { id: existingSaldo.id },
            data: {
              monto: theoreticalBalance,
              descripcion: "Saldo Inicial del Día (Actualizado)",
            },
          });
        }
      }

      // Proceed with standard filtering
      whereClause = {
        fecha: {
          gte: startOfDay,
          lt: endOfDay,
        },
      };
    }

    const movimientos = await prisma.caja_chica.findMany({
      where: whereClause,
      orderBy: {
        fecha: "desc",
      },
      include: {
        users: {
          select: { userName: true },
        },
      },
    });

    return NextResponse.json(movimientos);
  } catch (error) {
    console.error("Error fetching caja chica movements:", error);
    return NextResponse.json(
      { error: "Error fetching caja chica" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { descripcion, monto, tipo, usuarioId } = data;

    const newMovement = await prisma.caja_chica.create({
      data: {
        descripcion,
        monto,
        tipo,
        usuarioId: usuarioId ? parseInt(usuarioId) : null,
      },
    });

    return NextResponse.json(newMovement);
  } catch (error) {
    console.error("Error creating caja chica movement:", error);
    return NextResponse.json(
      { error: "Error creating movement" },
      { status: 500 }
    );
  }
}
