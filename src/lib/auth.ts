import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { PermisosMap } from '@/lib/permisos';

// FIX: lanzar error en producción si JWT_SECRET no está configurado
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET no está definido. Configura la variable de entorno antes de iniciar en producción.');
}
const secret = new TextEncoder().encode(jwtSecret ?? 'fallback-secret-solo-para-desarrollo');

const COOKIE = 'pos_session';
const EXPIRY = '7d';

export interface JWTPayload {
  sub: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'vendedor';
  // Permisos granulares por módulo — solo se usan cuando rol === 'vendedor'.
  // Se calculan una vez al iniciar sesión (ver loginAction); si un admin
  // cambia los permisos de alguien después, el cambio aplica hasta que esa
  // persona vuelva a iniciar sesión (mismo comportamiento que un cambio de rol).
  permisos?: PermisosMap;
  iat?: number;
  exp?: number;
}

export async function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function cookieName() {
  return COOKIE;
}
