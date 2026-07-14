'use client';

import { reload } from '@/hooks/use-reload';
import { useState, useTransition, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontalIcon, PencilIcon, Trash2Icon, ArchiveRestoreIcon, Layers2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';
import { catalogoNombreSchema, type CatalogoNombreValues } from '@/lib/validations';
import { crearColeccion, actualizarColeccion, eliminarColeccionLogico, restaurarColeccion } from '@/actions/catalogos';
import type { Coleccion } from '@/types';

// ─── Formulario dentro del Sheet ─────────────────────────────────────────────
function ColeccionForm({
  defaultValues,
  onSubmit,
  pending,
  onCancel,
  modo,
}: {
  defaultValues: CatalogoNombreValues;
  onSubmit: (data: CatalogoNombreValues) => void;
  pending: boolean;
  onCancel: () => void;
  modo: 'crear' | 'editar';
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<CatalogoNombreValues>({
    resolver: zodResolver(catalogoNombreSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="flex-1 px-4 py-6">
        <FormField
          label="Nombre de la colección"
          placeholder="Ej. Verano 2025"
          error={errors.nombre?.message}
          autoFocus
          {...register('nombre')}
        />
      </div>
      <SheetFooter className="border-t border-border/60 px-4 py-3 flex-row justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          <span className="mr-1 opacity-60">×</span> Cancelar
        </Button>
        <Button type="submit" variant="default" size="sm" disabled={pending}>
          {pending ? 'Guardando…' : modo === 'crear' ? 'Crear' : 'Guardar'}
        </Button>
      </SheetFooter>
    </form>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ColeccionesClient({ items: initial }: { items: Coleccion[] }) {
  const [items] = useState(initial);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Coleccion | null>(null);
  const [blockedMsg, setBlockedMsg] = useState<string | undefined>();
  const [sheet, setSheet] = useState<{ modo: 'crear' | 'editar'; id?: number; nombre?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function abrirCrear() { setSheet({ modo: 'crear' }); }
  function abrirEditar(c: Coleccion) { setSheet({ modo: 'editar', id: c.id, nombre: c.nombre }); }

  function handleSubmit(data: CatalogoNombreValues) {
    startTransition(async () => {
      const r = sheet?.modo === 'crear'
        ? await crearColeccion(data.nombre)
        : await actualizarColeccion(sheet!.id!, data.nombre);
      if (r?.error) { toast.error(r.error); return; }
      toast.success(sheet?.modo === 'crear' ? 'Colección creada.' : 'Colección actualizada.');
      setSheet(null);
      reload();
    });
  }

  function pedirArchivar(col: Coleccion) {
    setConfirmTarget(col);
    setConfirmOpen(true);
  }

  const handleArchivar = useCallback(() => {
    if (!confirmTarget) return;
    startTransition(async () => {
      const r = await eliminarColeccionLogico(confirmTarget.id);
      if (r?.error) { toast.error(r.error); return; }
      toast.success('Colección archivada.');
      setConfirmOpen(false);
      setConfirmTarget(null);
      reload();
    });
  }, [confirmTarget]);

  const handleRestaurar = useCallback((id: number) => {
    startTransition(async () => {
      const r = await restaurarColeccion(id);
      if (r?.error) { toast.error(r.error); return; }
      toast.success('Colección restaurada.');
      reload();
    });
  }, []);

  const columns = useMemo<ColumnDef<Coleccion>[]>(() => [
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ row }) => (
        <div className={`flex items-center gap-2 text-sm ${row.original.deleted_at ? 'text-muted-foreground line-through' : ''}`}>
          <Layers2 size={13} className="text-muted-foreground shrink-0" />
          {row.original.nombre}
        </div>
      ),
    },
    {
      accessorKey: 'deleted_at',
      header: 'Estado',
      cell: ({ row }) => row.original.deleted_at
        ? <Badge variant="secondary" className="text-xs">Archivada</Badge>
        : <Badge variant="outline" className="text-xs text-green-700 border-green-300">Activa</Badge>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Abrir menú" />}>
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              {!row.original.deleted_at && (
                <DropdownMenuItem onClick={() => abrirEditar(row.original)}>
                  <PencilIcon /> Editar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {row.original.deleted_at ? (
                <DropdownMenuItem onClick={() => handleRestaurar(row.original.id)}>
                  <ArchiveRestoreIcon /> Restaurar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem variant="destructive" onClick={() => pedirArchivar(row.original)}>
                  <Trash2Icon /> Archivar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [handleArchivar, handleRestaurar]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Text as="h2" variant="title">Colecciones</Text>
          <Text variant="description">Administra las colecciones de temporada</Text>
        </div>
        <Button size="sm" onClick={abrirCrear} variant={'outline'}>
          <Plus size={14} className="mr-1.5" />
          Nueva colección
        </Button>
      </div>

      <DataTable columns={columns} data={items} emptyMessage="Sin colecciones." pageSize={15} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={open => { setConfirmOpen(open); if (!open) { setConfirmTarget(null); setBlockedMsg(undefined); } }}
        title="Archivar colección"
        description={`¿Estás seguro de que deseas archivar "${confirmTarget?.nombre}"? Podrás restaurarla después desde esta misma pantalla.`}
        blocked={blockedMsg}
        warning={!blockedMsg ? "Los productos de esta colección no se verán afectados. Solo dejará de aparecer como opción al crear o editar productos." : undefined}
        confirmLabel="Sí, archivar"
        onConfirm={handleArchivar}
        pending={pending}
      />

      <Sheet open={sheet !== null} onOpenChange={open => !open && setSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 pt-5 pb-4 border-b border-border/60">
            <SheetTitle className="text-sm font-semibold">
              {sheet?.modo === 'crear' ? 'Nueva colección' : 'Editar colección'}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {sheet?.modo === 'crear'
                ? 'Ingresa el nombre para crear una nueva colección.'
                : 'Modifica el nombre de la colección.'}
            </SheetDescription>
          </SheetHeader>

          {sheet !== null && (
            <ColeccionForm
              key={sheet.modo + (sheet.id ?? '')}
              defaultValues={{ nombre: sheet.nombre ?? '' }}
              onSubmit={handleSubmit}
              pending={pending}
              onCancel={() => setSheet(null)}
              modo={sheet.modo}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
