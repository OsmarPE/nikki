import { getSession } from '@/lib/auth';
import { tienePermiso } from '@/lib/permisos';
import { getMovimientos } from '@/actions/inventario';
import { getProductos } from '@/actions/productos';
import InventarioClient from './inventario-client';

export default async function InventarioPage() {
  const [session, movimientos, productos] = await Promise.all([
    getSession(),
    getMovimientos(),
    getProductos(),
  ]);
  return (
    <InventarioClient
      movimientos={movimientos}
      productos={productos}
      permisos={{ eliminar: tienePermiso(session, 'inventario', 'eliminar') }}
    />
  );
}
