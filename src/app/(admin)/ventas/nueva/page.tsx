import { getSesionAbiertaDetalle } from '@/actions/caja';
import CajaGateway from './caja-gateway';

export default async function NuevaVentaPage() {
  const sesion = await getSesionAbiertaDetalle();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <CajaGateway sesionInicial={sesion} />
    </div>
  );
}
