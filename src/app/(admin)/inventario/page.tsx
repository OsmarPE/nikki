import { getMovimientos } from '@/actions/inventario';
import { getProductos } from '@/actions/productos';
import InventarioClient from './inventario-client';

export default async function InventarioPage() {
  const [movimientos, productos] = await Promise.all([getMovimientos(), getProductos()]);
  return <InventarioClient movimientos={movimientos} productos={productos} />;
}
