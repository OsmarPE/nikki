import { getSesionesCaja, getResumenCajaHoy } from '@/actions/caja';
import CajaClient from './caja-client';

export default async function CajaPage() {
  const [sesiones, resumen] = await Promise.all([
    getSesionesCaja(),
    getResumenCajaHoy(),
  ]);

  return <CajaClient sesiones={sesiones} resumen={resumen} />;
}
