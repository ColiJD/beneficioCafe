import prisma from "@/lib/prisma";
import { calcularCafeDesdeProducto } from "@/lib/calculoCafe";
import { ErrorNegocio, redondear, moverInventario, TX_ESPERA } from "@/lib/inventarioMov";

// Servicio de secado a clientes. Flujo: Recibido → Seco → Pagado (solo servicio) | Vendido (se le compra café).
// El café del cliente no entra al inventario; solo la parte que se le compra, como una compra directa.
export const PRODUCTO_SECO = "Cafe Seco"; // producto en el que termina todo café secado
export const FORMAS_PAGO = ["Efectivo", "Transferencia", "Cheque"]; // solo el efectivo mueve la caja chica

/**
 * Reparto de un pago entre efectivo, transferencia y cheque. Acepta { pagos: { efectivo, transferencia, cheque } }
 * o, por compatibilidad, { formaPago } (todo el monto con esa forma). La suma debe ser exactamente el monto.
 */
function repartir(body, monto) {
  let { efectivo = 0, transferencia = 0, cheque = 0 } = body?.pagos ?? {};
  if (!body?.pagos && body?.formaPago) {
    if (!FORMAS_PAGO.includes(body.formaPago)) throw new ErrorNegocio("Forma de pago no válida.");
    [efectivo, transferencia, cheque] = [body.formaPago === "Efectivo" ? monto : 0, body.formaPago === "Transferencia" ? monto : 0, body.formaPago === "Cheque" ? monto : 0];
  } else if (!body?.pagos) {
    throw new ErrorNegocio("Indique cómo se paga: efectivo, transferencia o cheque.");
  }
  const [e, t, c] = [efectivo, transferencia, cheque].map((v) => redondear(numero(v, "un monto de pago")));
  if (Math.abs(e + t + c - monto) > 0.005) throw new ErrorNegocio(`Los pagos suman L ${(e + t + c).toFixed(2)} y deben sumar L ${monto.toFixed(2)}.`);
  const usados = [e > 0 && "Efectivo", t > 0 && "Transferencia", c > 0 && "Cheque"].filter(Boolean);
  return { efectivo: e, transferencia: t, cheque: c, formaPago: usados.length > 1 ? "Mixto" : usados[0] ?? "Efectivo" };
}
export const ESTADOS = ["Recibido", "Seco", "Pagado", "Vendido", "Anulado"];

const numero = (v, campo, { opcional = false, positivo = false } = {}) => {
  if (v === undefined || v === null || v === "") {
    if (opcional) return null;
    throw new ErrorNegocio(`Falta ${campo}`);
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || (positivo && n === 0)) throw new ErrorNegocio(`${campo} no es válido`);
  return n;
};

/** Tarifa por quintal oro de la cosecha abierta. */
export async function tarifaVigente(tx = prisma) {
  const c = await tx.cosecha.findFirst({ where: { estado: "Abierta" }, select: { nombre: true, tarifaSecadoQQ: true } });
  if (!c) throw new ErrorNegocio("No hay una cosecha abierta: ábrala para registrar servicios de secado.", 409);
  if (c.tarifaSecadoQQ == null) throw new ErrorNegocio(`La cosecha ${c.nombre} no tiene tarifa de secado. Defínala en Cosechas.`, 409);
  return { cosecha: c.nombre, tarifa: Number(c.tarifaSecadoQQ) };
}

/** Quintales oro de un peso bruto, con la tara, el descuento y el factor oro del producto (igual que en compras). */
async function oroDe(tx, productoID, pesoBruto, sacos) {
  const p = await tx.producto.findUnique({ where: { productID: Number(productoID) } });
  if (!p) throw new ErrorNegocio("Producto no encontrado", 404);
  const data = { tara: Number(p.tara ?? 0), descuento: Number(p.descuento ?? 0), factorOro: Number(p.factorOro ?? 1) };
  return redondear(calcularCafeDesdeProducto(pesoBruto, sacos, { data }, 0).oro);
}

async function buscar(tx, id, estados) {
  const s = await tx.servicio_secado.findUnique({ where: { servicioID: Number(id) } });
  if (!s) throw new ErrorNegocio("Servicio de secado no encontrado", 404);
  if (estados && !estados.includes(s.estado)) throw new ErrorNegocio(`El servicio #${s.servicioID} está ${s.estado}; no se puede hacer esta acción.`, 409);
  return s;
}

// Libera la secadora que este servicio reservó, si no la ocupa un secado interno en proceso.
async function liberarSecadora(tx, s) {
  if (!s.secadoraId || !s.secadoraReservada) return;
  const ocupada = await tx.secado.count({ where: { secadoraId: s.secadoraId, estado: "En Proceso" } });
  if (!ocupada) await tx.secadora.update({ where: { secadoraId: s.secadoraId }, data: { estado: "Disponible" } });
}

/** Recepción del café húmedo. `forzarSecadora`: usar una secadora ocupada sin reservarla (lo decide el usuario). */
export async function recibir(body, usuarioId) {
  const clienteID = numero(body.clienteID, "el cliente", { positivo: true });
  const productoID = numero(body.productoID, "el producto", { positivo: true });
  const pesoBruto = numero(body.pesoBruto, "el peso bruto", { positivo: true });
  const sacos = numero(body.sacos ?? 0, "los sacos");
  const humedad = numero(body.humedadInicial, "la humedad", { opcional: true });
  const secadoraId = numero(body.secadoraId, "la secadora", { opcional: true });

  return prisma.$transaction(async (tx) => {
    if (!(await tx.cliente.findUnique({ where: { clienteID }, select: { clienteID: true } }))) throw new ErrorNegocio("Cliente no encontrado", 404);
    const { tarifa } = await tarifaVigente(tx);
    const oro = await oroDe(tx, productoID, pesoBruto, sacos);
    if (!(oro > 0)) throw new ErrorNegocio("El peso no alcanza un quintal oro después de destarar: revise peso y sacos.");

    let reservada = false;
    if (secadoraId) {
      const r = await tx.secadora.updateMany({ where: { secadoraId, estado: "Disponible" }, data: { estado: "En Uso" } });
      reservada = r.count === 1;
      if (!reservada) {
        const s = await tx.secadora.findUnique({ where: { secadoraId } });
        if (!s) throw new ErrorNegocio("Secadora no encontrada", 404);
        if (!body.forzarSecadora) throw Object.assign(new ErrorNegocio(`La secadora ${s.nombre} está ${s.estado}.`, 409), { secadoraOcupada: true });
      }
    }

    return tx.servicio_secado.create({
      data: {
        clienteID, productoID, pesoBrutoEntrada: pesoBruto, sacosEntrada: sacos, humedadInicial: humedad,
        oroEntrada: oro, tarifaQQ: tarifa, cobro: redondear(oro * tarifa),
        secadoraId, secadoraReservada: reservada, observaciones: body.observaciones?.slice(0, 255) || null, usuarioId,
      },
    });
  }, TX_ESPERA);
}

/** Asignar o cambiar la secadora de un servicio recibido (si al recibir no se eligió o no había disponible). */
export async function asignarSecadora(id, body) {
  const secadoraId = numero(body.secadoraId, "la secadora", { positivo: true });
  return prisma.$transaction(async (tx) => {
    const s = await buscar(tx, id, ["Recibido"]);
    if (s.secadoraId === secadoraId) return s;
    const r = await tx.secadora.updateMany({ where: { secadoraId, estado: "Disponible" }, data: { estado: "En Uso" } });
    const reservada = r.count === 1;
    if (!reservada) {
      const sec = await tx.secadora.findUnique({ where: { secadoraId } });
      if (!sec) throw new ErrorNegocio("Secadora no encontrada", 404);
      if (!body.forzarSecadora) throw Object.assign(new ErrorNegocio(`La secadora ${sec.nombre} está ${sec.estado}.`, 409), { secadoraOcupada: true });
    }
    await liberarSecadora(tx, s); // la anterior, si este servicio la había reservado
    return tx.servicio_secado.update({ where: { servicioID: s.servicioID }, data: { secadoraId, secadoraReservada: reservada } });
  }, TX_ESPERA);
}

/** Fin del secado: se vuelve a pesar, se destara y se calcula en quintales oro con el producto seco. */
export async function terminar(id, body) {
  const pesoBruto = numero(body.pesoBruto, "el peso bruto", { positivo: true });
  const sacos = numero(body.sacos ?? 0, "los sacos");
  const humedad = numero(body.humedadFinal, "la humedad", { opcional: true });
  return prisma.$transaction(async (tx) => {
    const s = await buscar(tx, id, ["Recibido"]);
    // Sin importar qué café entró, al secarse termina como Café Seco.
    const seco = await tx.producto.findFirst({ where: { productName: PRODUCTO_SECO }, select: { productID: true } });
    if (!seco) throw new ErrorNegocio(`No existe el producto "${PRODUCTO_SECO}": créelo en Productos.`, 409);
    const productoSecoID = seco.productID;
    const oro = await oroDe(tx, productoSecoID, pesoBruto, sacos);
    await liberarSecadora(tx, s);
    return tx.servicio_secado.update({
      where: { servicioID: s.servicioID },
      data: { productoSecoID, pesoBrutoSalida: pesoBruto, sacosSalida: sacos, humedadFinal: humedad, oroSalida: oro, fechaFin: new Date(), estado: "Seco" },
    });
  }, TX_ESPERA);
}

/** Solo el servicio: el cliente paga el cobro. Solo si paga en efectivo entra a la caja chica; el usuario decide la forma de pago. */
export async function cobrar(id, body, usuarioId) {
  return prisma.$transaction(async (tx) => {
    const s = await buscar(tx, id, ["Seco"]);
    const pago = repartir(body, Number(s.cobro));
    const datos = { estado: "Pagado", formaPago: pago.formaPago, pagoEfectivo: pago.efectivo, pagoTransferencia: pago.transferencia, pagoCheque: pago.cheque };
    if (pago.efectivo > 0) datos.cajaChicaId = (await movimientoCaja(tx, s, "Entrada", pago.efectivo, "Servicio de secado", usuarioId)).id;
    return tx.servicio_secado.update({ where: { servicioID: s.servicioID }, data: datos });
  }, TX_ESPERA);
}

// Movimiento de caja chica por la parte en efectivo (Entrada: cobro del servicio; Salida: pago al cliente por su café)
async function movimientoCaja(tx, s, tipo, monto, concepto, usuarioId) {
  const cli = await tx.cliente.findUnique({ where: { clienteID: s.clienteID }, select: { clienteNombre: true, clienteApellido: true } });
  return tx.caja_chica.create({
    data: { descripcion: `${concepto} #${s.servicioID} - ${[cli?.clienteNombre, cli?.clienteApellido].filter(Boolean).join(" ")}`.slice(0, 255), monto, tipo, usuarioId },
  });
}

/**
 * El cliente vende café seco: se le compran `qq` quintales oro (hasta lo que salió del secado) al precio del momento.
 * Es una compra directa normal (entra al inventario) y al pago se le descuenta el cobro del secado.
 */
export async function vender(id, body, usuarioId) {
  const qq = redondear(numero(body.qq, "la cantidad a comprar", { positivo: true }));
  const precio = numero(body.precioQQ, "el precio por quintal", { positivo: true });
  return prisma.$transaction(async (tx) => {
    const s = await buscar(tx, id, ["Seco"]);
    const disponible = Number(s.oroSalida);
    if (qq > disponible) throw new ErrorNegocio(`Solo hay ${disponible.toFixed(2)} QQ oro secos; no se pueden comprar ${qq.toFixed(2)}.`);
    const total = redondear(qq * precio);
    const cobro = Number(s.cobro);
    if (total < cobro) throw new ErrorNegocio(`La compra (L ${total.toFixed(2)}) no cubre el cobro del secado (L ${cobro.toFixed(2)}). Compre más quintales o cobre el servicio.`);
    const neto = redondear(total - cobro);
    const pago = repartir(body, neto); // cómo se le paga al cliente el neto (compra menos secado)
    const sacos = redondear(Number(s.sacosSalida ?? 0) * (qq / disponible));
    const hoy = new Date();

    // shortcut: replica la creación de compra de /api/compras (POST) para hacerla en la misma transacción;
    //           si esa ruta cambia, revisar aquí también.
    const compra = await tx.compra.create({
      data: {
        clienteID: s.clienteID, compraFecha: new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())),
        compraTipoDocumento: "Servicio de secado", compraMovimiento: "Entrada", compraTipoCafe: s.productoSecoID,
        compraPrecioQQ: precio, compraCantidadQQ: qq, compraTotal: total, compraTotalSacos: sacos,
        compraRetencio: redondear(qq * 0.96), compraEn: "Servicio de secado",
        compraDescripcion: `Servicio de secado #${s.servicioID}: se descuentan L ${cobro.toFixed(2)} por el secado`,
      },
    });
    const inv = await moverInventario(tx, s.productoSecoID, qq, sacos);
    await tx.movimientoinventario.create({
      data: {
        inventarioClienteID: inv.inventarioClienteID, tipoMovimiento: "Entrada",
        referenciaTipo: `Compra directa #${compra.compraId}`, referenciaID: compra.compraId,
        cantidadQQ: qq, cantidadSacos: sacos, nota: `Compra de café secado en servicio #${s.servicioID}`,
      },
    });
    const datos = { estado: "Vendido", compraId: compra.compraId, qqVendidos: qq, formaPago: pago.formaPago, pagoEfectivo: pago.efectivo, pagoTransferencia: pago.transferencia, pagoCheque: pago.cheque };
    if (pago.efectivo > 0) datos.cajaChicaId = (await movimientoCaja(tx, s, "Salida", pago.efectivo, "Pago de café con servicio de secado", usuarioId)).id;
    const servicio = await tx.servicio_secado.update({ where: { servicioID: s.servicioID }, data: datos });
    return { servicio, compra, neto };
  }, TX_ESPERA);
}

/** Anular: solo antes de que haya dinero de por medio (Recibido o Seco). */
export async function anular(id) {
  return prisma.$transaction(async (tx) => {
    const s = await buscar(tx, id, ["Recibido", "Seco"]);
    await liberarSecadora(tx, s);
    return tx.servicio_secado.update({ where: { servicioID: s.servicioID }, data: { estado: "Anulado" } });
  }, TX_ESPERA);
}

/** Lista con nombres de cliente, productos y secadora. */
export async function listar({ estado, desde, hasta, clienteID, q } = {}) {
  const fecha = (v) => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? d : undefined; };
  const texto = q?.trim();
  const where = {
    fecha: { gte: fecha(desde), lte: fecha(hasta) },
    ...(estado && { estado: { in: String(estado).split(",") } }),
    ...(Number(clienteID) && { clienteID: Number(clienteID) }),
  };
  if (texto) {
    // Número de servicio o parte del nombre del cliente
    const clientes = await prisma.cliente.findMany({
      where: { OR: [{ clienteNombre: { contains: texto } }, { clienteApellido: { contains: texto } }] }, select: { clienteID: true },
    });
    where.OR = [...(/^[0-9]+$/.test(texto) ? [{ servicioID: Number(texto) }] : []), { clienteID: { in: clientes.map((c) => c.clienteID) } }];
  }
  const filas = await prisma.servicio_secado.findMany({ where, orderBy: { servicioID: "desc" }, take: 500 });
  const ids = (k) => [...new Set(filas.map((f) => f[k]).filter(Boolean))];
  const [clientes, productos, secadoras] = await Promise.all([
    prisma.cliente.findMany({ where: { clienteID: { in: ids("clienteID") } }, select: { clienteID: true, clienteNombre: true, clienteApellido: true } }),
    prisma.producto.findMany({ where: { productID: { in: [...ids("productoID"), ...ids("productoSecoID")] } }, select: { productID: true, productName: true } }),
    prisma.secadora.findMany({ where: { secadoraId: { in: ids("secadoraId") } }, select: { secadoraId: true, nombre: true } }),
  ]);
  const cli = Object.fromEntries(clientes.map((c) => [c.clienteID, [c.clienteNombre, c.clienteApellido].filter(Boolean).join(" ")]));
  const prod = Object.fromEntries(productos.map((p) => [p.productID, p.productName]));
  const sec = Object.fromEntries(secadoras.map((s) => [s.secadoraId, s.nombre]));
  const compras = await prisma.compra.findMany({ where: { compraId: { in: ids("compraId") } }, select: { compraId: true, compraCantidadQQ: true, compraPrecioQQ: true, compraTotal: true } });
  const comp = Object.fromEntries(compras.map((c) => [c.compraId, c]));
  return filas.map((f) => ({ ...f, compra: comp[f.compraId] ?? null, cliente: cli[f.clienteID] ?? `#${f.clienteID}`, producto: prod[f.productoID], productoSeco: prod[f.productoSecoID], secadora: sec[f.secadoraId] ?? null }));
}
