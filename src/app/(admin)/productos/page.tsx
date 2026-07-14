import { getProductos } from '@/actions/productos';
import { getCategorias } from '@/actions/catalogos';
import { getMarcas } from '@/actions/catalogos';
import { getColecciones } from '@/actions/catalogos';
import ProductosClient from './productos-client';

export default async function ProductosPage() {
  const [productos, categorias, marcas, colecciones] = await Promise.all([
    getProductos(),
    getCategorias(),
    getMarcas(),
    getColecciones(),
  ]);

  console.log(productos);

  return (
    <ProductosClient
      productos={productos}
      categorias={categorias}
      marcas={marcas}
      colecciones={colecciones}
    />
  );
}
