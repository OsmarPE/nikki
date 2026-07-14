import { getCategorias } from '@/actions/catalogos';
import CatalogoSimpleClient from '@/components/ui-custom/catalogo-simple-client';
import { crearCategoria, actualizarCategoria, eliminarCategoria } from '@/actions/catalogos';

export default async function CategoriasPage() {
  const items = await getCategorias();
  return (
    <CatalogoSimpleClient
      titulo="Categorías"
      items={items}
      onCreate={crearCategoria}
      onUpdate={actualizarCategoria}
      onDelete={eliminarCategoria}
    />
  );
}
