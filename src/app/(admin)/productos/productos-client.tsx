'use client';

import { useState, useTransition, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontalIcon, PencilIcon, Trash2Icon, Package, X, SlidersHorizontal, ChevronDown, Plus, FileDown, AlertTriangle, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Text } from '@/components/ui/text';
import { eliminarProducto, verificarDependenciasProducto } from '@/actions/productos';
import { formatCurrency } from '@/lib/utils';
import type { Producto, Categoria, Marca, Coleccion } from '@/types';

interface Props {
  productos: Producto[];
  categorias: Categoria[];
  marcas: Marca[];
  colecciones: Coleccion[];
  permisos: { crear: boolean; editar: boolean; eliminar: boolean };
}

// ─── Miniatura de producto con fallback si no hay imagen o falla al cargar ────
function ProductoThumb({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Package size={14} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className="h-8 w-8 rounded-md object-cover bg-muted shrink-0"
    />
  );
}

// ─── Panel de filtros ─────────────────────────────────────────────────────────
function CheckItem({ label, count, checked, onChange }: {
  label: string; count: number; checked: boolean; onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // El clic real cae sobre el <label> (el checkbox visual es un <span>), no
  // sobre el <input> oculto. El reenvío nativo label→input hace foco en el
  // input y el navegador desplaza el panel con scroll para "mostrarlo" —
  // muy notorio en filas fuera de vista (ej. Colección, al final de la
  // lista). Se evita el reenvío nativo y se enfoca manualmente sin scroll.
  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    onChange();
    inputRef.current?.focus({ preventScroll: true });
  }

  return (
    <label
      className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md hover:bg-accent cursor-pointer"
      onClick={handleClick}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <span className={[
          'h-3.5 w-3.5 rounded-[3px] border shrink-0 flex items-center justify-center transition-colors',
          checked ? 'bg-primary border-primary' : 'border-border bg-background',
        ].join(' ')}>
          {checked && (
            <svg viewBox="0 0 12 12" className="size-2.5 text-primary-foreground fill-none stroke-current" strokeWidth="2.5">
              <polyline points="1.5,6 5,9.5 10.5,2.5" />
            </svg>
          )}
        </span>
        <span className="text-sm truncate">{label}</span>
      </span>
      <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">{count}</span>
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        onChange={() => {}}
        className="sr-only"
      />
    </label>
  );
}

function FiltroPanelSection({ title, children, count }: {
  title: string; children: React.ReactNode; count: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 select-none">{title}</p>
        {count > 0 && (
          <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5">{count}</span>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ProductosFiltroPanel({
  marcas, categorias, colecciones, productos,
  marcasFiltro, categoriasFiltro, coleccionesFiltro,
  onMarcasChange, onCategoriasChange, onColeccionesChange, onClose,
}: {
  marcas: Marca[]; categorias: Categoria[]; colecciones: Coleccion[]; productos: Producto[];
  marcasFiltro: Set<string>; categoriasFiltro: Set<string>; coleccionesFiltro: Set<string>;
  onMarcasChange: (s: Set<string>) => void; onCategoriasChange: (s: Set<string>) => void;
  onColeccionesChange: (s: Set<string>) => void; onClose: () => void;
}) {
  function toggle(set: Set<string>, value: string, onChange: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    onChange(next);
  }

  const totalActivos = marcasFiltro.size + categoriasFiltro.size + coleccionesFiltro.size;

  function countByField(field: 'marca_nombre' | 'categoria_nombre' | 'coleccion_nombre', value: string) {
    return productos.filter(p => p[field] === value).length;
  }

  return (
    <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
        <p className="text-xs font-semibold">Filtros</p>
        {totalActivos > 0 && (
          <button type="button"
            onClick={() => { onMarcasChange(new Set()); onCategoriasChange(new Set()); onColeccionesChange(new Set()); }}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            Limpiar todo
          </button>
        )}
      </div>
      <div className="py-1.5 space-y-1 max-h-80 overflow-y-auto">
        {marcas.length > 0 && (
          <FiltroPanelSection title="Marca" count={marcasFiltro.size}>
            {marcas.map(m => (
              <CheckItem key={m.id} label={m.nombre} count={countByField('marca_nombre', m.nombre)}
                checked={marcasFiltro.has(m.nombre)} onChange={() => toggle(marcasFiltro, m.nombre, onMarcasChange)} />
            ))}
          </FiltroPanelSection>
        )}
        {categorias.length > 0 && (
          <>
            <div className="mx-3 my-1 border-t border-border/40" />
            <FiltroPanelSection title="Categoría" count={categoriasFiltro.size}>
              {categorias.map(c => (
                <CheckItem key={c.id} label={c.nombre} count={countByField('categoria_nombre', c.nombre)}
                  checked={categoriasFiltro.has(c.nombre)} onChange={() => toggle(categoriasFiltro, c.nombre, onCategoriasChange)} />
              ))}
            </FiltroPanelSection>
          </>
        )}
        {colecciones.length > 0 && (
          <>
            <div className="mx-3 my-1 border-t border-border/40" />
            <FiltroPanelSection title="Colección" count={coleccionesFiltro.size}>
              {colecciones.map(col => (
                <CheckItem key={col.id} label={col.nombre} count={countByField('coleccion_nombre', col.nombre)}
                  checked={coleccionesFiltro.has(col.nombre)} onChange={() => toggle(coleccionesFiltro, col.nombre, onColeccionesChange)} />
              ))}
            </FiltroPanelSection>
          </>
        )}
      </div>
      <div className="border-t border-border/60 px-3 py-2">
        {/* <Button type="button" onClick={onClose} className={'w-full h-8'} variant={'outline'}>
         Aplicar
        </Button> */}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ProductosClient({ productos: initial, categorias, marcas, colecciones, permisos }: Props) {
  const router = useRouter();
  const [productos] = useState(initial);
  const [busqueda, setBusqueda] = useState('');
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [marcasFiltro, setMarcasFiltro] = useState<Set<string>>(new Set());
  const [categoriasFiltro, setCategoriasFiltro] = useState<Set<string>>(new Set());
  const [coleccionesFiltro, setColeccionesFiltro] = useState<Set<string>>(new Set());
  const [soloSinStock, setSoloSinStock] = useState(false);
  const [, startTransition] = useTransition();
  const [exportando, setExportando] = useState(false);
  async function handleExport() {
    setExportando(true);
    try {
      const res = await fetch('/api/export/productos');
      if (!res.ok) { toast.error('Error al generar el Excel.'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `productos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel descargado.');
    } catch { toast.error('Error de red al exportar.'); }
    finally { setExportando(false); }
  }

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: number; nombre: string } | null>(null);
  const [blockedMsg, setBlockedMsg] = useState<string | undefined>();
  const [confirmDeps, setConfirmDeps] = useState<{ ventas: number; movimientos: number } | null>(null);

  const totalFiltrosActivos = marcasFiltro.size + categoriasFiltro.size + coleccionesFiltro.size;
  const hayFiltros = busqueda || totalFiltrosActivos > 0 || soloSinStock;

  const sinStockCount = useMemo(() =>
    productos.filter(p => Number(p.stock ?? 0) <= 0).length,
  [productos]);

  const filtrados = useMemo(() => productos.filter(p => {
    const matchBusqueda = !busqueda ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.sku.toLowerCase().includes(busqueda.toLowerCase());
    const matchMarca     = marcasFiltro.size === 0     || (p.marca_nombre      != null && marcasFiltro.has(p.marca_nombre));
    const matchCategoria = categoriasFiltro.size === 0 || (p.categoria_nombre  != null && categoriasFiltro.has(p.categoria_nombre));
    const matchColeccion = coleccionesFiltro.size === 0|| (p.coleccion_nombre  != null && coleccionesFiltro.has(p.coleccion_nombre));
    const matchStock      = !soloSinStock || Number(p.stock ?? 0) <= 0;
    return matchBusqueda && matchMarca && matchCategoria && matchColeccion && matchStock;
  }), [productos, busqueda, marcasFiltro, categoriasFiltro, coleccionesFiltro, soloSinStock]);

  function pedirEliminar(id: number, nombre: string) {
    setConfirmTarget({ id, nombre });
    setConfirmDeps(null);
    setConfirmOpen(true);
    // consultar dependencias en paralelo — sin bloquear la apertura del modal
    verificarDependenciasProducto(id).then(setConfirmDeps);
  }

  const handleEliminar = useCallback(() => {
    if (!confirmTarget) return;
    startTransition(async () => {
      const r = await eliminarProducto(confirmTarget.id);
      if (r?.error) {
        if (r.blocked) { setBlockedMsg(r.error); return; }
        toast.error(r.error);
        return;
      }
      toast.success('Producto eliminado.');
      setConfirmOpen(false);
      setConfirmTarget(null);
      setBlockedMsg(undefined);
      router.refresh();
    });
  }, [confirmTarget, router]);

  const columns = useMemo<ColumnDef<Producto>[]>(() => [
    {
      accessorKey: 'nombre', header: 'Producto',
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/productos/${row.original.id}`)}
          className="flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity"
        >
          <ProductoThumb src={row.original.imagen_url} alt={row.original.nombre} />
          <div>
            <p className="font-medium text-sm leading-tight">{row.original.nombre}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.sku}</p>
          </div>
        </button>
      ),
    },
    {
      accessorKey: 'precio', header: 'Precio',
      cell: ({ row }) => (
        <div>
          {row.original.precio_descuento ? (
            <>
              <p className="font-bold text-sm">{formatCurrency(row.original.precio_descuento)}</p>
              <p className="text-[11px] text-muted-foreground line-through">{formatCurrency(row.original.precio)}</p>
            </>
          ) : (
            <p className="font-medium text-sm">{formatCurrency(row.original.precio)}</p>
          )}
        </div>
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
    {
      accessorKey: 'marca_nombre', header: 'Marca',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.marca_nombre ?? '—'}</span>,
    },
    ...(permisos.editar || permisos.eliminar ? [{
      id: 'actions', header: '',
      cell: ({ row }: { row: { original: Producto } }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Abrir menú" />}>
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              {permisos.editar && (
                <DropdownMenuItem onClick={() => router.push(`/productos/${row.original.id}`)}>
                  <PencilIcon /> Editar
                </DropdownMenuItem>
              )}
              {permisos.editar && permisos.eliminar && <DropdownMenuSeparator />}
              {permisos.eliminar && (
                <DropdownMenuItem variant="destructive" onClick={() => pedirEliminar(row.original.id, row.original.nombre)}>
                  <Trash2Icon /> Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    } as ColumnDef<Producto>] : []),
  ], [router, handleEliminar, permisos.editar, permisos.eliminar]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Text as="h2" variant="title">Productos</Text>
          <Text variant="description">Productos del catálogo</Text>
        </div>
        {permisos.crear && (
          <Button size="sm" variant="outline" onClick={() => router.push('/productos/nuevo')} className="gap-1.5">
            <Plus size={14} /> Nuevo producto
          </Button>
        )}
      </div>

      {/* Barra de filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Buscar por nombre o SKU…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="h-8 w-64 text-sm"
        />

        <div className="relative">
          <button
            type="button"
            onClick={() => setFiltroOpen(o => !o)}
            className={[
              'inline-flex items-center gap-1.5 h-8 rounded-md border px-2.5 text-sm transition-colors',
              totalFiltrosActivos > 0
                ? 'border-primary/40 bg-primary/5 text-foreground font-medium'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            ].join(' ')}
          >
            <SlidersHorizontal size={13} />
            Filtros
            {totalFiltrosActivos > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold min-w-[16px] h-4 px-1">
                {totalFiltrosActivos}
              </span>
            )}
            <ChevronDown size={12} className={`opacity-50 transition-transform ${filtroOpen ? 'rotate-180' : ''}`} />
          </button>

          {filtroOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFiltroOpen(false)} />
              <ProductosFiltroPanel
                marcas={marcas}
                categorias={categorias}
                colecciones={colecciones.filter(c => !c.deleted_at)}
                productos={productos}
                marcasFiltro={marcasFiltro}
                categoriasFiltro={categoriasFiltro}
                coleccionesFiltro={coleccionesFiltro}
                onMarcasChange={setMarcasFiltro}
                onCategoriasChange={setCategoriasFiltro}
                onColeccionesChange={setColeccionesFiltro}
                onClose={() => setFiltroOpen(false)}
              />
            </>
          )}
        </div>

        <button
          type="button"
          disabled={sinStockCount === 0}
          onClick={() => setSoloSinStock(v => !v)}
          className={[
            'inline-flex items-center gap-1.5 h-8 rounded-md border px-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            soloSinStock
              ? 'border-destructive/40 bg-destructive/10 text-destructive font-medium'
              : sinStockCount > 0
                ? 'border-destructive/30 text-destructive hover:bg-destructive/5'
                : 'border-border text-muted-foreground',
          ].join(' ')}
        >
          <CircleAlert size={13} />
          {sinStockCount} sin stock
        </button>

        {hayFiltros && (
          <Button variant="outline" size="sm"
            onClick={() => { setBusqueda(''); setMarcasFiltro(new Set()); setCategoriasFiltro(new Set()); setColeccionesFiltro(new Set()); setSoloSinStock(false); }}
            className="h-8 px-2 gap-1.5">
            <X size={13} /> Limpiar
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtrados.length} {filtrados.length === 1 ? 'producto' : 'productos'}
        </span>
      </div>

      <DataTable columns={columns} data={filtrados} emptyMessage="Sin productos." pageSize={20} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={open => { setConfirmOpen(open); if (!open) { setConfirmTarget(null); setBlockedMsg(undefined); } }}
        title="Eliminar producto"
        description={`¿Estás seguro de que deseas eliminar "${confirmTarget?.nombre}"? Esta acción no se puede deshacer.`}
        warning={
          confirmDeps === null
            ? 'Verificando dependencias…'
            : confirmDeps.ventas > 0 || confirmDeps.movimientos > 0
              ? `Este producto aparece en ${confirmDeps.ventas > 0 ? `${confirmDeps.ventas} venta${confirmDeps.ventas > 1 ? 's' : ''}` : ''}${confirmDeps.ventas > 0 && confirmDeps.movimientos > 0 ? ' y ' : ''}${confirmDeps.movimientos > 0 ? `${confirmDeps.movimientos} movimiento${confirmDeps.movimientos > 1 ? 's' : ''} de inventario` : ''}. Eliminar podría impedir ver esos registros correctamente.`
              : undefined
        }
        confirmLabel="Sí, eliminar producto"
        onConfirm={handleEliminar}
        pending={false}
      />
    </div>
  );
}
