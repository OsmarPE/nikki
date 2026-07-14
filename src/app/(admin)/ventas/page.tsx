import { getVentas } from '@/actions/ventas';
import VentasClient from './ventas-client';

export default async function VentasPage() {
  const ventas = await getVentas();
  return <VentasClient ventas={ventas} />;
}
