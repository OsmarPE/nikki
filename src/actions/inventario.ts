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

  if (data.tipo === 'salida') {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN cantidad ELSE -cantidad END), 0) AS stock
       FROM movimientos_inventario WHERE producto_id = ?`,
      [data.producto_id]
    );
    const stock = Number(rows[0]?.stock ?? 0);
    if (stock < data.cantidad) return { error: `Stock insuficiente. Disponible: ${stock}` };
  }

  await pool.query(
    `INSERT INTO movimientos_inventario (producto_id, tipo, motivo, cantidad, usuario_id, referencia, notas)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.producto_id, data.tipo, data.motivo, data.cantidad,
     session.sub, data.referencia ?? null, data.notas ?? null]
  );
  revalidatePath('/inventario');
  return { success: true };
}

export async function getStockProducto(productoId: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN cantidad ELSE -cantidad END), 0) AS stock
     FROM movimientos_inventario WHERE producto_id = ?`,
    [productoId]
  );
  return Number(rows[0]?.stock ?? 0);
}
