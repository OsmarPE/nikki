'use client';
import { reload } from '@/hooks/use-reload';

import { useState, useTransition, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { ClipboardList, X, Package, ArrowUpCircle, ArrowDownCircle, Search, Check, Trash2Icon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormField, TextareaField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';
import { registrarMovimientosBatch, eliminarMovimiento, type MovimientoBatchLinea } from '@/actions/inventario';
import { formatDateTime, cn } from '@/lib/utils';
import { movimientosBatchSchema } from '@/lib/validations';
import type { MovimientoInventario, Producto } from '@/types';

const TIPO_LABELS = { entrada: 'Entrada', salida: 'Salida' } as const;
const MOTIVO_LABELS = { venta: 'Venta', devolucion: 'Devolución', compra: 'Compra', ajuste: 'Ajuste' } as const;

// ─── Campo con etiqueta, estilo minimalista consistente con la ficha de producto ──
function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Tarjeta compacta de producto (grilla del buscador) ────────────────────────
function ProductoCard({ p, onClick, added }: { p: Producto; onClick: () => void; added?: boolean }) {
  const stock = Number(p.stock ?? 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
        added ? 'border-foreground/30 bg-muted/40' : 'border-border hover:border-foreground/30 hover:bg-muted/40',
      )}
    >
      {p.imagen_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.imagen_url} alt={p.nombre} className="h-9 w-9 rounded-md object-cover shrink-0" />
      ) : (
        <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Package size={13} className="text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{p.nombre}</p>
        <span className="text-[10px] font-mono text-muted-foreground">{p.sku}</span>
      </div>
      {added ? <Check size={13} className="text-foreground shrink-0" /> : (
        <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">{stock}</Badge>
      )}
    </button>
  );
}

// ─── Buscador: grilla filtrable que agrega productos al lote (no "selecciona
// uno", agrega N — clic repetido sobre el mismo producto suma cantidad) ───────
function BuscadorProductoLote({
  productos, lineas, onAgregar,
}: {
  productos: Producto[];
  lineas: LineaMovimiento[];
  onAgregar: (p: Producto) => void;
}) {
  const [query, setQuery] = useState('');
  const filtrados = query.trim()
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(query.trim().toLowerCase()) ||
        p.sku.toLowerCase().includes(query.trim().toLowerCase()))
    : productos;

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Buscar por nombre o SKU para agregar al lote…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-8 h-9"
        />
      </div>
      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          Sin resultados para &quot;{query}&quot;
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-0.5">
          {filtrados.map(p => (
            <ProductoCard
              key={p.id}
              p={p}
              added={lineas.some(l => l.producto.id === p.id)}
              onClick={() => onAgregar(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface LineaMovimiento {
  producto: Producto;
  tipo: 'entrada' | 'salida';
  motivo: 'devolucion' | 'compra' | 'ajuste';
  cantidad: number | '';
}

// ─── Fila editable de una línea del lote ──────────────────────────────────────
function LineaRow({
  linea, onChange, onRemove,
}: {
  linea: LineaMovimiento;
  onChange: (patch: Partial<LineaMovimiento>) => void;
  onRemove: () => void;
}) {
  const stock = Number(linea.producto.stock ?? 0);
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-border/60 last:border-b-0">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {linea.producto.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={linea.producto.imagen_url} alt={linea.producto.nombre} className="h-9 w-9 rounded-md object-cover shrink-0" />
        ) : (
          <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Package size={13} className="text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{linea.producto.nombre}</p>
          <span className="text-[10px] font-mono text-muted-foreground">{linea.producto.sku} · {stock} disp.</span>
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 shrink-0">
        {(['entrada', 'salida'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ tipo: t })}
            aria-label={t}
            className={cn(
              'inline-flex items-center justify-center rounded-md h-7 w-7 transition-all',
              linea.tipo === t
                ? t === 'entrada' ? 'bg-background shadow-sm text-green-700' : 'bg-background shadow-sm text-red-600'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'entrada' ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />}
          </button>
        ))}
      </div>

      <Select
        items={{ compra: 'Compra', devolucion: 'Devolución', ajuste: 'Ajuste' }}
        value={linea.motivo}
        onValueChange={v => onChange({ motivo: v as LineaMovimiento['motivo'] })}
      >
        <SelectTrigger className="h-8 w-28 text-xs shrink-0"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="compra">Compra</SelectItem>
          <SelectItem value="devolucion">Devolución</SelectItem>
          <SelectItem value="ajuste">Ajuste</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="number"
        min={1}
        value={linea.cantidad}
        onChange={e => onChange({ cantidad: e.target.value === '' ? '' : Number(e.target.value) })}
        className="h-8 w-16 text-xs text-center shrink-0"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="Quitar del lote"
      >
        <X size={13} />
      </Button>
    </div>
  );
}

function MovimientosBatchForm({
  productos, onSubmit, pending, onCancel,
}: {
  productos: Producto[];
  onSubmit: (data: { lineas: MovimientoBatchLinea[]; referencia?: string; notas?: string }) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const [lineas, setLineas] = useState<LineaMovimiento[]>([]);
  const [tipoDefault, setTipoDefault] = useState<'entrada' | 'salida'>('entrada');
  const [motivoDefault, setMotivoDefault] = useState<'devolucion' | 'compra' | 'ajuste'>('compra');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  function agregarProducto(p: Producto) {
    setError(null);
    setLineas(prev => {
      const existente = prev.find(l => l.producto.id === p.id);
      if (existente) {
        return prev.map(l => l.producto.id === p.id
          ? { ...l, cantidad: (Number(l.cantidad) || 0) + 1 }
          : l);
      }
      return [...prev, { producto: p, tipo: tipoDefault, motivo: motivoDefault, cantidad: 1 }];
    });
  }

  function actualizarLinea(productoId: number, patch: Partial<LineaMovimiento>) {
    setLineas(prev => prev.map(l => l.producto.id === productoId ? { ...l, ...patch } : l));
  }

  function eliminarLinea(productoId: number) {
    setLineas(prev => prev.filter(l => l.producto.id !== productoId));
  }

  function aplicarATodas() {
    setLineas(prev => prev.map(l => ({ ...l, tipo: tipoDefault, motivo: motivoDefault })));
  }

  function handleFormSubmit() {
    const payload = {
      lineas: lineas.map(l => ({
        producto_id: l.producto.id,
        tipo: l.tipo,
        motivo: l.motivo,
        cantidad: l.cantidad,
      })),
      referencia: referencia || undefined,
      notas: notas || undefined,
    };
    const parsed = movimientosBatchSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos del lote.');
      return;
    }
    setError(null);
    onSubmit(parsed.data as { lineas: MovimientoBatchLinea[]; referencia?: string; notas?: string });
  }

  return (
    <div className="flex flex-col">
      <div className="px-7 py-6 space-y-5">
        <Campo label="Agregar productos al lote">
          <BuscadorProductoLote productos={productos} lineas={lineas} onAgregar={agregarProducto} />
        </Campo>

        {lineas.length > 0 && (
          <>
            <div className="flex items-end gap-3 rounded-lg border border-dashed border-border px-3 py-2.5">
              <Campo label="Tipo por defecto">
                <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
                  {(['entrada', 'salida'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoDefault(t)}
                      className={cn(
                        'inline-flex items-center justify-center gap-1.5 rounded-md h-8 px-2.5 text-xs font-semibold transition-all',
                        tipoDefault === t
                          ? t === 'entrada' ? 'bg-background shadow-sm text-green-700' : 'bg-background shadow-sm text-red-600'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t === 'entrada' ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />}
                      {t === 'entrada' ? 'Entrada' : 'Salida'}
                    </button>
                  ))}
                </div>
              </Campo>

              <Campo label="Motivo por defecto">
                <Select
                  items={{ compra: 'Compra', devolucion: 'Devolución', ajuste: 'Ajuste' }}
                  value={motivoDefault}
                  onValueChange={v => setMotivoDefault(v as typeof motivoDefault)}
                >
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="devolucion">Devolución</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </Campo>

              <Button type="button" variant="outline" size="sm" onClick={aplicarATodas}>
                Aplicar a las {lineas.length} líneas
              </Button>
            </div>

            <div className="rounded-xl border border-border px-3">
              {lineas.map(l => (
                <LineaRow
                  key={l.producto.id}
                  linea={l}
                  onChange={patch => actualizarLinea(l.producto.id, patch)}
                  onRemove={() => eliminarLinea(l.producto.id)}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Referencia"
                hint="opcional, aplica a todo el lote"
                placeholder="Ej. folio de compra"
                value={referencia}
                onChange={e => setReferencia(e.target.value)}
                className="h-9"
              />
              <TextareaField
                label="Notas"
                hint="opcional, aplica a todo el lote"
                rows={1}
                placeholder="Observaciones adicionales…"
                value={notas}
                onChange={e => setNotas(e.target.value)}
              />
            </div>
          </>
        )}

        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>

      <div className="flex items-center justify-between gap-2 px-7 py-4 border-t border-border/60">
        <span className="text-xs text-muted-foreground">
          {lineas.length > 0
            ? `${lineas.length} producto${lineas.length === 1 ? '' : 's'} en el lote`
            : 'Agrega productos para comenzar'}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            <X size={13} />
            Cancelar
          </Button>
          <Button type="button" variant="default" size="sm" disabled={pending || lineas.length === 0} onClick={handleFormSubmit}>
            {pending
              ? 'Registrando…'
              : `Registrar ${lineas.length || ''} movimiento${lineas.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InventarioClient({
  movimientos: initial, productos, permisos,
}: { movimientos: MovimientoInventario[]; productos: Producto[]; permisos: { eliminar: boolean } }) {
  const [modal, setModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [pending, startTransition] = useTransition();
  const [confirmTarget, setConfirmTarget] = useState<MovimientoInventario | null>(null);

  const filtrados = busqueda
    ? initial.filter(m => (m.producto_nombre ?? '').toLowerCase().includes(busqueda.toLowerCase()))
    : initial;

  function handleSubmit(data: { lineas: MovimientoBatchLinea[]; referencia?: string; notas?: string }) {
    startTransition(async () => {
      const r = await registrarMovimientosBatch(data);
      if (r?.error) { toast.error(r.error); return; }
      toast.success(
        data.lineas.length === 1
          ? 'Movimiento registrado.'
          : `${data.lineas.length} movimientos registrados.`,
      );
      setModal(false);
      reload();
    });
  }

  const handleEliminar = useCallback(() => {
    if (!confirmTarget) return;
    startTransition(async () => {
      const r = await eliminarMovimiento(confirmTarget.id);
      if (r?.error) { toast.error(r.error); return; }
      toast.success('Movimiento eliminado y stock revertido.');
      setConfirmTarget(null);
      reload();
    });
  }, [confirmTarget]);

  const columns = useMemo<ColumnDef<MovimientoInventario>[]>(() => [
    { accessorKey: 'producto_nombre', header: 'Producto' },
    {
      accessorKey: 'tipo', header: 'Tipo',
      cell: ({ row }) => (
        <Badge
          variant={'outline'}
          className={row.original.tipo === 'entrada' ? 'text-green-700 border-green-300' : 'text-red-600 border-red-300'}
        >
          {TIPO_LABELS[row.original.tipo]}
        </Badge>
      ),
    },
    {
      accessorKey: 'motivo', header: 'Motivo',
      cell: ({ row }) => <span className="capitalize text-muted-foreground text-sm">{MOTIVO_LABELS[row.original.motivo]}</span>,
    },
    { accessorKey: 'cantidad', header: 'Cantidad', cell: ({ row }) => <span className="font-semibold font-mono">{row.original.cantidad}</span> },
    { accessorKey: 'usuario_nombre', header: 'Usuario', cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.usuario_nombre}</span> },
    { accessorKey: 'referencia', header: 'Referencia', cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.referencia ?? '—'}</span> },
    { accessorKey: 'creado_at', header: 'Fecha', cell: ({ row }) => <span className="text-muted-foreground text-sm tabular-nums">{formatDateTime(row.original.creado_at)}</span> },
    ...(permisos.eliminar ? [{
      id: 'actions', header: '',
      cell: ({ row }: { row: { original: MovimientoInventario } }) => (
        row.original.motivo === 'venta' ? null : (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Eliminar movimiento"
              onClick={() => setConfirmTarget(row.original)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        )
      ),
    } as ColumnDef<MovimientoInventario>] : []),
  ], [permisos.eliminar]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Text as="h2" variant="title">Movimientos de Inventario</Text>
          <Text variant="description">Registro de entradas y salidas</Text>
        </div>
        <Button variant={'outline'} onClick={() => setModal(true)}>
        <ClipboardList size={13} />
        Registrar movimientos
      </Button>
      </div>

      <Input
        placeholder="Buscar por producto…"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="max-w-sm"
      />

      <DataTable columns={columns} data={filtrados} emptyMessage="Sin movimientos." pageSize={20} />

      <DialogPrimitive.Root open={modal} onOpenChange={setModal}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Popup
            className={cn(
              'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
              'w-[92vw] max-w-250 max-h-[88vh]',
              'flex flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none',
              'duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-7 pt-6 pb-5 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <ClipboardList size={16} className="text-muted-foreground" />
                </div>
                <div>
                  <DialogPrimitive.Title className="text-base font-semibold leading-tight">Registrar movimientos</DialogPrimitive.Title>
                  <p className="text-xs text-muted-foreground mt-0.5">Agrega varios productos y regístralos en un solo lote</p>
                </div>
              </div>
              <DialogPrimitive.Close render={<Button variant="ghost" size="icon" className="shrink-0" />}>
                <X size={16} />
                <span className="sr-only">Cerrar</span>
              </DialogPrimitive.Close>
            </div>

            {modal && (
              <div className="overflow-y-auto">
                <MovimientosBatchForm
                  key={String(modal)}
                  productos={productos}
                  onSubmit={handleSubmit}
                  pending={pending}
                  onCancel={() => setModal(false)}
                />
              </div>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={open => !open && setConfirmTarget(null)}
        title="Eliminar movimiento"
        description={
          confirmTarget
            ? `¿Eliminar este movimiento de ${confirmTarget.cantidad} ${TIPO_LABELS[confirmTarget.tipo].toLowerCase()} de "${confirmTarget.producto_nombre}"? El stock se ajustará automáticamente para revertirlo.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        onConfirm={handleEliminar}
        pending={pending}
      />
    </div>
  );
}
