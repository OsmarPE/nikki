import { notFound } from 'next/navigation';
import { getVentaDetalle } from '@/actions/ventas';
import { getSession } from '@/lib/auth';
import VentaDetalleView from './venta-detalle-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VentaDetallePage({ params }: Props) {
  const { id } = await params;
  const ventaId = parseInt(id);
  if (isNaN(ventaId)) notFound();

  const [venta, session] = await Promise.all([
    getVentaDetalle(ventaId),
    getSession(),
  ]);

  if (!venta) notFound();

  // Vendedor solo ve sus propias ventas
  if (session?.rol !== 'admin' && String(venta.usuario_id) !== session?.sub) {
    notFound();
  }

  return <VentaDetalleView venta={venta} />;
}
