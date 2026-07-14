'use client';
import { reload } from '@/hooks/use-reload';

import { useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { ClipboardList, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { FormField, TextareaField, FieldGroup } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';
import { registrarMovimiento } from '@/actions/inventario';
import { formatDate } from '@/lib/utils';
import { movimientoSchema, type MovimientoFormValues } from '@/lib/validations';
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
  { accessorKey: 'creado_at', header: 'Fecha', cell: ({ row }) => <span className="text-muted-foreground text-sm">{formatDate(row.original.creado_at)}</span> },
];

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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-0">

      {/* Producto */}
      <div className="px-5 py-4 border-b border-border/60">
        <FieldGroup label="Producto">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Seleccionar producto</Label>
            <Controller
              name="producto_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={`h-8 w-full text-sm ${errors.producto_id ? 'border-destructive' : ''}`}>
                    <SelectValue placeholder="Elige un producto…" />
                  </SelectTrigger>
                  <SelectContent className={'w-full'}>
                    {productos.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nombre} <span className="text-muted-foreground font-mono text-xs ml-1">({p.sku})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.producto_id && <p className="text-[11px] text-destructive">{errors.producto_id.message}</p>}
          </div>
        </FieldGroup>
      </div>

      {/* Tipo y motivo */}
      <div className="px-5 py-4 border-b border-border/60">
        <FieldGroup label="Tipo de movimiento">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo</Label>
              <Controller
                name="tipo"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-8 w-full text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">↑ Entrada</SelectItem>
                      <SelectItem value="salida">↓ Salida</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Motivo</Label>
              <Controller
                name="motivo"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-8 w-full text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compra">Compra</SelectItem>
                      <SelectItem value="devolucion">Devolución</SelectItem>
                      <SelectItem value="ajuste">Ajuste</SelectItem>
                      <SelectItem value="venta">Venta manual</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </FieldGroup>
      </div>

      {/* Detalles */}
      <div className="px-5 py-4 space-y-3">
        <FieldGroup label="Detalles">
          <FormField
            label="Cantidad"
            type="number"
            min="1"
            placeholder="0"
            error={errors.cantidad?.message}
            {...register('cantidad')}
          />
          <FormField
            label="Referencia"
            hint="opcional"
            placeholder="Ej. folio de compra"
            error={errors.referencia?.message}
            {...register('referencia')}
          />
          <TextareaField
            label="Notas"
            hint="opcional"
            rows={2}
            placeholder="Observaciones adicionales…"
            error={errors.notas?.message}
            {...register('notas')}
          />
        </FieldGroup>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
        <X size={13} />
        Cancelar
      </Button>
        <Button type="submit" variant="default" size="sm" disabled={pending}>
          {pending ? 'Registrando…' : 'Registrar'}
        </Button>
      </DialogFooter>
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

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60">
            <DialogTitle className="text-sm font-semibold">Registrar movimiento</DialogTitle>
          </DialogHeader>
          {modal && (
            <div className="max-h-[80vh] overflow-y-auto">
              <MovimientoForm
                key={String(modal)}
                productos={productos}
                onSubmit={handleSubmit}
                pending={pending}
                onCancel={() => setModal(false)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
