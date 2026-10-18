'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { calcularCarrito } from '@/lib/promocion';
import { todayLocal, monthStartLocal } from '@/lib/utils';
import { tienePermiso } from '@/lib/permisos';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { Venta, Producto, Abono } from '@/types';
import { randomBytes } from 'crypto';

// FIX: usa crypto.randomBytes en vez de Math.random para evitar colisiones de folio
function generarFolio(): string {
  // Usar zona local (México) para que el folio refleje el día correcto del vendedor
  const date = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
    .replace(/-/g, '');
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `VTA-${date}-${rand}`;
}

export async function procesarVenta(input: {
  lineas: { producto: Producto; cantidad: number }[];
  metodo_pago?: 'efectivo' | 'transferencia' | 'tarjeta';
  tipo_venta?: 'contado' | 'credito';
  cliente_id?: number | null;
  sesion_caja_id: number;
  productosConDescuento?: number[];
  descuentoGlobalPorcentaje?: number | null;
  abonoInicial?: { monto: number; metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta' } | null;
}) {
  const session = await getSession();
  if (!session) return { error: 'Sin sesión.' };

  const tipoVenta = input.tipo_venta ?? 'contado';
  if (tipoVenta === 'credito' && !input.cliente_id) {
    return { error: 'Una venta a crédito requiere seleccionar un cliente.' };
  }
  if (tipoVenta === 'contado' && !input.metodo_pago) {
    return { error: 'Selecciona un método de pago.' };
  }
  const pctGlobal = input.descuentoGlobalPorcentaje;
  if (pctGlobal != null && (!Number.isInteger(pctGlobal) || pctGlobal < 1 || pctGlobal > 100)) {
    return { error: 'El descuento adicional debe ser un número entero entre 1 y 100.' };
  }

  const { items, total, descuento_global_porcentaje, descuento_global_monto } = calcularCarrito(
    input.lineas,
    input.productosConDescuento ?? [],
    input.descuentoGlobalPorcentaje ?? null,
  );
  if (items.length === 0) return { error: 'El carrito está vacío.' };

  if (input.abonoInicial && input.abonoInicial.monto > total) {
    return { error: 'El abono inicial no puede ser mayor al total de la venta.' };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // FIX: validar que la sesión de caja pertenece al usuario que hace la venta
    const [cajaRows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM sesiones_caja WHERE id = ? AND usuario_id = ? AND estado = 'abierta'`,
      [input.sesion_caja_id, session.sub]
    );
    if (!cajaRows[0]) {
      await conn.rollback();
      return { error: 'Sesión de caja inválida.' };
    }

    // Validar stock con FOR UPDATE sobre la fila del producto para evitar race conditions
    for (const item of items) {
      const [sRows] = await conn.query<RowDataPacket[]>(
        `SELECT stock FROM productos WHERE id = ? FOR UPDATE`,
        [item.producto.id]
      );
      const stock = Number(sRows[0]?.stock ?? 0);
      if (stock < item.cantidad) {
        await conn.rollback();
        return { error: `Stock insuficiente para "${item.producto.nombre}". Disponible: ${stock}` };
      }
    }

    const folio = generarFolio();
    const metodoPago = tipoVenta === 'credito' ? null : (input.metodo_pago ?? null);

    // Insertar venta
    const [ventaResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO ventas (folio, cliente_id, usuario_id, sesion_caja_id, tipo_venta, total, descuento_porcentaje, descuento_monto, metodo_pago)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        folio, input.cliente_id ?? null, session.sub, input.sesion_caja_id, tipoVenta,
        total, descuento_global_porcentaje, descuento_global_monto, metodoPago,
      ]
    );
    const ventaId = ventaResult.insertId;

    // Insertar detalles y movimientos de inventario
    for (const item of items) {
      await conn.query(
        `INSERT INTO detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, descuento_aplicado, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ventaId, item.producto.id, item.cantidad, item.precio_unitario, item.descuento_aplicado, item.subtotal]
      );
      await conn.query(
        `INSERT INTO movimientos_inventario (producto_id, tipo, motivo, cantidad, usuario_id, referencia)
         VALUES (?, 'salida', 'venta', ?, ?, ?)`,
        [item.producto.id, item.cantidad, session.sub, folio]
      );
      await conn.query(
        `UPDATE productos SET stock = stock - ? WHERE id = ?`,
        [item.cantidad, item.producto.id]
      );
    }

    // Actualizar saldo esperado en sesión de caja (solo contado en efectivo:
    // una venta a crédito no mete a caja el total, solo lo que realmente se
    // cobre vía abonos).
    if (tipoVenta === 'contado' && metodoPago === 'efectivo') {
      await conn.query(
        `UPDATE sesiones_caja
         SET saldo_final_esperado = saldo_final_esperado + ?
         WHERE id = ?`,
        [total, input.sesion_caja_id]
      );
    }

    // Abono inicial opcional en una venta a crédito (no hay enganche mínimo,
    // pero el vendedor puede cobrar algo al momento de la venta).
    if (tipoVenta === 'credito' && input.abonoInicial && input.abonoInicial.monto > 0) {
      await conn.query(
        `INSERT INTO abonos (venta_id, monto, metodo_pago, usuario_id, sesion_caja_id)
         VALUES (?, ?, ?, ?, ?)`,
        [ventaId, input.abonoInicial.monto, input.abonoInicial.metodo_pago, session.sub, input.sesion_caja_id]
      );
      if (input.abonoInicial.metodo_pago === 'efectivo') {
        await conn.query(
          `UPDATE sesiones_caja SET saldo_final_esperado = saldo_final_esperado + ? WHERE id = ?`,
          [input.abonoInicial.monto, input.sesion_caja_id]
        );
      }
    }

    await conn.commit();
    revalidatePath('/ventas');
    revalidatePath('/dashboard');
    return { success: true, ventaId, folio };
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return { error: 'Error al procesar la venta.' };
  } finally {
    conn.release();
  }
}

export async function registrarAbono(input: {
  venta_id: number;
  monto: number;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta';
  sesion_caja_id: number;
}) {
  const session = await getSession();
  if (!session) return { error: 'Sin sesión.' };
  if (!tienePermiso(session, 'ventas', 'crear')) return { error: 'Sin permiso para registrar abonos.' };
  if (input.monto <= 0) return { error: 'El monto debe ser mayor a 0.' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [cajaRows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM sesiones_caja WHERE id = ? AND usuario_id = ? AND estado = 'abierta'`,
      [input.sesion_caja_id, session.sub]
    );
    if (!cajaRows[0]) {
      await conn.rollback();
      return { error: 'Sesión de caja inválida.' };
    }

    // Bloquea la fila de la venta para serializar abonos concurrentes sobre
    // la misma venta (evita que dos abonos simultáneos rebasen el saldo).
    const [ventaRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, tipo_venta, total FROM ventas WHERE id = ? FOR UPDATE`,
      [input.venta_id]
    );
    const venta = ventaRows[0];
    if (!venta || venta.tipo_venta !== 'credito') {
      await conn.rollback();
      return { error: 'La venta no existe o no es a crédito.' };
    }

    const [abonadoRows] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(monto), 0) AS abonado FROM abonos WHERE venta_id = ?`,
      [input.venta_id]
    );
    const saldoPendiente = Number(venta.total) - Number(abonadoRows[0]?.abonado ?? 0);
    if (input.monto > saldoPendiente) {
      await conn.rollback();
      return { error: `El abono no puede exceder el saldo pendiente ($${saldoPendiente.toFixed(2)}).` };
    }

    await conn.query(
      `INSERT INTO abonos (venta_id, monto, metodo_pago, usuario_id, sesion_caja_id)
       VALUES (?, ?, ?, ?, ?)`,
      [input.venta_id, input.monto, input.metodo_pago, session.sub, input.sesion_caja_id]
    );

    if (input.metodo_pago === 'efectivo') {
      await conn.query(
        `UPDATE sesiones_caja SET saldo_final_esperado = saldo_final_esperado + ? WHERE id = ?`,
        [input.monto, input.sesion_caja_id]
      );
    }

    await conn.commit();
    revalidatePath('/ventas');
    revalidatePath(`/ventas/${input.venta_id}`);
    revalidatePath('/dashboard');
    revalidatePath('/caja');
    revalidatePath('/cuentas-por-cobrar');
    return { success: true, saldo_pendiente: parseFloat((saldoPendiente - input.monto).toFixed(2)) };
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return { error: 'Error al registrar el abono.' };
  } finally {
    conn.release();
  }
}

export async function getVentas(filtro?: { desde?: string; hasta?: string }): Promise<Venta[]> {
  const session = await getSession();
  if (!tienePermiso(session, 'ventas', 'ver')) return [];

  // FIX: sin interpolación — condiciones como parámetros, estructura fija
  const conditions: string[] = [];
  const params: string[] = [];

  if (filtro?.desde) { conditions.push('DATE(v.creado_at) >= ?'); params.push(filtro.desde); }
  if (filtro?.hasta) { conditions.push('DATE(v.creado_at) <= ?'); params.push(filtro.hasta); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT v.*, c.nombre AS cliente_nombre, u.nombre AS usuario_nombre,
           v.total - COALESCE((SELECT SUM(a.monto) FROM abonos a WHERE a.venta_id = v.id), 0) AS saldo_pendiente
    FROM ventas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    JOIN usuarios u ON u.id = v.usuario_id
    ${where}
    ORDER BY v.creado_at DESC
    LIMIT 500
  `, params);
  return rows as Venta[];
}

export async function getVentaDetalle(ventaId: number): Promise<Venta | null> {
  const [ventaRows] = await pool.query<RowDataPacket[]>(`
    SELECT v.*, c.nombre AS cliente_nombre, u.nombre AS usuario_nombre,
           COALESCE((SELECT SUM(a.monto) FROM abonos a WHERE a.venta_id = v.id), 0) AS abonado
    FROM ventas v
    LEFT JOIN clientes c  ON c.id  = v.cliente_id
    LEFT JOIN usuarios u  ON u.id  = v.usuario_id
    WHERE v.id = ?
  `, [ventaId]);

  if (!ventaRows[0]) return null;
  const row = ventaRows[0];
  const venta = row as Venta;
  venta.saldo_pendiente = parseFloat((Number(row.total) - Number(row.abonado)).toFixed(2));

  const [detallesRows] = await pool.query<RowDataPacket[]>(`
    SELECT dv.*,
           COALESCE(p.nombre, '[Producto eliminado]') AS producto_nombre,
           COALESCE(p.sku, '—')                       AS producto_sku
    FROM detalles_ventas dv
    LEFT JOIN productos p ON p.id = dv.producto_id
    WHERE dv.venta_id = ?
  `, [ventaId]);
  venta.detalles = detallesRows as Venta['detalles'];

  if (venta.tipo_venta === 'credito') {
    const [abonosRows] = await pool.query<RowDataPacket[]>(`
      SELECT a.*, u.nombre AS usuario_nombre
      FROM abonos a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.venta_id = ?
      ORDER BY a.creado_at ASC
    `, [ventaId]);
    venta.abonos = abonosRows as Abono[];
  }

  return venta;
}

export async function getDashboardStats() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return null;

  // FIX: CURDATE() se evalúa en la zona horaria del servidor de MySQL (UTC en
  // Hostinger), que ya lleva ~6h de adelanto sobre America/Mexico_City. Cada
  // tarde, entre las 18:00 y medianoche hora de México, CURDATE() ya marcaba el
  // día siguiente y estas consultas dejaban de contar las ventas del día en
  // curso. Se compara contra el día calculado en la zona horaria de la app, y
  // `creado_at` (guardado en UTC) se recorre -6h antes de extraer la fecha para
  // que coincida con el día calendario en México.
  const hoy        = todayLocal();
  const inicioMes  = monthStartLocal();

  // "Ingresos" = dinero realmente cobrado: una venta de contado cuenta
  // completa el día en que se hace; una venta a crédito solo cuenta lo que
  // se ha abonado (en la fecha del abono, no en la de la venta original).
  const [ventasHoy] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total_ventas,
            COALESCE(SUM(CASE WHEN tipo_venta = 'contado' THEN total ELSE 0 END), 0) AS ingresos_contado
     FROM ventas WHERE DATE(creado_at - INTERVAL 6 HOUR) = ?`,
    [hoy]
  );
  const [abonosHoy] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(monto), 0) AS monto FROM abonos WHERE DATE(creado_at - INTERVAL 6 HOUR) = ?`,
    [hoy]
  );
  const [ventasMes] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total_ventas,
            COALESCE(SUM(CASE WHEN tipo_venta = 'contado' THEN total ELSE 0 END), 0) AS ingresos_contado
     FROM ventas WHERE DATE(creado_at - INTERVAL 6 HOUR) >= ?`,
    [inicioMes]
  );
  const [abonosMes] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(monto), 0) AS monto FROM abonos WHERE DATE(creado_at - INTERVAL 6 HOUR) >= ?`,
    [inicioMes]
  );
  const [totalStock] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(stock), 0) AS stock_total FROM productos`
  );

  return {
    hoy: {
      total_ventas: Number(ventasHoy[0]?.total_ventas ?? 0),
      ingresos:     Number(ventasHoy[0]?.ingresos_contado ?? 0) + Number(abonosHoy[0]?.monto ?? 0),
    },
    mes: {
      total_ventas: Number(ventasMes[0]?.total_ventas ?? 0),
      ingresos:     Number(ventasMes[0]?.ingresos_contado ?? 0) + Number(abonosMes[0]?.monto ?? 0),
    },
    stock_total: Number(totalStock[0]?.stock_total ?? 0),
  };
}

// ─── Dashboard por rango ──────────────────────────────────────────────────────
export interface DashboardRangeData {
  ventas_por_dia: { fecha: string; ventas: number; ingresos: number }[];
  total_ventas: number;
  total_ingresos: number;
  ticket_promedio: number;
  productos_vendidos: number;
}

export async function getDashboardByRange(
  desde: string,
  hasta: string,
): Promise<DashboardRangeData | null> {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return null;
  // Validar que sean fechas YYYY-MM-DD válidas para evitar inyección
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(desde) || !dateRegex.test(hasta)) return null;

  // FIX: creado_at se guarda en UTC; se recorre -6h antes de extraer la fecha
  // para comparar contra el día calendario de America/Mexico_City (ver nota en
  // getDashboardStats).
  //
  // "Ingresos" = dinero realmente cobrado, no valor vendido: una venta de
  // contado cuenta completa el día en que se hizo; una venta a crédito solo
  // cuenta lo que se ha abonado, en la fecha de cada abono (que puede caer
  // en un día distinto al de la venta original) — por eso se combinan dos
  // consultas por fecha en vez de una sola sobre `ventas`.
  const [ventasPorDiaContado] = await pool.query<RowDataPacket[]>(
    `SELECT
       DATE_FORMAT(DATE(creado_at - INTERVAL 6 HOUR), '%Y-%m-%d') AS fecha,
       COUNT(*)                                                                    AS ventas,
       COALESCE(SUM(CASE WHEN tipo_venta = 'contado' THEN total ELSE 0 END), 0)    AS ingresos
     FROM ventas
     WHERE DATE(creado_at - INTERVAL 6 HOUR) BETWEEN ? AND ?
     GROUP BY fecha`,
    [desde, hasta]
  );
  const [abonosPorDia] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(DATE(creado_at - INTERVAL 6 HOUR), '%Y-%m-%d') AS fecha,
            COALESCE(SUM(monto), 0) AS monto
     FROM abonos
     WHERE DATE(creado_at - INTERVAL 6 HOUR) BETWEEN ? AND ?
     GROUP BY fecha`,
    [desde, hasta]
  );

  // Un día puede tener abonos sin ninguna venta nueva ese día — se combinan
  // por fecha en vez de asumir que ambas consultas cubren los mismos días.
  const porDia = new Map<string, { fecha: string; ventas: number; ingresos: number }>();
  for (const row of ventasPorDiaContado) {
    porDia.set(row.fecha, { fecha: row.fecha, ventas: Number(row.ventas), ingresos: Number(row.ingresos) });
  }
  for (const row of abonosPorDia) {
    const existente = porDia.get(row.fecha);
    if (existente) existente.ingresos += Number(row.monto);
    else porDia.set(row.fecha, { fecha: row.fecha, ventas: 0, ingresos: Number(row.monto) });
  }
  const ventasPorDia = Array.from(porDia.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const [resumen] = await pool.query<RowDataPacket[]>(
    `SELECT
       COUNT(*)                                        AS total_ventas,
       COALESCE(AVG(total), 0)                         AS ticket_promedio,
       COALESCE(SUM(dv.cantidad_total), 0)             AS productos_vendidos
     FROM ventas v
     LEFT JOIN (
       SELECT venta_id, SUM(cantidad) AS cantidad_total
       FROM detalles_ventas GROUP BY venta_id
     ) dv ON dv.venta_id = v.id
     WHERE DATE(v.creado_at - INTERVAL 6 HOUR) BETWEEN ? AND ?`,
    [desde, hasta]
  );

  const r = resumen[0] ?? {};
  return {
    ventas_por_dia:     ventasPorDia,
    total_ventas:       Number(r.total_ventas ?? 0),
    total_ingresos:     parseFloat(ventasPorDia.reduce((s, d) => s + d.ingresos, 0).toFixed(2)),
    ticket_promedio:    Number(r.ticket_promedio ?? 0),
    productos_vendidos: Number(r.productos_vendidos ?? 0),
  };
}

// ─── Cuentas por cobrar ───────────────────────────────────────────────────────
export interface CuentaPorCobrar {
  venta_id: number;
  folio: string;
  cliente_id: number;
  cliente_nombre: string;
  usuario_nombre: string;
  total: number;
  abonado: number;
  saldo_pendiente: number;
  creado_at: string;
}

export async function getCuentasPorCobrar(): Promise<CuentaPorCobrar[]> {
  const session = await getSession();
  if (!tienePermiso(session, 'ventas', 'ver')) return [];

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      v.id AS venta_id, v.folio, v.cliente_id, c.nombre AS cliente_nombre,
      u.nombre AS usuario_nombre, v.total, v.creado_at,
      COALESCE(SUM(a.monto), 0)              AS abonado,
      v.total - COALESCE(SUM(a.monto), 0)    AS saldo_pendiente
    FROM ventas v
    JOIN clientes c      ON c.id = v.cliente_id
    JOIN usuarios u      ON u.id = v.usuario_id
    LEFT JOIN abonos a   ON a.venta_id = v.id
    WHERE v.tipo_venta = 'credito'
    GROUP BY v.id
    HAVING saldo_pendiente > 0
    ORDER BY v.creado_at ASC
  `);
  return rows as CuentaPorCobrar[];
}
