import { getVentas, getAbonosRecientes } from '@/actions/ventas';
import VentasClient from './ventas-client';

export default async function VentasPage() {
  const [ventas, abonos] = await Promise.all([getVentas(), getAbonosRecientes()]);
  return <VentasClient ventas={ventas} abonos={abonos} />;
}
