import { getMarcas } from '@/actions/catalogos';
import CatalogoSimpleClient from '@/components/ui-custom/catalogo-simple-client';
import { crearMarca, actualizarMarca, eliminarMarca, verificarUsoMarca } from '@/actions/catalogos';

export default async function MarcasPage() {
  const items = await getMarcas();
  return (
    <CatalogoSimpleClient
      titulo="Marcas"
      items={items}
      onCreate={crearMarca}
      onUpdate={actualizarMarca}
      onDelete={eliminarMarca}
      onCheckUso={verificarUsoMarca}
    />
  );
}
