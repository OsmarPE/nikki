import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-secret-solo-para-desarrollo'
);

const PUBLIC_ROUTES = ['/login'];
const ADMIN_ONLY    = ['/dashboard', '/productos', '/clientes', '/categorias', '/marcas', '/colecciones', '/ventas', '/inventario', '/usuarios'];
const VENDEDOR_OK   = ['/pos'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) return NextResponse.next();

  const token = request.cookies.get('pos_session')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  try {
    const { payload } = await jwtVerify(token, secret);
    const rol = payload.rol as string;

    if (ADMIN_ONLY.some(r => pathname.startsWith(r)) && rol !== 'admin') {
      return NextResponse.redirect(new URL('/pos', request.url));
    }

    // FIX: vendedor intentando acceder a rutas no listadas → redirigir a /pos
    const isKnownRoute =
      ADMIN_ONLY.some(r => pathname.startsWith(r)) ||
      VENDEDOR_OK.some(r => pathname.startsWith(r)) ||
      pathname === '/';

    if (!isKnownRoute && rol === 'vendedor') {
      return NextResponse.redirect(new URL('/pos', request.url));
    }

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('pos_session');
    return response;
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
