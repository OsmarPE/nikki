'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { signToken, cookieName } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';
import { primerModuloAccesible, MODULO_RUTA, type Modulo, type PermisosMap } from '@/lib/permisos';

export async function loginAction(formData: FormData) {
  const email    = formData.get('email')    as string;
  const password = formData.get('password') as string;

  if (!email || !password) return { error: 'Completa todos los campos.' };

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, nombre, email, password_hash, rol, activo FROM usuarios WHERE email = ? LIMIT 1',
    [email]
  );

  const user = rows[0];
  if (!user) return { error: 'Credenciales inválidas.' };

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return { error: 'Credenciales inválidas.' };

  if (Number(user.activo) === 0) return { error: 'Esta cuenta está desactivada.' };

  let permisos: PermisosMap | undefined;
  if (user.rol !== 'admin') {
    const [permisoRows] = await pool.query<RowDataPacket[]>(
      'SELECT modulo, ver, crear, editar, eliminar FROM permisos_usuario WHERE usuario_id = ?',
      [user.id]
    );
    permisos = {};
    for (const p of permisoRows) {
      permisos[p.modulo as Modulo] = {
        ver:      Number(p.ver) === 1,
        crear:    Number(p.crear) === 1,
        editar:   Number(p.editar) === 1,
        eliminar: Number(p.eliminar) === 1,
      };
    }
  }

  const token = await signToken({
    sub:    String(user.id),
    nombre: user.nombre,
    email:  user.email,
    rol:    user.rol,
    permisos,
  });

  const cookieStore = await cookies();
  cookieStore.set(cookieName(), token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7,
    path:     '/',
  });

  if (user.rol === 'admin') {
    redirect('/dashboard');
  }
  // Vendedor: entra directo al primer módulo para el que tiene permiso "ver".
  // Sin ningún permiso asignado, va a la pantalla de "sin permisos".
  const modulo = primerModuloAccesible({ rol: user.rol, permisos });
  redirect(modulo ? MODULO_RUTA[modulo] : '/sin-acceso');
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName());
  redirect('/login');
}
