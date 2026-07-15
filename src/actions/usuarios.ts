'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { Usuario, Rol } from '@/types';
import { MODULOS, type Modulo, type PermisosMap } from '@/lib/permisos';

export async function getUsuarios(): Promise<Usuario[]> {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return [];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, nombre, email, rol, activo, creado_at FROM usuarios ORDER BY nombre ASC`
  );
  return rows as Usuario[];
}

export async function crearUsuario(data: {
  nombre: string; email: string; password: string; rol: Rol;
}) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };

  const hash = await bcrypt.hash(data.password, 10);
  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)`,
      [data.nombre, data.email, hash, data.rol]
    );
    revalidatePath('/configuracion');
    return { success: true };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'ER_DUP_ENTRY') return { error: 'Ese correo ya está registrado.' };
    return { error: 'Error al crear usuario.' };
  }
}

export async function actualizarUsuario(id: number, data: {
  nombre?: string; email?: string; rol?: Rol;
}) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };

  // No permitir que un admin se quite a sí mismo el rol de admin (evita quedar bloqueado).
  if (data.rol && data.rol !== 'admin' && Number(session.sub) === id) {
    return { error: 'No puedes quitarte tu propio rol de administrador.' };
  }

  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return { error: 'Sin campos para actualizar.' };

  const fields = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);

  try {
    await pool.query(`UPDATE usuarios SET ${fields} WHERE id = ?`, [...values, id]);
    revalidatePath('/configuracion');
    return { success: true };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'ER_DUP_ENTRY') return { error: 'Ese correo ya está registrado.' };
    return { error: 'Error al actualizar usuario.' };
  }
}

export async function resetearPasswordUsuario(id: number, password: string) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };

  const hash = await bcrypt.hash(password, 10);
  await pool.query(`UPDATE usuarios SET password_hash = ? WHERE id = ?`, [hash, id]);
  return { success: true };
}

export async function cambiarActivoUsuario(id: number, activo: boolean) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };

  if (!activo && Number(session.sub) === id) {
    return { error: 'No puedes desactivar tu propia cuenta.' };
  }

  await pool.query(`UPDATE usuarios SET activo = ? WHERE id = ?`, [activo ? 1 : 0, id]);
  revalidatePath('/configuracion');
  return { success: true };
}

export async function getPermisosUsuario(usuarioId: number): Promise<PermisosMap> {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return {};

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT modulo, ver, crear, editar, eliminar FROM permisos_usuario WHERE usuario_id = ?`,
    [usuarioId]
  );
  const permisos: PermisosMap = {};
  for (const r of rows) {
    permisos[r.modulo as Modulo] = {
      ver:      Number(r.ver) === 1,
      crear:    Number(r.crear) === 1,
      editar:   Number(r.editar) === 1,
      eliminar: Number(r.eliminar) === 1,
    };
  }
  return permisos;
}

// Los cambios aplican la próxima vez que ese usuario inicie sesión — los
// permisos viven en el JWT, no se releen de la base en cada request (igual
// que el rol; ver JWTPayload en lib/auth.ts).
export async function guardarPermisosUsuario(usuarioId: number, permisos: PermisosMap) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const { key: modulo } of MODULOS) {
      const p = permisos[modulo] ?? { ver: false, crear: false, editar: false, eliminar: false };
      await conn.query(
        `INSERT INTO permisos_usuario (usuario_id, modulo, ver, crear, editar, eliminar)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE ver = VALUES(ver), crear = VALUES(crear), editar = VALUES(editar), eliminar = VALUES(eliminar)`,
        [usuarioId, modulo, p.ver ? 1 : 0, p.crear ? 1 : 0, p.editar ? 1 : 0, p.eliminar ? 1 : 0]
      );
    }
    await conn.commit();
    revalidatePath('/configuracion');
    return { success: true };
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return { error: 'Error al guardar permisos.' };
  } finally {
    conn.release();
  }
}
