'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';
import type { Categoria, Marca, Coleccion } from '@/types';

// ─── Categorías ───────────────────────────────────────────────────────────────
export async function getCategorias(): Promise<Categoria[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, nombre FROM categorias ORDER BY nombre ASC'
  );
  return rows as Categoria[];
}

export async function crearCategoria(nombre: string) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };
  try {
    await pool.query('INSERT INTO categorias (nombre) VALUES (?)', [nombre.trim()]);
    revalidatePath('/categorias');
    return { success: true };
  } catch {
    return { error: 'Esa categoría ya existe.' };
  }
}

export async function actualizarCategoria(id: number, nombre: string) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };
  await pool.query('UPDATE categorias SET nombre = ? WHERE id = ?', [nombre.trim(), id]);
  revalidatePath('/categorias');
  return { success: true };
}

export async function eliminarCategoria(id: number) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };

  // Validar dependencias ANTES del DELETE — no depender de FK del motor
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM productos WHERE categoria_id = ?', [id]
  );
  const total = Number((rows[0] as RowDataPacket).total ?? 0);
  if (total > 0) {
    return {
      error: `No se puede eliminar: ${total} ${total === 1 ? 'producto usa' : 'productos usan'} esta categoría. Reasígnalos primero.`,
      blocked: true,
      count: total,
    };
  }

  await pool.query('DELETE FROM categorias WHERE id = ?', [id]);
  revalidatePath('/categorias');
  return { success: true };
}

// ─── Marcas ───────────────────────────────────────────────────────────────────
export async function getMarcas(): Promise<Marca[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, nombre FROM marcas ORDER BY nombre ASC'
  );
  return rows as Marca[];
}

export async function crearMarca(nombre: string) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };
  try {
    await pool.query('INSERT INTO marcas (nombre) VALUES (?)', [nombre.trim()]);
    revalidatePath('/marcas');
    return { success: true };
  } catch {
    return { error: 'Esa marca ya existe.' };
  }
}

export async function actualizarMarca(id: number, nombre: string) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };
  await pool.query('UPDATE marcas SET nombre = ? WHERE id = ?', [nombre.trim(), id]);
  revalidatePath('/marcas');
  return { success: true };
}

export async function eliminarMarca(id: number) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM productos WHERE marca_id = ?', [id]
  );
  const total = Number((rows[0] as RowDataPacket).total ?? 0);
  if (total > 0) {
    return {
      error: `No se puede eliminar: ${total} ${total === 1 ? 'producto usa' : 'productos usan'} esta marca. Reasígnalos primero.`,
      blocked: true,
      count: total,
    };
  }

  await pool.query('DELETE FROM marcas WHERE id = ?', [id]);
  revalidatePath('/marcas');
  return { success: true };
}

// ─── Colecciones (soft delete) ────────────────────────────────────────────────
export async function getColecciones(incluirEliminadas = false): Promise<Coleccion[]> {
  const query = incluirEliminadas
    ? 'SELECT id, nombre, deleted_at, creado_at FROM colecciones ORDER BY nombre ASC'
    : 'SELECT id, nombre, deleted_at, creado_at FROM colecciones WHERE deleted_at IS NULL ORDER BY nombre ASC';
  const [rows] = await pool.query<RowDataPacket[]>(query);
  return rows as Coleccion[];
}

export async function crearColeccion(nombre: string) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };
  await pool.query('INSERT INTO colecciones (nombre) VALUES (?)', [nombre.trim()]);
  revalidatePath('/colecciones');
  return { success: true };
}

export async function actualizarColeccion(id: number, nombre: string) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };
  await pool.query('UPDATE colecciones SET nombre = ? WHERE id = ?', [nombre.trim(), id]);
  revalidatePath('/colecciones');
  return { success: true };
}

// Colecciones usan soft delete — no requieren validación de dependencias
// porque los productos con coleccion_id seguirán funcionando (el campo es nullable).
// El soft delete solo oculta la colección de la UI, no afecta datos existentes.
export async function eliminarColeccionLogico(id: number) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };
  await pool.query('UPDATE colecciones SET deleted_at = NOW() WHERE id = ?', [id]);
  revalidatePath('/colecciones');
  return { success: true };
}

export async function restaurarColeccion(id: number) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };
  await pool.query('UPDATE colecciones SET deleted_at = NULL WHERE id = ?', [id]);
  revalidatePath('/colecciones');
  return { success: true };
}
