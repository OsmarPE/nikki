'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { Text } from '@/components/ui/text';
import { ProductoThumb } from '@/components/ui-custom/producto-thumb';
import { formatCurrency } from '@/lib/utils';
import { productosFiltrosQuery } from '@/lib/productos-filtros';
import type { Producto } from '@/types';

export type TipoCatalogo = 'categoria' | 'marca' | 'coleccion';

const CONFIG: Record<TipoCatalogo, { etiqueta: string; volver: { href: string; label: string } }> = {
  categoria: { etiqueta: 'Categoría', volver: { href: '/categorias',  label: 'Categorías' } },
  marca:     { etiqueta: 'Marca',     volver: { href: '/marcas',      label: 'Marcas' } },
  coleccion: { etiqueta: 'Colección', volver: { href: '/colecciones', label: 'Colecciones' } },
};

interface Props {
  tipo: TipoCatalogo;
  nombre: string;
  archivada?: boolean;
  productos: Producto[];
  /** Sin permiso de ver productos se muestra la lista, pero sin enlaces al detalle. */
  puedeVerProductos: boolean;
}

export default function CatalogoProductosClient({ tipo, nombre, archivada, productos, puedeVerProductos }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const { etiqueta, volver } = CONFIG[tipo];

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return !q ? productos : productos.filter(p =>
      p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [productos, busqueda]);

  // Abre la lista de Productos con este catálogo ya filtrado.
  const enProductos = `/productos${productosFiltrosQuery({
    busqueda: '', soloSinStock: false, pagina: 0,
    categorias:  tipo === 'categoria' ? [nombre] : [],
    marcas:      tipo === 'marca'     ? [nombre] : [],
    colecciones: tipo === 'coleccion' ? [nombre] : [],
  })}`;

  const columns = useMemo<ColumnDef<Producto>[]>(() => {
    // Se muestran los otros dos catálogos (en una categoría, su marca y colección).
    const extras: ColumnDef<Producto>[] = (
      [
        { key: 'categoria_nombre', header: 'Categoría', tipo: 'categoria' },
        { key: 'marca_nombre',     header: 'Marca',     tipo: 'marca' },
        { key: 'coleccion_nombre', header: 'Colección', tipo: 'coleccion' },
      ] as const
    ).filter(c => c.tipo !== tipo).map(c => ({
      accessorKey: c.key,
      header: c.header,
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original[c.key] ?? '—'}</span>,
    }));

    return [
      {
        accessorKey: 'nombre', header: 'Producto',
        cell: ({ row }) => {
          const contenido = (
            <>
              <ProductoThumb src={row.original.imagen_url} alt={row.original.nombre} />
              <div>
                <p className="font-medium text-sm leading-tight">{row.original.nombre}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{row.original.sku}</p>
              </div>
            </>
          );
          return puedeVerProductos ? (
            <Link href={`/productos/${row.original.id}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              {contenido}
            </Link>
          ) : (
            <div className="flex items-center gap-2.5">{contenido}</div>
          );
        },
      },
      {
        accessorKey: 'precio', header: 'Precio',
        cell: ({ row }) => row.original.precio_descuento ? (
          <div>
            <p className="font-bold text-sm">{formatCurrency(row.original.precio_descuento)}</p>
            <p className="text-[11px] text-muted-foreground line-through">{formatCurrency(row.original.precio)}</p>
          </div>
        ) : (
          <p className="font-medium text-sm">{formatCurrency(row.original.precio)}</p>
        ),
      },
      {
        accessorKey: 'stock', header: 'Stock',
        cell: ({ row }) => (
          <Badge variant={Number(row.original.stock) > 0 ? 'outline' : 'destructive'} className="font-mono text-xs">
            {row.original.stock ?? 0} pzas
          </Badge>
        ),
      },
      ...extras,
    ];
  }, [tipo, puedeVerProductos]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href={volver.href}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={13} /> {volver.label}
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">{etiqueta}</p>
            <div className="flex items-center gap-2">
              <Text as="h2" variant="title">{nombre}</Text>
              {archivada && <Badge variant="secondary" className="text-xs">Archivada</Badge>}
            </div>
            <Text variant="description">
              {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
            </Text>
          </div>
          {puedeVerProductos && productos.length > 0 && (
            <Link href={enProductos} className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-1.5' })}>
              Abrir en Productos <ArrowUpRight size={13} />
            </Link>
          )}
        </div>
      </div>

      <Input
        placeholder="Buscar por nombre o SKU…"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="h-8 w-64 text-sm"
      />

      <DataTable columns={columns} data={filtrados}
        emptyMessage={productos.length === 0 ? `Esta ${etiqueta.toLowerCase()} no tiene productos.` : 'Sin resultados.'}
        pageSize={20} />
    </div>
  );
}
