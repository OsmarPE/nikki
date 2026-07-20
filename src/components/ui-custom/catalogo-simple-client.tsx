'use client';

import { reload } from '@/hooks/use-reload';
import { useState, useTransition, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontalIcon, PencilIcon, Trash2Icon, Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';
import { zodResolver, catalogoNombreSchema, type CatalogoNombreValues } from '@/lib/validations';
import { Card, CardContent } from '../ui/card';

interface Item { id: number; nombre: string }

interface Props {
  titulo: string;
  items: Item[];
  onCreate: (nombre: string) => Promise<{ success?: boolean; error?: string } | undefined>;
  onUpdate: (id: number, nombre: string) => Promise<{ success?: boolean; error?: string } | undefined>;
  onDelete: (id: number) => Promise<{ success?: boolean; error?: string; blocked?: boolean } | undefined>;
  onCheckUso: (id: number) => Promise<{ productos: number }>;
  permisos: { crear: boolean; editar: boolean; eliminar: boolean };
}

// ─── Formulario dentro del Sheet ─────────────────────────────────────────────
function CatalogoForm({
  defaultValues,
  onSubmit,
  pending,
  onCancel,
  modo,
  titulo,
}: {
  defaultValues: CatalogoNombreValues;
  onSubmit: (data: CatalogoNombreValues) => void;
  pending: boolean;
  onCancel: () => void;
  modo: 'crear' | 'editar';
  titulo: string;
}) {
  const singular = titulo.slice(0, -1).toLowerCase();
  const { register, handleSubmit, formState: { errors } } = useForm<CatalogoNombreValues>({
    resolver: zodResolver(catalogoNombreSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="flex-1 px-4 py-6">
        <FormField
          label={`Nombre de ${singular}`}
          placeholder={`Ej. ${titulo === 'Categorías' ? 'Accesorios' : titulo === 'Marcas' ? 'Nike' : singular}`}
          error={errors.nombre?.message}
          autoFocus
          {...register('nombre')}
        />
      </div>
      <SheetFooter className="border-t border-border/60 px-4 py-3 flex-row justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="default" size="sm" disabled={pending}>
          {pending ? 'Guardando…' : modo === 'crear' ? `Crear ${singular}` : 'Guardar cambios'}
        </Button>
      </SheetFooter>
    </form>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CatalogoSimpleClient({ titulo, items: initial, onCreate, onUpdate, onDelete, onCheckUso, permisos }: Props) {
  const [items] = useState(initial);
  const [sheet, setSheet] = useState<{ modo: 'crear' | 'editar'; id?: number; nombre?: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Item | null>(null);
  const [blockedMsg, setBlockedMsg] = useState<string | undefined>();
  const [usoCount, setUsoCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const singular = titulo.slice(0, -1).toLowerCase();

  function abrirCrear() {
    setSheet({ modo: 'crear' });
  }

  function abrirEditar(item: Item) {
    setSheet({ modo: 'editar', id: item.id, nombre: item.nombre });
  }

  function handleSubmit(data: CatalogoNombreValues) {
    startTransition(async () => {
      const r = sheet?.modo === 'crear'
        ? await onCreate(data.nombre)
        : await onUpdate(sheet!.id!, data.nombre);
      if (r?.error) { toast.error(r.error); return; }
      toast.success(sheet?.modo === 'crear' ? `${titulo.slice(0, -1)} creada.` : 'Actualizado.');
      setSheet(null);
      reload();
    });
  }

  function pedirEliminar(item: Item) {
    setConfirmTarget(item);
    setBlockedMsg(undefined);
    setUsoCount(null);
    setConfirmOpen(true);
    onCheckUso(item.id).then(r => setUsoCount(r.productos));
  }

  const handleEliminar = useCallback(() => {
    if (!confirmTarget) return;
    startTransition(async () => {
      const r = await onDelete(confirmTarget.id);
      if (r?.error) {
        if (r.blocked) { setBlockedMsg(r.error); return; }
        toast.error(r.error);
        return;
      }
      toast.success('Eliminado.');
      setConfirmOpen(false);
      setConfirmTarget(null);
      setBlockedMsg(undefined);
      reload();
    });
  }, [confirmTarget, onDelete]);

  const columns = useMemo<ColumnDef<Item>[]>(() => [
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-sm">
          <Tag size={13} className="text-muted-foreground shrink-0" />
          {row.original.nombre}
        </div>
      ),
    },
    ...(permisos.editar || permisos.eliminar ? [{
      id: 'actions',
      header: '',
      cell: ({ row }: { row: { original: Item } }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Abrir menú" />}>
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              {permisos.editar && (
                <DropdownMenuItem onClick={() => abrirEditar(row.original)}>
                  <PencilIcon /> Editar
                </DropdownMenuItem>
              )}
              {permisos.editar && permisos.eliminar && <DropdownMenuSeparator />}
              {permisos.eliminar && (
                <DropdownMenuItem variant="destructive" onClick={() => pedirEliminar(row.original)}>
                  <Trash2Icon /> Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    } as ColumnDef<Item>] : []),
  ], [handleEliminar, permisos.editar, permisos.eliminar]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Text as="h2" variant="title">{titulo}</Text>
          <Text variant="description">Administra las {titulo.toLowerCase()} del catálogo</Text>
        </div>
        {permisos.crear && (
          <Button size="sm" variant={'outline'} onClick={abrirCrear}>
            <Plus size={14} className="mr-1.5" />
            Nueva {singular}
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={items}
        emptyMessage={`Sin ${titulo.toLowerCase()}.`}
        pageSize={20}
      />


      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={open => { setConfirmOpen(open); if (!open) { setConfirmTarget(null); setBlockedMsg(undefined); setUsoCount(null); } }}
        title={`Eliminar ${singular}`}
        description={`¿Seguro que quieres eliminar "${confirmTarget?.nombre}"? No podrás recuperarlo después.`}
        blocked={blockedMsg ?? (usoCount && usoCount > 0
          ? `No se puede eliminar: ${usoCount} ${usoCount === 1 ? `producto usa` : `productos usan`} esta ${singular}. Reasígnalos primero.`
          : undefined)}
        warning={!blockedMsg && !usoCount ? (
          usoCount === null
            ? 'Verificando uso…'
            : `Ningún producto está usando esta ${singular}. Puedes eliminarla sin problema.`
        ) : undefined}
        confirmLabel={`Eliminar ${singular}`}
        onConfirm={handleEliminar}
        pending={pending}
      />

      <Sheet open={sheet !== null} onOpenChange={open => !open && setSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 pt-5 pb-4 border-b border-border/60">
            <SheetTitle className="text-sm font-semibold">
              {sheet?.modo === 'crear' ? `Nueva ${singular}` : `Editar ${singular}`}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {sheet?.modo === 'crear'
                ? `Ingresa el nombre para crear una nueva ${singular}.`
                : `Modifica el nombre de la ${singular}.`}
            </SheetDescription>
          </SheetHeader>

          {sheet !== null && (
            <CatalogoForm
              key={sheet.modo + (sheet.id ?? '')}
              defaultValues={{ nombre: sheet.nombre ?? '' }}
              onSubmit={handleSubmit}
              pending={pending}
              onCancel={() => setSheet(null)}
              modo={sheet.modo}
              titulo={titulo}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
