import { getSession } from '@/lib/auth';
import { tienePermiso } from '@/lib/permisos';
import { getMarcas } from '@/actions/catalogos';
import CatalogoSimpleClient from '@/components/ui-custom/catalogo-simple-client';
import { crearMarca, actualizarMarca, eliminarMarca, verificarUsoMarca } from '@/actions/catalogos';

export default async function MarcasPage() {
  const [session, items] = await Promise.all([getSession(), getMarcas()]);
  return (
    <CatalogoSimpleClient
      titulo="Marcas"
      items={items}
      onCreate={crearMarca}
      onUpdate={actualizarMarca}
      onDelete={eliminarMarca}
      onCheckUso={verificarUsoMarca}
      permisos={{
        crear:    tienePermiso(session, 'marcas', 'crear'),
        editar:   tienePermiso(session, 'marcas', 'editar'),
        eliminar: tienePermiso(session, 'marcas', 'eliminar'),
      }}
    />
  );
}
