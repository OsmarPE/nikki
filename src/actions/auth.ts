'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { signToken, cookieName } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

export async function loginAction(formData: FormData) {
  const email    = formData.get('email')    as string;
  const password = formData.get('password') as string;

  if (!email || !password) return { error: 'Completa todos los campos.' };

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, nombre, email, password_hash, rol FROM usuarios WHERE email = ? LIMIT 1',
    [email]
  );

  const user = rows[0];
  if (!user) return { error: 'Credenciales inválidas.' };

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return { error: 'Credenciales inválidas.' };

  const token = await signToken({
    sub:    String(user.id),
    nombre: user.nombre,
    email:  user.email,
    rol:    user.rol,
  });

  const cookieStore = await cookies();
  cookieStore.set(cookieName(), token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 8,
    path:     '/',
  });

  redirect(user.rol === 'admin' ? '/dashboard' : '/pos');
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName());
  redirect('/login');
}
