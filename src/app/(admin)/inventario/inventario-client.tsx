'use client';
import { reload } from '@/hooks/use-reload';

import { useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { ClipboardList, X, Package, ArrowUpCircle, ArrowDownCircle, Search, PencilLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { FormField, TextareaField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';
import { registrarMovimiento } from '@/actions/inventario';
import { formatDateTime, cn } from '@/lib/utils';
import { zodResolver, movimientoSchema, type MovimientoFormValues } from '@/lib/validations';
import type { MovimientoInventario, Producto } from '@/types';

const TIPO_LABELS = { entrada: 'Entrada', salida: 'Salida' } as const;
const MOTIVO_LABELS = { venta: 'Venta', devolucion: 'Devolución', compra: 'Compra', ajuste: 'Ajuste' } as const;

const COLUMNS: ColumnDef<MovimientoInventario>[] = [
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
];

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
function ProductoCard({ p, onClick }: { p: Producto; onClick: () => void }) {
  const stock = Number(p.stock ?? 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40"
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
      <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">{stock}</Badge>
    </button>
  );
}

// ─── Buscador de producto: grilla filtrable + tarjeta de seleccionado ─────────
function ProductoPicker({
  productos, value, onChange, error,
}: {
  productos: Producto[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const seleccionado = productos.find(p => String(p.id) === value) ?? null;

  if (seleccionado) {
    const stock = Number(seleccionado.stock ?? 0);
    return (
      <div className="rounded-xl border border-border bg-muted/20 px-4 py-3.5 flex items-center gap-3.5">
        {seleccionado.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={seleccionado.imagen_url} alt={seleccionado.nombre}
            className="h-12 w-12 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Package size={18} className="text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{seleccionado.nombre}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] font-mono text-muted-foreground">{seleccionado.sku}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1">{stock} disp.</Badge>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => { setQuery(''); onChange(''); }}>
          <PencilLine size={12} />
          Cambiar
        </Button>
      </div>
    );
  }

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
          placeholder="Buscar por nombre o SKU…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className={cn('pl-8 h-9', error && 'border-destructive')}
        />
      </div>
      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
          Sin resultados para &quot;{query}&quot;
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-0.5">
          {filtrados.map(p => (
            <ProductoCard key={p.id} p={p} onClick={() => onChange(String(p.id))} />
          ))}
        </div>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function MovimientoForm({
  productos, onSubmit, pending, onCancel,
}: {
  productos: Producto[];
  onSubmit: (data: MovimientoFormValues) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<MovimientoFormValues>({
    resolver: zodResolver(movimientoSchema),
    defaultValues: { producto_id: '', tipo: 'entrada', motivo: 'compra', cantidad: '' as unknown as number, referencia: '', notas: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
      <div className="px-7 py-6 space-y-6">

        {/* Producto */}
        <Campo label="Producto">
          <Controller
            name="producto_id"
            control={control}
            render={({ field }) => (
              <ProductoPicker
                productos={productos}
                value={field.value}
                onChange={field.onChange}
                error={errors.producto_id?.message}
              />
            )}
          />
        </Campo>

        {/* Tipo, motivo, cantidad */}
        <div className="grid grid-cols-3 gap-4">
          <Campo label="Tipo">
            <Controller
              name="tipo"
              control={control}
              render={({ field }) => (
                <div className="inline-flex w-full rounded-lg border border-border bg-muted/30 p-0.5">
                  {(['entrada', 'salida'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => field.onChange(t)}
                      className={cn(
                        'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md h-8 text-xs font-semibold transition-all',
                        field.value === t
                          ? t === 'entrada'
                            ? 'bg-background shadow-sm text-green-700'
                            : 'bg-background shadow-sm text-red-600'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t === 'entrada' ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />}
                      {t === 'entrada' ? 'Entrada' : 'Salida'}
                    </button>
                  ))}
                </div>
              )}
            />
          </Campo>

          <Campo label="Motivo">
            <Controller
              name="motivo"
              control={control}
              render={({ field }) => (
                <Select
                  items={{ compra: 'Compra', devolucion: 'Devolución', ajuste: 'Ajuste', venta: 'Venta manual' }}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="h-9 w-full text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="devolucion">Devolución</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                    <SelectItem value="venta">Venta manual</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Campo>

          <FormField
            label="Cantidad"
            type="number"
            min="1"
            placeholder="0"
            error={errors.cantidad?.message}
            className="h-9"
            {...register('cantidad')}
          />
        </div>

        {/* Referencia y notas */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Referencia"
            hint="opcional"
            placeholder="Ej. folio de compra"
            error={errors.referencia?.message}
            className="h-9"
            {...register('referencia')}
          />
          <TextareaField
            label="Notas"
            hint="opcional"
            rows={1}
            placeholder="Observaciones adicionales…"
            error={errors.notas?.message}
            {...register('notas')}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-7 py-4 border-t border-border/60">
        <Button type="button" variant="ghost" onClick={onCancel}>
          <X size={13} />
          Cancelar
        </Button>
        <Button type="submit" variant="default" size="sm" disabled={pending}>
          {pending ? 'Registrando…' : 'Registrar movimiento'}
        </Button>
      </div>
    </form>
  );
}

export default function InventarioClient({
  movimientos: initial, productos,
}: { movimientos: MovimientoInventario[]; productos: Producto[] }) {
  const [modal, setModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [pending, startTransition] = useTransition();

  const filtrados = busqueda
    ? initial.filter(m => (m.producto_nombre ?? '').toLowerCase().includes(busqueda.toLowerCase()))
    : initial;

  function handleSubmit(data: MovimientoFormValues) {
    startTransition(async () => {
      const r = await registrarMovimiento({
        producto_id: parseInt(data.producto_id),
        tipo: data.tipo,
        motivo: data.motivo,
        cantidad: Number(data.cantidad),
        referencia: data.referencia || undefined,
        notas: data.notas || undefined,
      });
      if (r?.error) { toast.error(r.error); return; }
      toast.success('Movimiento registrado.');
      setModal(false);
      reload();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Text as="h2" variant="title">Movimientos de Inventario</Text>
          <Text variant="description">Registro de entradas y salidas</Text>
        </div>
        <Button variant={'outline'} onClick={() => setModal(true)}>
        <ClipboardList size={13} />
        Registrar movimiento
      </Button>
      </div>

      <Input
        placeholder="Buscar por producto…"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="max-w-sm"
      />

      <DataTable columns={COLUMNS} data={filtrados} emptyMessage="Sin movimientos." pageSize={20} />

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
                  <DialogPrimitive.Title className="text-base font-semibold leading-tight">Registrar movimiento</DialogPrimitive.Title>
                  <p className="text-xs text-muted-foreground mt-0.5">Actualiza el inventario de un producto</p>
                </div>
              </div>
              <DialogPrimitive.Close render={<Button variant="ghost" size="icon" className="shrink-0" />}>
                <X size={16} />
                <span className="sr-only">Cerrar</span>
              </DialogPrimitive.Close>
            </div>

            {modal && (
              <div className="overflow-y-auto">
                <MovimientoForm
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
    </div>
  );
}
