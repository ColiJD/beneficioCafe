import prisma from "@/lib/prisma";
import { checkRole } from "@/lib/checkRole";
import { NextResponse } from "next/server";

export async function POST(request) {
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const body = await request.json();
    const {
      clienteID,
      tipoCafe,
      cantidadQQ,
      precioQQ,
      tipoDocumento,
      descripcion,
      liqEn,
    } = body;

    // 1️⃣ Obtener saldo pendiente del cliente para el tipo de café para validación inicial
    const saldoResult = await prisma.$queryRaw`
      SELECT SUM(saldoPendienteQQ) AS saldoPendiente
      FROM vw_SaldoDepositos
      WHERE clienteID = ${Number(clienteID)} AND depositoTipoCafe = ${Number(
        tipoCafe,
      )};
    `;

    const saldoDisponible = Number(saldoResult[0]?.saldoPendiente || 0);

    // Si no se envía cantidad, solo devolvemos el saldo
    if (!cantidadQQ) {
      return new Response(JSON.stringify({ saldoDisponible }), { status: 200 });
    }

    // 2️⃣ Validar cantidad
    if (Number(cantidadQQ) > saldoDisponible) {
      return NextResponse.json(
        {
          error: "Cantidad supera saldo pendiente del cliente",
        },
        { status: 400 },
      );
    }

    // 3️⃣ Realizar la liquidación en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // a. Crear cabecera de liquidación
      const newLiq = await tx.liqdeposito.create({
        data: {
          liqclienteID: Number(clienteID),
          liqFecha: new Date(),
          liqTipoDocumento: tipoDocumento,
          liqMovimiento: "Entrada",
          liqTipoCafe: Number(tipoCafe),
          liqPrecio: Number(precioQQ),
          liqCatidadQQ: 0,
          liqTotalLps: 0,
          liqEn: liqEn,
          liqDescripcion: descripcion,
        },
      });

      const v_liqID = newLiq.liqID;

      // b. Obtener depósitos pendientes con sus detalles para calcular disponible
      // Usamos una consulta cruda para replicar la lógica del procedimiento almacenado con precisión
      const depositos = await tx.$queryRaw`
        SELECT d.depositoID,
               d.depositoCantidadQQ - IFNULL(SUM(
                    CASE 
                        WHEN dl.movimiento IS NULL OR dl.movimiento <> 'Anulado'
                        THEN dl.cantidadQQ
                        ELSE 0
                    END
               ),0) AS disponible
        FROM deposito d
        LEFT JOIN detalleliqdeposito dl 
               ON d.depositoID = dl.depositoID
        WHERE d.clienteID = ${Number(clienteID)}
          AND d.depositoTipoCafe = ${Number(tipoCafe)}
          AND d.depositoMovimiento <> 'Anulado'
        GROUP BY d.depositoID, d.depositoCantidadQQ
        HAVING disponible > 0
        ORDER BY d.depositoFecha ASC;
      `;

      if (depositos.length === 0) {
        throw new Error(
          "No hay depósitos pendientes para este cliente y tipo de café",
        );
      }

      let v_restante = Number(cantidadQQ);
      let v_totalUsado = 0;

      for (const dep of depositos) {
        if (v_restante <= 0) break;

        const v_disponible = Number(dep.disponible);
        const v_aUsar = Math.min(v_restante, v_disponible);

        // Insertar detalle de liquidación
        await tx.detalleliqdeposito.create({
          data: {
            liqID: v_liqID,
            depositoID: dep.depositoID,
            cantidadQQ: v_aUsar,
            precio: Number(precioQQ),
            totalLps: v_aUsar * Number(precioQQ),
            movimiento: "Entrada",
          },
        });

        // Actualizar estado del depósito
        const nuevoEstado =
          v_aUsar === v_disponible ? "Liquidado" : "Pendiente";
        await tx.deposito.update({
          where: { depositoID: dep.depositoID },
          data: { estado: nuevoEstado },
        });

        v_totalUsado += v_aUsar;
        v_restante -= v_aUsar;
      }

      if (v_totalUsado === 0) {
        throw new Error("No se pudo liquidar: saldo insuficiente");
      }

      // c. Ajustar cabecera de liquidación con los totales finales
      await tx.liqdeposito.update({
        where: { liqID: v_liqID },
        data: {
          liqCatidadQQ: v_totalUsado,
          liqTotalLps: v_totalUsado * Number(precioQQ),
        },
      });

      return { liqID: v_liqID, v_totalUsado };
    });

    // 4️⃣ Retornar información
    return NextResponse.json(
      {
        message: "Liquidación realizada correctamente",
        saldoAntes: saldoDisponible,
        cantidadLiquidada: result.v_totalUsado,
        saldoDespues: saldoDisponible - result.v_totalUsado,
        liqID: result.liqID,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error al liquidar depósito:", error);

    let msg = "Error interno";
    let status = 500;

    if (
      error.message ===
        "No hay depósitos pendientes para este cliente y tipo de café" ||
      error.message === "No se pudo liquidar: saldo insuficiente"
    ) {
      msg = error.message;
      status = 400;
    } else if (error?.message) {
      msg = error.message;
    }

    return NextResponse.json({ error: msg }, { status });
  }
}

// export async function GET(request) {
//   try {
//     const { searchParams } = new URL(request.url);
//     const clienteID = searchParams.get("clienteID");
//     const tipoCafe = searchParams.get("tipoCafe");

//     if (!clienteID || !tipoCafe) {
//       return new Response(
//         JSON.stringify({ error: "Debe enviar clienteID y tipoCafe" }),
//         { status: 400 }
//       );
//     }

//     // Consultar saldo pendiente
//     const saldoResult = await prisma.$queryRaw`
//       SELECT SUM(saldoPendienteQQ) AS saldoPendiente
//       FROM vw_SaldoDepositos
//       WHERE clienteID = ${clienteID} AND depositoTipoCafe = ${tipoCafe};
//     `;

//     const saldoDisponible = saldoResult[0]?.saldoPendiente || 0;

//     return new Response(
//       JSON.stringify({ saldoDisponible }),
//       { status: 200 }
//     );

//   } catch (error) {
//     console.error("Error al obtener saldo pendiente:", error);
//     return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
//   }
// }

export async function GET(request) {
  const sessionOrResponse = await checkRole(request, [
    "ADMIN",
    "GERENCIA",
    "OPERARIOS",
    "AUDITORES",
  ]);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  try {
    const { searchParams } = new URL(request.url);
    const clienteID = searchParams.get("clienteID");
    const tipoCafe = searchParams.get("tipoCafe");

    if (!clienteID) {
      return NextResponse.json(
        { error: "Debe enviar clienteID" },
        {
          status: 400,
        },
      );
    }

    // Caso 1: cliente + café específico -> saldo puntual
    if (tipoCafe) {
      const saldoResult = await prisma.$queryRaw`
        SELECT SUM(saldoPendienteQQ) AS saldoPendiente
        FROM vw_SaldoDepositos
        WHERE clienteID = ${clienteID} AND depositoTipoCafe = ${tipoCafe};
      `;

      const saldoDisponible = saldoResult[0]?.saldoPendiente || 0;

      return NextResponse.json(
        { saldoDisponible },
        {
          status: 200,
        },
      );
    }

    // Caso 2: solo cliente -> devolver lista de cafés con saldo > 0
    const productosResult = await prisma.$queryRaw`
      SELECT depositoTipoCafe AS tipoCafe, SUM(saldoPendienteQQ) AS saldoPendiente
      FROM vw_SaldoDepositos
      WHERE clienteID = ${clienteID}
      GROUP BY depositoTipoCafe
      HAVING SUM(saldoPendienteQQ) > 0;
    `;

    return NextResponse.json(productosResult, { status: 200 });
  } catch (error) {
    console.error("Error al obtener saldo pendiente:", error);
    return NextResponse.json(
      { error: "Error interno" },
      {
        status: 500,
      },
    );
  }
}
