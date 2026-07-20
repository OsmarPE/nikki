import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { MODULO_RUTA, primerModuloAccesible, type Modulo, type PermisosMap } from '@/lib/permisos';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-secret-solo-para-desarrollo'
);

const PUBLIC_ROUTES = ['/login'];

// Rutas del panel admin que corresponden a un módulo con permisos granulares
// (ver actions/usuarios.ts + lib/permisos.ts). El admin siempre tiene acceso
// total; un vendedor entra solo si tiene el permiso "ver" de ese módulo.
// Dashboard y Configuración quedan fuera a propósito: son exclusivos de admin
// sin importar los permisos granulares.
const RUTA_MODULO: Record<string, Modulo> = Object.fromEntries(
  Object.entries(MODULO_RUTA).map(([modulo, ruta]) => [ruta, modulo as Modulo])
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) return NextResponse.next();

  const token = request.cookies.get('pos_session')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  try {
    const { payload } = await jwtVerify(token, secret);
    const rol = payload.rol as 'admin' | 'vendedor';

    // Admin: acceso total, sin restricciones de módulo.
    if (rol === 'admin') return NextResponse.next();

    // Raíz (redirige server-side según rol/permisos) y la pantalla de "sin
    // permisos" siempre son accesibles para cualquier vendedor autenticado.
    if (pathname === '/' || pathname.startsWith('/sin-acceso')) {
      return NextResponse.next();
    }

    // Vendedor entrando a un módulo del panel admin: requiere permiso "ver".
    const permisos = payload.permisos as PermisosMap | undefined;
    const rutaModulo = Object.entries(RUTA_MODULO).find(([ruta]) => pathname.startsWith(ruta));
    if (rutaModulo) {
      const [, modulo] = rutaModulo;
      if (permisos?.[modulo]?.ver) return NextResponse.next();
    }

    // Sin acceso a esta ruta: lo mandamos a su primer módulo permitido, o a
    // la pantalla de "sin permisos" si no tiene ninguno.
    const primerModulo = primerModuloAccesible({ rol, permisos });
    const destino = primerModulo ? MODULO_RUTA[primerModulo] : '/sin-acceso';
    return NextResponse.redirect(new URL(destino, request.url));
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('pos_session');
    return response;
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
