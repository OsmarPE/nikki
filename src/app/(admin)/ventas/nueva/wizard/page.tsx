import { getSesionAbierta } from '@/actions/caja';
import { getClientes } from '@/actions/clientes';
import { getProductos } from '@/actions/productos';
import { redirect } from 'next/navigation';
import NuevaVentaClient from './nueva-venta-client';

export default async function WizardVentaPage() {
  const [sesion, clientes, productos] = await Promise.all([
    getSesionAbierta(),
    getClientes(),
    getProductos(),
  ]);

  // Si no hay caja abierta, volver al gateway
  if (!sesion) redirect('/ventas/nueva');

  return (
    <NuevaVentaClient
      sesionCajaId={sesion.id}
      clientesIniciales={clientes}
      productosIniciales={productos}
    />
  );
}
