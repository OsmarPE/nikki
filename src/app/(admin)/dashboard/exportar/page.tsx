import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUsuarios } from '@/actions/usuarios';
import ExportarClient from './exportar-client';

export default async function ExportarVentasPage() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') redirect('/sin-acceso');

  const usuarios = await getUsuarios();
  return (
    <ExportarClient
      vendedores={usuarios.map(u => ({ id: u.id, nombre: u.nombre, activo: Number(u.activo) === 1 }))}
    />
  );
}
