import { getSession } from '@/lib/auth';
import { getUsuarios } from '@/actions/usuarios';
import ConfiguracionClient from './configuracion-client';

export default async function ConfiguracionPage() {
  const [session, usuarios] = await Promise.all([
    getSession(),
    getUsuarios(),
  ]);

  return (
    <ConfiguracionClient
      usuarios={usuarios}
      usuarioActualId={Number(session?.sub ?? 0)}
    />
  );
}
