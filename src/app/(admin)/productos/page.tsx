import { getSession } from '@/lib/auth';
import { getProductos } from '@/actions/productos';
import { getCategorias } from '@/actions/catalogos';
import { getMarcas } from '@/actions/catalogos';
import { getColecciones } from '@/actions/catalogos';
import { tienePermiso } from '@/lib/permisos';
import ProductosClient from './productos-client';

export default async function ProductosPage() {
  const [session, productos, categorias, marcas, colecciones] = await Promise.all([
    getSession(),
    getProductos(),
    getCategorias(),
    getMarcas(),
    getColecciones(),
  ]);

  return (
    <ProductosClient
      productos={productos}
      categorias={categorias}
      marcas={marcas}
      colecciones={colecciones}
      permisos={{
        crear:    tienePermiso(session, 'productos', 'crear'),
        editar:   tienePermiso(session, 'productos', 'editar'),
        eliminar: tienePermiso(session, 'productos', 'eliminar'),
      }}
    />
  );
}
