'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';
import type { Cliente } from '@/types';

export async function getClientes(): Promise<Cliente[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, nombre, telefono, email, creado_at FROM clientes ORDER BY nombre ASC'
  );
  return rows as Cliente[];
}

export async function buscarClientes(query: string): Promise<Cliente[]> {
  const escaped = query.trim().replace(/[%_\\]/g, '\\$&');
  const like = `%${escaped}%`;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, nombre, telefono, email FROM clientes
     WHERE nombre LIKE ? OR telefono LIKE ? OR email LIKE ?
     ORDER BY nombre ASC LIMIT 10`,
    [like, like, like]
  );
  return rows as Cliente[];
}

export async function crearCliente(data: { nombre: string; telefono?: string; email?: string }) {
  const session = await getSession();
  if (!session) return { error: 'Sin sesión.' };
  const [result] = await pool.query(
    'INSERT INTO clientes (nombre, telefono, email) VALUES (?, ?, ?)',
    [data.nombre.trim(), data.telefono || null, data.email || null]
  );
  revalidatePath('/clientes');
  const insertResult = result as { insertId: number };
  return { success: true, id: insertResult.insertId };
}

export async function actualizarCliente(id: number, data: { nombre: string; telefono?: string; email?: string }) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };
  await pool.query(
    'UPDATE clientes SET nombre = ?, telefono = ?, email = ? WHERE id = ?',
    [data.nombre.trim(), data.telefono || null, data.email || null, id]
  );
  revalidatePath('/clientes');
  return { success: true };
}

// ─── Verificar dependencias antes de eliminar ─────────────────────────────────
export async function verificarDependenciasCliente(id: number): Promise<{ ventas: number }> {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { ventas: 0 };
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM ventas WHERE cliente_id = ?', [id]
  );
  return { ventas: Number(rows[0]?.total ?? 0) };
}

export async function eliminarCliente(id: number) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };

  // Validar dependencias ANTES del DELETE
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM ventas WHERE cliente_id = ?', [id]
  );
  const total = Number((rows[0] as RowDataPacket).total ?? 0);
  if (total > 0) {
    return {
      error: `Este cliente tiene ${total} ${total === 1 ? 'venta registrada' : 'ventas registradas'}. No se puede eliminar para conservar el historial de ventas.`,
      blocked: true,
      count: total,
    };
  }

  await pool.query('DELETE FROM clientes WHERE id = ?', [id]);
  revalidatePath('/clientes');
  return { success: true };
}

// ─── Export ───────────────────────────────────────────────────────────────────
export interface ClienteExportRow {
  id: number; nombre: string; telefono: string | null; email: string | null;
  creado_at: string; total_ventas: number; monto_total: number;
  primera_compra: string | null; ultima_compra: string | null; metodos_usados: string | null;
}

export async function getClientesParaExport(): Promise<ClienteExportRow[]> {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return [];
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      c.id, c.nombre, c.telefono, c.email, c.creado_at,
      COALESCE(v.total_ventas, 0) AS total_ventas,
      COALESCE(v.monto_total, 0)  AS monto_total,
      v.primera_compra, v.ultima_compra, v.metodos_usados
    FROM clientes c
    LEFT JOIN (
      SELECT cliente_id, COUNT(*) AS total_ventas, SUM(total) AS monto_total,
             MIN(DATE(creado_at)) AS primera_compra, MAX(DATE(creado_at)) AS ultima_compra,
             GROUP_CONCAT(DISTINCT metodo_pago ORDER BY metodo_pago SEPARATOR ', ') AS metodos_usados
      FROM ventas WHERE cliente_id IS NOT NULL GROUP BY cliente_id
    ) v ON v.cliente_id = c.id
    ORDER BY monto_total DESC, c.nombre ASC
  `);
  return rows as ClienteExportRow[];
}
