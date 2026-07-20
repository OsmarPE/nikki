import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { logoutAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { primerModuloAccesible, MODULO_RUTA } from '@/lib/permisos';
import { ShieldOff } from 'lucide-react';

export default async function SinAccesoPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.rol === 'admin') redirect('/dashboard');

  // Si en realidad ya tiene acceso a algún módulo (permisos cambiaron después
  // de iniciar sesión, o llegó aquí por error), lo mandamos ahí en vez de
  // mostrarle la pantalla de sin acceso.
  const modulo = primerModuloAccesible(session);
  if (modulo) redirect(MODULO_RUTA[modulo]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[340px] text-center">
        <div className="size-12 text-muted-foreground mb-4 mx-auto bg-muted rounded-full flex items-center justify-center">
          <ShieldOff size={18} />
        </div>
        <Text variant="title">Sin permisos asignados</Text>
        <Text variant="description" className="mt-1">
          Tu cuenta ({session.nombre}) no tiene acceso a ninguna sección todavía. Pídele a un administrador que te asigne permisos.
        </Text>
        <form action={logoutAction} className="mt-6">
          <Button type="submit" variant="outline" className="w-full">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}
