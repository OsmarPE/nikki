import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { MODULOS, tieneAccesoModulo } from '@/lib/permisos';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const esAdmin = session.rol === 'admin';
  const tieneAlgunAcceso = MODULOS.some(m => tieneAccesoModulo(session, m.key));
  if (!esAdmin && !tieneAlgunAcceso) redirect('/sin-acceso');

  return (
    <SidebarProvider>
      <AppSidebar nombre={session.nombre} rol={session.rol} permisos={session.permisos} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>
        <main className="flex-1 bg-white overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
