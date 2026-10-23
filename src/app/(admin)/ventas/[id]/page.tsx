import { notFound } from 'next/navigation';
import { getVentaDetalle } from '@/actions/ventas';
import { getSession } from '@/lib/auth';
import { tienePermiso } from '@/lib/permisos';
import { getSesionAbierta } from '@/actions/caja';
import VentaDetalleView from './venta-detalle-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VentaDetallePage({ params }: Props) {
  const { id } = await params;
  const ventaId = parseInt(id);
  if (isNaN(ventaId)) notFound();

  const [venta, session, sesionCaja] = await Promise.all([
    getVentaDetalle(ventaId),
    getSession(),
    getSesionAbierta(),
  ]);

  if (!venta) notFound();

  // Vendedor solo ve sus propias ventas de contado — las ventas a crédito son
  // visibles para cualquier vendedor, porque cualquiera con caja abierta puede
  // registrar un abono, no solo quien hizo la venta original.
  if (session?.rol !== 'admin' && venta.tipo_venta !== 'credito' && String(venta.usuario_id) !== session?.sub) {
    notFound();
  }

  return (
    <VentaDetalleView
      venta={venta}
      puedeAbonar={tienePermiso(session, 'ventas', 'crear')}
      cajaAbierta={sesionCaja !== null}
    />
  );
}
