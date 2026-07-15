import { getSession } from '@/lib/auth';
import { tienePermiso } from '@/lib/permisos';
import { getCategorias } from '@/actions/catalogos';
import CatalogoSimpleClient from '@/components/ui-custom/catalogo-simple-client';
import { crearCategoria, actualizarCategoria, eliminarCategoria, verificarUsoCategoria } from '@/actions/catalogos';

export default async function CategoriasPage() {
  const [session, items] = await Promise.all([getSession(), getCategorias()]);
  return (
    <CatalogoSimpleClient
      titulo="Categorías"
      items={items}
      onCreate={crearCategoria}
      onUpdate={actualizarCategoria}
      onDelete={eliminarCategoria}
      onCheckUso={verificarUsoCategoria}
      permisos={{
        crear:    tienePermiso(session, 'categorias', 'crear'),
        editar:   tienePermiso(session, 'categorias', 'editar'),
        eliminar: tienePermiso(session, 'categorias', 'eliminar'),
      }}
    />
  );
}
