'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';
import type { MovimientoInventario } from '@/types';

export async function getMovimientos(productoId?: number): Promise<MovimientoInventario[]> {
  const where = productoId ? 'WHERE mi.producto_id = ?' : '';
  const params = productoId ? [productoId] : [];
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      mi.*,
      COALESCE(p.nombre, '[Producto eliminado]') AS producto_nombre,
      COALESCE(u.nombre, '[Usuario eliminado]')   AS usuario_nombre
    FROM movimientos_inventario mi
    LEFT JOIN productos p ON p.id = mi.producto_id
    LEFT JOIN usuarios  u ON u.id = mi.usuario_id
    ${where}
    ORDER BY mi.creado_at DESC
    LIMIT 500
  `, params);
  return rows as MovimientoInventario[];
}

export async function registrarMovimiento(data: {
  producto_id: number;
  tipo: 'entrada' | 'salida';
  motivo: 'venta' | 'devolucion' | 'compra' | 'ajuste';
  cantidad: number;
  referencia?: string;
  notas?: string;
}) {
  const session = await getSession();
  if (!session) return { error: 'Sin sesión.' };
  if (data.cantidad <= 0) return { error: 'La cantidad debe ser mayor a 0.' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Bloquea la fila del producto (no todo el historial de movimientos) para
    // evitar carreras entre movimientos concurrentes del mismo producto.
    const [pRows] = await conn.query<RowDataPacket[]>(
      `SELECT stock FROM productos WHERE id = ? FOR UPDATE`,
      [data.producto_id]
    );
    if (!pRows[0]) {
      await conn.rollback();
      return { error: 'Producto no encontrado.' };
    }
    const stockActual = Number(pRows[0].stock);

    if (data.tipo === 'salida' && stockActual < data.cantidad) {
      await conn.rollback();
      return { error: `Stock insuficiente. Disponible: ${stockActual}` };
    }

    await conn.query(
      `INSERT INTO movimientos_inventario (producto_id, tipo, motivo, cantidad, usuario_id, referencia, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.producto_id, data.tipo, data.motivo, data.cantidad,
       session.sub, data.referencia ?? null, data.notas ?? null]
    );

    const delta = data.tipo === 'entrada' ? data.cantidad : -data.cantidad;
    await conn.query(`UPDATE productos SET stock = stock + ? WHERE id = ?`, [delta, data.producto_id]);

    await conn.commit();
    revalidatePath('/inventario');
    revalidatePath('/productos');
    return { success: true };
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return { error: 'Error al registrar el movimiento.' };
  } finally {
    conn.release();
  }
}

export async function getStockProducto(productoId: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT stock FROM productos WHERE id = ?`,
    [productoId]
  );
  return Number(rows[0]?.stock ?? 0);
}
