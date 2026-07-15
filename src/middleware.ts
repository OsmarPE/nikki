import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-secret-solo-para-desarrollo'
);

const PUBLIC_ROUTES = ['/login'];
const VENDEDOR_OK   = ['/pos'];

// Rutas del panel admin que corresponden a un módulo con permisos granulares
// (ver actions/usuarios.ts + lib/permisos.ts). El admin siempre tiene acceso
// total; un vendedor entra solo si tiene el permiso "ver" de ese módulo.
// Dashboard y Configuración quedan fuera a propósito: son exclusivos de admin
// sin importar los permisos granulares.
const RUTA_MODULO: Record<string, string> = {
  '/productos':   'productos',
  '/categorias':  'categorias',
  '/marcas':      'marcas',
  '/colecciones': 'colecciones',
  '/inventario':  'inventario',
  '/clientes':    'clientes',
  '/ventas':      'ventas',
  '/caja':        'caja',
};

interface PermisoModulo { ver?: boolean }

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) return NextResponse.next();

  const token = request.cookies.get('pos_session')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  try {
    const { payload } = await jwtVerify(token, secret);
    const rol = payload.rol as string;

    // Admin: acceso total, sin restricciones de módulo.
    if (rol === 'admin') return NextResponse.next();

    // Vendedor: /pos siempre disponible.
    if (VENDEDOR_OK.some(r => pathname.startsWith(r)) || pathname === '/') {
      return NextResponse.next();
    }

    // Vendedor entrando a un módulo del panel admin: requiere permiso "ver".
    const permisos = (payload.permisos ?? {}) as Record<string, PermisoModulo>;
    const rutaModulo = Object.entries(RUTA_MODULO).find(([ruta]) => pathname.startsWith(ruta));
    if (rutaModulo) {
      const [, modulo] = rutaModulo;
      if (permisos[modulo]?.ver) return NextResponse.next();
    }

    return NextResponse.redirect(new URL('/pos', request.url));
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('pos_session');
    return response;
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
