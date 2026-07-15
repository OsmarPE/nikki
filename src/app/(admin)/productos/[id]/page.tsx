import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { tienePermiso } from '@/lib/permisos';
import { getProducto } from '@/actions/productos';
import { getCategorias, getMarcas, getColecciones } from '@/actions/catalogos';
import { getMovimientos } from '@/actions/inventario';
import ProductoFormView from '../producto-form-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductoPage({ params }: Props) {
  const session = await getSession();
  if (!tienePermiso(session, 'productos', 'editar')) redirect('/productos');

  const { id } = await params;
  const productoId = parseInt(id);
  if (isNaN(productoId)) notFound();

  const [producto, categorias, marcas, colecciones, movimientos] = await Promise.all([
    getProducto(productoId),
    getCategorias(),
    getMarcas(),
    getColecciones(true),
    getMovimientos(productoId),
  ]);

  if (!producto) notFound();
  

  return (
    <ProductoFormView
      modo="editar"
      producto={producto}
      movimientos={movimientos}
      categorias={categorias}
      marcas={marcas}
      colecciones={colecciones}
    />
  );
}
