'use client';

import { reload } from '@/hooks/use-reload';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { UserRound, Phone, Mail, MoreVertical, Pencil, Trash2, UserPlus, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FormField, FieldGroup } from '@/components/ui/form-field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Text } from '@/components/ui/text';
import { crearCliente, actualizarCliente, eliminarCliente, verificarDependenciasCliente } from '@/actions/clientes';
import { formatDate } from '@/lib/utils';
import { zodResolver, clienteSchema, type ClienteFormValues } from '@/lib/validations';
import type { Cliente } from '@/types';

function ClienteForm({ defaultValues, onSubmit, pending, onCancel }: {
  defaultValues: ClienteFormValues;
  onSubmit: (data: ClienteFormValues) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues,
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-0">
      <div className="px-5 py-4 space-y-3">
        <FieldGroup label="Datos personales">
          <FormField label="Nombre completo" placeholder="Ej. María García"
            error={errors.nombre?.message} {...register('nombre')} />
        </FieldGroup>
        <FieldGroup label="Contacto">
          <FormField label="Teléfono" hint="opcional" placeholder="55 1234 5678"
            error={errors.telefono?.message} {...register('telefono')} />
          <FormField label="Correo electrónico" hint="opcional" type="email"
            placeholder="ejemplo@correo.com" error={errors.email?.message} {...register('email')} />
        </FieldGroup>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="default" size="sm" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar cliente'}
        </Button>
      </DialogFooter>
    </form>
  );
}

const EMPTY: ClienteFormValues = { nombre: '', telefono: '', email: '' };

export default function ClientesClient({ clientes: initial }: { clientes: Cliente[] }) {
  const [clientes] = useState(initial);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<'crear' | 'editar' | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [defaultValues, setDefaultValues] = useState<ClienteFormValues>(EMPTY);
  const [pending, startTransition] = useTransition();
  const [exportando, setExportando] = useState(false);

  // ConfirmDialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Cliente | null>(null);
  const [blockedMsg, setBlockedMsg] = useState<string | undefined>();
  const [confirmDeps, setConfirmDeps] = useState<{ ventas: number } | null>(null);

  const todosLos = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.telefono ?? '').includes(busqueda) ||
    (c.email ?? '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const { paged: filtrados, ...pag } = usePagination(todosLos, { pageSize: 12 });

  async function handleExport() {
    setExportando(true);
    try {
      const res = await fetch('/api/export/clientes');
      if (!res.ok) { toast.error('Error al generar el Excel.'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `clientes-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel descargado.');
    } catch { toast.error('Error de red al exportar.'); }
    finally { setExportando(false); }
  }

  function abrirCrear() { setDefaultValues(EMPTY); setModal('crear'); }
  function abrirEditar(c: Cliente) {
    setEditId(c.id);
    setDefaultValues({ nombre: c.nombre, telefono: c.telefono ?? '', email: c.email ?? '' });
    setModal('editar');
  }

  function pedirEliminar(c: Cliente) {
    setConfirmTarget(c);
    setConfirmDeps(null);
    setConfirmOpen(true);
    verificarDependenciasCliente(c.id).then(setConfirmDeps);
  }

  function handleSubmit(data: ClienteFormValues) {
    startTransition(async () => {
      const r = modal === 'crear'
        ? await crearCliente(data)
        : await actualizarCliente(editId!, data);
      if (r?.error) { toast.error(r.error); return; }
      toast.success(modal === 'crear' ? 'Cliente registrado.' : 'Cliente actualizado.');
      setModal(null);
      reload();
    });
  }

  function handleEliminar() {
    if (!confirmTarget) return;
    startTransition(async () => {
      const r = await eliminarCliente(confirmTarget.id);
      if (r?.error) {
        if (r.blocked) { setBlockedMsg(r.error); return; }
        toast.error(r.error);
        return;
      }
      toast.success('Cliente eliminado.');
      setConfirmOpen(false);
      setConfirmTarget(null);
      setBlockedMsg(undefined);
      reload();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Text as="h2" variant="title">Clientes</Text>
          <Text variant="description">Información general de los clientes</Text>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExport} disabled={exportando} variant="outline">
            <FileDown size={13} />
            {exportando ? 'Generando…' : 'Exportar Excel'}
          </Button>
          <Button variant="outline" onClick={abrirCrear} >
            <UserPlus size={13} />
            Nuevo cliente
          </Button>
        </div>
      </div>

      <Input placeholder="Buscar por nombre, teléfono o email…"
        value={busqueda} onChange={e => setBusqueda(e.target.value)} className="max-w-sm" />

      {todosLos.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin clientes.</p>
      ) : (
        <>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map(c => (
            <Card key={c.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <UserRound size={16} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm leading-tight">{c.nombre}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(c.creado_at)}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-0.5" aria-label="Abrir menú" />}>
                    <MoreVertical size={14} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => abrirEditar(c)}>
                      <Pencil size={13} className="mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      onClick={() => pedirEliminar(c)}
                    >
                      <Trash2 size={13} className="mr-2" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-1.5 border-t border-dashed border-border pt-3">
                <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Phone size={12} className="shrink-0" />
                  {c.telefono ?? <span className="text-muted-foreground/50 italic">Sin teléfono</span>}
                </p>
                <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Mail size={12} className="shrink-0" />
                  {c.email ?? <span className="text-muted-foreground/50 italic">Sin correo</span>}
                </p>
              </div>
            </Card>
          ))}
        </div>
        <PaginationControls
          page={pag.page}
          totalPages={pag.totalPages}
          total={pag.total}
          pageSize={pag.pageSize}
          hasPrev={pag.hasPrev}
          hasNext={pag.hasNext}
          onPrev={pag.prev}
          onNext={pag.next}
        />
        </>
      )}

      {/* Modal crear/editar */ }
      <Dialog open={modal !== null} onOpenChange={() => setModal(null)}>
        <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60">
            <DialogTitle className="text-sm font-semibold">
              {modal === 'crear' ? 'Nuevo cliente' : 'Editar cliente'}
            </DialogTitle>
          </DialogHeader>
          {modal !== null && (
            <ClienteForm key={modal + editId} defaultValues={defaultValues}
              onSubmit={handleSubmit} pending={pending} onCancel={() => setModal(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm eliminar */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={open => { setConfirmOpen(open); if (!open) { setConfirmTarget(null); setBlockedMsg(undefined); } }}
        title="Eliminar cliente"
        description={`¿Estás seguro de que deseas eliminar a "${confirmTarget?.nombre}"? Esta acción no se puede deshacer.`}
        warning={
          confirmDeps === null
            ? 'Verificando historial de compras…'
            : confirmDeps.ventas > 0
              ? `Este cliente tiene ${confirmDeps.ventas} venta${confirmDeps.ventas > 1 ? 's' : ''} registrada${confirmDeps.ventas > 1 ? 's' : ''}. Sus compras seguirán guardadas pero aparecerán sin cliente asignado.`
              : undefined
        }
        confirmLabel="Sí, eliminar cliente"
        onConfirm={handleEliminar}
        pending={pending}
      />
    </div>
  );
}
