import { getSesionAbierta } from '@/actions/caja';
import { getSession } from '@/lib/auth';
import AbrirCajaForm from './abrir-caja-form';
import PosInterface from './pos-interface';

export default async function PosPage() {
  const [sesion, session] = await Promise.all([getSesionAbierta(), getSession()]);

  if (!sesion) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <AbrirCajaForm />
      </div>
    );
  }

  return <PosInterface sesion={sesion} usuarioNombre={session?.nombre ?? ''} />;
}
