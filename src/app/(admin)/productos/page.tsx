import { getSession } from '@/lib/auth';
import { getProductos } from '@/actions/productos';
import { getCategorias } from '@/actions/catalogos';
import { getMarcas } from '@/actions/catalogos';
import { getColecciones } from '@/actions/catalogos';
import { tienePermiso } from '@/lib/permisos';
import { parseProductosFiltros } from '@/lib/productos-filtros';
import ProductosClient from './productos-client';

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, productos, categorias, marcas, colecciones, sp] = await Promise.all([
    getSession(),
    getProductos(),
    getCategorias(),
    getMarcas(),
    getColecciones(),
    searchParams,
  ]);

  return (
    <ProductosClient
      productos={productos}
      categorias={categorias}
      marcas={marcas}
      colecciones={colecciones}
      filtrosIniciales={parseProductosFiltros(sp)}
      permisos={{
        crear:    tienePermiso(session, 'productos', 'crear'),
        editar:   tienePermiso(session, 'productos', 'editar'),
        eliminar: tienePermiso(session, 'productos', 'eliminar'),
      }}
    />
  );
}
