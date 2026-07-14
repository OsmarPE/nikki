'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { calcularCarrito } from '@/lib/promocion';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { Venta, Producto } from '@/types';
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
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta';
  cliente_id?: number | null;
  sesion_caja_id: number;
}) {
  const session = await getSession();
  if (!session) return { error: 'Sin sesión.' };

  const { items, total } = calcularCarrito(input.lineas);
  if (items.length === 0) return { error: 'El carrito está vacío.' };

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

    // Insertar venta
    const [ventaResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO ventas (folio, cliente_id, usuario_id, sesion_caja_id, total, metodo_pago)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [folio, input.cliente_id ?? null, session.sub, input.sesion_caja_id, total, input.metodo_pago]
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

    // Actualizar saldo esperado en sesión de caja (solo efectivo)
    if (input.metodo_pago === 'efectivo') {
      await conn.query(
        `UPDATE sesiones_caja
         SET saldo_final_esperado = saldo_final_esperado + ?
         WHERE id = ?`,
        [total, input.sesion_caja_id]
      );
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

export async function getVentas(filtro?: { desde?: string; hasta?: string }): Promise<Venta[]> {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return [];

  // FIX: sin interpolación — condiciones como parámetros, estructura fija
  const conditions: string[] = [];
  const params: string[] = [];

  if (filtro?.desde) { conditions.push('DATE(v.creado_at) >= ?'); params.push(filtro.desde); }
  if (filtro?.hasta) { conditions.push('DATE(v.creado_at) <= ?'); params.push(filtro.hasta); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT v.*, c.nombre AS cliente_nombre, u.nombre AS usuario_nombre
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
    SELECT v.*, c.nombre AS cliente_nombre, u.nombre AS usuario_nombre
    FROM ventas v
    LEFT JOIN clientes c  ON c.id  = v.cliente_id
    LEFT JOIN usuarios u  ON u.id  = v.usuario_id
    WHERE v.id = ?
  `, [ventaId]);

  if (!ventaRows[0]) return null;
  const venta = ventaRows[0] as Venta;

  const [detallesRows] = await pool.query<RowDataPacket[]>(`
    SELECT dv.*,
           COALESCE(p.nombre, '[Producto eliminado]') AS producto_nombre,
           COALESCE(p.sku, '—')                       AS producto_sku
    FROM detalles_ventas dv
    LEFT JOIN productos p ON p.id = dv.producto_id
    WHERE dv.venta_id = ?
  `, [ventaId]);

  venta.detalles = detallesRows as Venta['detalles'];
  return venta;
}

export async function getDashboardStats() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return null;

  const [ventasHoy] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total_ventas, COALESCE(SUM(total), 0) AS ingresos
     FROM ventas WHERE DATE(creado_at) = CURDATE()`
  );
  const [ventasMes] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total_ventas, COALESCE(SUM(total), 0) AS ingresos
     FROM ventas WHERE MONTH(creado_at) = MONTH(CURDATE()) AND YEAR(creado_at) = YEAR(CURDATE())`
  );
  const [totalStock] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(stock), 0) AS stock_total FROM productos`
  );
  const [ventasPorDia] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(DATE(creado_at), '%Y-%m-%d') AS fecha, COALESCE(SUM(total), 0) AS ingresos, COUNT(*) AS ventas
     FROM ventas
     WHERE creado_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY fecha
     ORDER BY fecha ASC`
  );

  return {
    hoy:            ventasHoy[0],
    mes:            ventasMes[0],
    stock_total:    Number(totalStock[0]?.stock_total ?? 0),
    ventas_por_dia: ventasPorDia,
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
  console.log('desde', desde);
  console.log('hasta', hasta);
  // Validar que sean fechas YYYY-MM-DD válidas para evitar inyección
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(desde) || !dateRegex.test(hasta)) return null;

  const [ventasPorDia] = await pool.query<RowDataPacket[]>(
    `SELECT
       DATE_FORMAT(DATE(creado_at), '%Y-%m-%d') AS fecha,
       COUNT(*)                                   AS ventas,
       COALESCE(SUM(total), 0)                    AS ingresos
     FROM ventas
     WHERE DATE(creado_at) BETWEEN ? AND ?
     GROUP BY fecha
     ORDER BY fecha ASC`,
    [desde, hasta]
  );

  const [resumen] = await pool.query<RowDataPacket[]>(
    `SELECT
       COUNT(*)                                        AS total_ventas,
       COALESCE(SUM(total), 0)                         AS total_ingresos,
       COALESCE(AVG(total), 0)                         AS ticket_promedio,
       COALESCE(SUM(dv.cantidad_total), 0)             AS productos_vendidos
     FROM ventas v
     LEFT JOIN (
       SELECT venta_id, SUM(cantidad) AS cantidad_total
       FROM detalles_ventas GROUP BY venta_id
     ) dv ON dv.venta_id = v.id
     WHERE DATE(v.creado_at) BETWEEN ? AND ?`,
    [desde, hasta]
  );

  const r = resumen[0] ?? {};
  return {
    ventas_por_dia:    ventasPorDia as DashboardRangeData['ventas_por_dia'],
    total_ventas:      Number(r.total_ventas ?? 0),
    total_ingresos:    Number(r.total_ingresos ?? 0),
    ticket_promedio:   Number(r.ticket_promedio ?? 0),
    productos_vendidos: Number(r.productos_vendidos ?? 0),
  };
}
