import { getCategorias, getMarcas, getColecciones } from '@/actions/catalogos';
import ProductoFormView from '../producto-form-view';

export default async function NuevoProductoPage() {
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
