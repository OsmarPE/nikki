import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="w-48 shrink-0 border-r bg-white flex flex-col">
        <div className="px-4 py-5">
          <h1 className="text-base font-semibold tracking-tight">POS</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{session.nombre}</p>
        </div>
        <Separator />
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <Link href="/pos" className="flex items-center px-3 py-2 text-sm rounded-md text-zinc-700 hover:bg-zinc-100">
            Cobrar
          </Link>
          {session.rol === 'admin' && (
            <Link href="/dashboard" className="flex items-center px-3 py-2 text-sm rounded-md text-zinc-700 hover:bg-zinc-100">
              Admin
            </Link>
          )}
        </nav>
        <Separator />
        <div className="p-3">
          <form action={logoutAction}>
            <Button variant="ghost" size="sm" className="w-full justify-start text-zinc-600">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 bg-zinc-50 overflow-auto">{children}</main>
    </div>
  );
}
