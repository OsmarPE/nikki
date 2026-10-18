import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { tienePermiso } from '@/lib/permisos';
import { getCatalogoItem } from '@/actions/catalogos';
import { getProductosPorCatalogo } from '@/actions/productos';
import CatalogoProductosClient, { type TipoCatalogo } from './catalogo-productos-client';

// Página compartida por /categorias/[id], /marcas/[id] y /colecciones/[id].
export default async function CatalogoDetallePage({ tipo, params }: {
  tipo: TipoCatalogo;
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const [session, item, productos] = await Promise.all([
    getSession(),
    getCatalogoItem(tipo, id),
    getProductosPorCatalogo(tipo, id),
  ]);
  if (!item) notFound();

  return (
    <CatalogoProductosClient
      tipo={tipo}
      nombre={item.nombre}
      archivada={item.archivada}
      productos={productos}
      puedeVerProductos={tienePermiso(session, 'productos', 'ver')}
    />
  );
}
