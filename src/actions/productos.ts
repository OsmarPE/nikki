'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { tienePermiso } from '@/lib/permisos';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { Producto } from '@/types';

const COLUMNAS_PRODUCTO = new Set([
  'sku', 'nombre', 'precio', 'precio_descuento',
  'descripcion', 'imagen_url', 'categoria_id', 'marca_id', 'coleccion_id', 'stock',
]);

export async function getProductos(): Promise<Producto[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      p.*,
      c.nombre   AS categoria_nombre,
      m.nombre   AS marca_nombre,
      col.nombre AS coleccion_nombre
    FROM productos p
    LEFT JOIN categorias  c   ON c.id   = p.categoria_id
    LEFT JOIN marcas       m   ON m.id   = p.marca_id
    LEFT JOIN colecciones  col ON col.id = p.coleccion_id
    ORDER BY p.nombre ASC
  `);
  return rows as Producto[];

}

export async function getProducto(id: number): Promise<Producto | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT p.*, c.nombre AS categoria_nombre, m.nombre AS marca_nombre, col.nombre AS coleccion_nombre
    FROM productos p
    LEFT JOIN categorias  c   ON c.id   = p.categoria_id
    LEFT JOIN marcas       m   ON m.id   = p.marca_id
    LEFT JOIN colecciones  col ON col.id = p.coleccion_id
    WHERE p.id = ?
  `, [id]);
  return (rows[0] as Producto) ?? null;
}

export async function buscarProductosPOS(query: string): Promise<Producto[]> {
  if (!query || query.trim().length < 1) return [];
  const escaped = query.trim().replace(/[%_\\]/g, '\\$&');
  const like = `%${escaped}%`;
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT p.*, m.nombre AS marca_nombre
    FROM productos p
    LEFT JOIN marcas m ON m.id = p.marca_id
    WHERE (p.sku LIKE ? OR p.nombre LIKE ?)
    ORDER BY p.nombre ASC
    LIMIT 20
  `, [like, like]);
  return rows as Producto[];
}

export async function listarProductosPOS(
  query: string,
  page: number,
  pageSize: number,
): Promise<{ items: Producto[]; total: number }> {
  const trimmed = query.trim();
  const like = trimmed ? `%${trimmed.replace(/[%_\\]/g, '\\$&')}%` : null;
  const offset = Math.max(0, page - 1) * pageSize;

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT p.*, m.nombre AS marca_nombre, COUNT(*) OVER() AS total_count
    FROM productos p
    LEFT JOIN marcas m ON m.id = p.marca_id
    ${like ? 'WHERE (p.sku LIKE ? OR p.nombre LIKE ?)' : ''}
    ORDER BY p.nombre ASC
    LIMIT ? OFFSET ?
  `, like ? [like, like, pageSize, offset] : [pageSize, offset]);

  const total = rows.length > 0 ? Number((rows[0] as RowDataPacket).total_count) : 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const items = (rows as RowDataPacket[]).map(({ total_count, ...rest }) => rest) as Producto[];
  return { items, total };
}

export async function crearProducto(data: {
  sku: string; nombre: string; precio: number;
  precio_descuento?: number | null; descripcion?: string;
  imagen_url?: string | null; categoria_id?: number | null;
  marca_id?: number | null; coleccion_id?: number | null;
}) {
  const session = await getSession();
  if (!tienePermiso(session, 'productos', 'crear')) return { error: 'Sin permiso.' };
  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO productos (sku, nombre, precio, precio_descuento, descripcion, imagen_url, categoria_id, marca_id, coleccion_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.sku, data.nombre, data.precio, data.precio_descuento ?? null,
       data.descripcion ?? null, data.imagen_url ?? null,
       data.categoria_id ?? null, data.marca_id ?? null, data.coleccion_id ?? null]
    );
    revalidatePath('/productos');
    return { success: true };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'ER_DUP_ENTRY') return { error: 'El SKU ya existe.' };
    return { error: 'Error al crear producto.' };
  }
}

export async function actualizarProducto(id: number, data: {
  sku?: string; nombre?: string; precio?: number;
  precio_descuento?: number | null; descripcion?: string;
  imagen_url?: string | null; categoria_id?: number | null;
  marca_id?: number | null; coleccion_id?: number | null;
}) {
  const session = await getSession();
  if (!tienePermiso(session, 'productos', 'editar')) return { error: 'Sin permiso.' };

  const entries = Object.entries(data).filter(([k, v]) => v !== undefined && COLUMNAS_PRODUCTO.has(k));
  if (entries.length === 0) return { error: 'Sin campos para actualizar.' };

  const fields = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);

  try {
    await pool.query(`UPDATE productos SET ${fields} WHERE id = ?`, [...values, id]);
    revalidatePath('/productos');
    return { success: true };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'ER_DUP_ENTRY') return { error: 'El SKU ya existe.' };
    return { error: 'Error al actualizar producto.' };
  }
}

// ─── Verificar dependencias antes de eliminar ─────────────────────────────────
export async function verificarDependenciasProducto(id: number): Promise<{
  ventas: number;
  movimientos: number;
}> {
  const session = await getSession();
  if (!tienePermiso(session, 'productos', 'eliminar')) return { ventas: 0, movimientos: 0 };

  const [[v], [m]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM detalles_ventas WHERE producto_id = ?', [id]
    ),
    pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM movimientos_inventario WHERE producto_id = ?', [id]
    ),
  ]);

  return {
    ventas:      Number(v[0]?.total ?? 0),
    movimientos: Number(m[0]?.total ?? 0),
  };
}

export async function eliminarProducto(id: number) {
  const session = await getSession();
  if (!tienePermiso(session, 'productos', 'eliminar')) return { error: 'Sin permiso.' };

  // Verificar ventas que contienen este producto
  const [ventasRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM detalles_ventas WHERE producto_id = ?', [id]
  );
  const totalVentas = Number((ventasRows[0] as RowDataPacket).total ?? 0);
  if (totalVentas > 0) {
    return {
      error: `Este producto aparece en ${totalVentas} ${totalVentas === 1 ? 'venta registrada' : 'ventas registradas'}. No se puede eliminar para conservar el historial.`,
      blocked: true,
      count: totalVentas,
      reason: 'ventas',
    };
  }

  // Verificar movimientos de inventario
  const [movRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM movimientos_inventario WHERE producto_id = ?', [id]
  );
  const totalMov = Number((movRows[0] as RowDataPacket).total ?? 0);
  if (totalMov > 0) {
    return {
      error: `Este producto tiene ${totalMov} ${totalMov === 1 ? 'movimiento de inventario' : 'movimientos de inventario'}. No se puede eliminar para conservar el historial.`,
      blocked: true,
      count: totalMov,
      reason: 'inventario',
    };
  }

  await pool.query('DELETE FROM productos WHERE id = ?', [id]);
  revalidatePath('/productos');
  return { success: true };
}
