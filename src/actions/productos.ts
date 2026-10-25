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
      col.nombre AS coleccion_nombre,
      ue.creado_at  AS ultima_entrada_at,
      ue.referencia AS ultima_entrada_referencia
    FROM productos p
    LEFT JOIN categorias  c   ON c.id   = p.categoria_id
    LEFT JOIN marcas       m   ON m.id   = p.marca_id
    LEFT JOIN colecciones  col ON col.id = p.coleccion_id
    -- Última entrada de inventario de cada producto (el id más alto es la más reciente).
    LEFT JOIN movimientos_inventario ue ON ue.id = (
      SELECT MAX(mi.id) FROM movimientos_inventario mi
      WHERE mi.producto_id = p.id AND mi.tipo = 'entrada'
    )
    WHERE p.activo = 1
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
    WHERE p.activo = 1 ${like ? 'AND (p.sku LIKE ? OR p.nombre LIKE ?)' : ''}
    ORDER BY p.nombre ASC
    LIMIT ? OFFSET ?
  `, like ? [like, like, pageSize, offset] : [pageSize, offset]);

  const total = rows.length > 0 ? Number((rows[0] as RowDataPacket).total_count) : 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const items = (rows as RowDataPacket[]).map(({ total_count, ...rest }) => rest) as Producto[];
  return { items, total };
}

// `entradaInicial`: piezas que llegaron con el producto y el folio de su nota.
// Se registran en la misma transacción que el alta, así un producto nuevo no
// queda en 0 piezas porque se olvidó el paso de Inventario.
export async function crearProducto(data: {
  sku: string; nombre: string; precio: number;
  precio_descuento?: number | null; descripcion?: string;
  imagen_url?: string | null; categoria_id?: number | null;
  marca_id?: number | null; coleccion_id?: number | null;
}, entradaInicial?: { cantidad: number; referencia: string } | null) {
  const session = await getSession();
  if (!session || !tienePermiso(session, 'productos', 'crear')) return { error: 'Sin permiso.' };

  const folio = entradaInicial?.referencia.trim() ?? '';
  if (entradaInicial) {
    if (!tienePermiso(session, 'inventario', 'crear')) return { error: 'Sin permiso para registrar piezas.' };
    if (!Number.isInteger(entradaInicial.cantidad) || entradaInicial.cantidad <= 0) {
      return { error: 'Las piezas deben ser un número entero mayor a 0.' };
    }
    if (!folio) return { error: 'El folio de la nota es obligatorio.' };
    if (folio.length > 100) return { error: 'El folio de la nota es demasiado largo.' };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO productos (sku, nombre, precio, precio_descuento, descripcion, imagen_url, categoria_id, marca_id, coleccion_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.sku, data.nombre, data.precio, data.precio_descuento ?? null,
       data.descripcion ?? null, data.imagen_url ?? null,
       data.categoria_id ?? null, data.marca_id ?? null, data.coleccion_id ?? null]
    );
    if (entradaInicial) {
      await conn.query(
        `INSERT INTO movimientos_inventario (producto_id, tipo, motivo, cantidad, usuario_id, referencia)
         VALUES (?, 'entrada', 'compra', ?, ?, ?)`,
        [result.insertId, entradaInicial.cantidad, session.sub, folio]
      );
      await conn.query(`UPDATE productos SET stock = stock + ? WHERE id = ?`, [entradaInicial.cantidad, result.insertId]);
    }
    await conn.commit();
    revalidatePath('/productos');
    if (entradaInicial) revalidatePath('/inventario');
    return { success: true };
  } catch (e: unknown) {
    await conn.rollback();
    const err = e as { code?: string };
    if (err.code === 'ER_DUP_ENTRY') return { error: 'El SKU ya existe.' };
    console.error(e);
    return { error: 'Error al crear producto.' };
  } finally {
    conn.release();
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

// Si el producto tiene ventas o movimientos de inventario registrados no se
// puede borrar de verdad (rompería el historial), así que en ese caso se
// desactiva en su lugar: deja de aparecer en el POS y en el selector de
// movimientos, pero conserva sus registros pasados intactos.
export async function eliminarProducto(id: number) {
  const session = await getSession();
  if (!tienePermiso(session, 'productos', 'eliminar')) return { error: 'Sin permiso.' };

  const [[v], [m]] = await Promise.all([
    pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM detalles_ventas WHERE producto_id = ?', [id]),
    pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM movimientos_inventario WHERE producto_id = ?', [id]),
  ]);
  const totalVentas = Number(v[0]?.total ?? 0);
  const totalMov    = Number(m[0]?.total ?? 0);

  if (totalVentas > 0 || totalMov > 0) {
    await pool.query('UPDATE productos SET activo = 0 WHERE id = ?', [id]);
    revalidatePath('/productos');
    revalidatePath('/inventario');
    return { success: true };
  }

  await pool.query('DELETE FROM productos WHERE id = ?', [id]);
  revalidatePath('/productos');
  return { success: true };
}

// ─── Productos de una categoría / marca / colección ──────────────────────────
const CATALOGO_COLUMNA = {
  categoria: 'categoria_id',
  marca:     'marca_id',
  coleccion: 'coleccion_id',
} as const;

export async function getProductosPorCatalogo(
  tipo: keyof typeof CATALOGO_COLUMNA,
  id: number,
): Promise<Producto[]> {
  const session = await getSession();
  const modulo = tipo === 'categoria' ? 'categorias' : tipo === 'marca' ? 'marcas' : 'colecciones';
  if (!tienePermiso(session, modulo, 'ver')) return [];
  // La columna sale de un mapa fijo, nunca del input.
  const columna = CATALOGO_COLUMNA[tipo];
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
    WHERE p.activo = 1 AND p.${columna} = ?
    ORDER BY p.nombre ASC
  `, [id]);
  return rows as Producto[];
}
