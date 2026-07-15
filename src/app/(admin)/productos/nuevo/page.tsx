import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { tienePermiso } from '@/lib/permisos';
import { getCategorias, getMarcas, getColecciones } from '@/actions/catalogos';
import ProductoFormView from '../producto-form-view';

export default async function NuevoProductoPage() {
  const session = await getSession();
  if (!tienePermiso(session, 'productos', 'crear')) redirect('/productos');

  const [categorias, marcas, colecciones] = await Promise.all([
    getCategorias(),
    getMarcas(),
    getColecciones(true),
  ]);

  return (
    <ProductoFormView
      modo="crear"
      categorias={categorias}
      marcas={marcas}
      colecciones={colecciones}
    />
  );
}
