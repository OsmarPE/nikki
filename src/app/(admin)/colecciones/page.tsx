import { getColecciones } from '@/actions/catalogos';
import ColeccionesClient from './colecciones-client';

export default async function ColeccionesPage() {
  const items = await getColecciones(true);
  return <ColeccionesClient items={items} />;
}
