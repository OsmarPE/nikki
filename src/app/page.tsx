import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { primerModuloAccesible, MODULO_RUTA } from '@/lib/permisos';

export default async function Home() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.rol === 'admin') redirect('/dashboard');

  const modulo = primerModuloAccesible(session);
  redirect(modulo ? MODULO_RUTA[modulo] : '/sin-acceso');
}
