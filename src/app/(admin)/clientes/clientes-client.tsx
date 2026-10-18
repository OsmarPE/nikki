'use client';

import { reload } from '@/hooks/use-reload';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useState, useTransition, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { UserRound, Phone, Mail, MoreVertical, Pencil, Trash2, UserPlus, FileDown, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FormField, FieldGroup } from '@/components/ui/form-field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Text } from '@/components/ui/text';
import { crearCliente, actualizarCliente, eliminarCliente, verificarDependenciasCliente } from '@/actions/clientes';
import { formatDate } from '@/lib/utils';
import { zodResolver, clienteSchema, type ClienteFormValues } from '@/lib/validations';
import type { Cliente } from '@/types';

function ClienteForm({ defaultValues, onSubmit, pending, onCancel, modo }: {
  defaultValues: ClienteFormValues;
  onSubmit: (data: ClienteFormValues) => void;
  pending: boolean;
  onCancel: () => void;
  modo: 'crear' | 'editar';
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues,
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="flex-1 px-4 py-6 space-y-3">
        <FieldGroup label="Datos personales">
          <FormField label="Nombre completo" placeholder="Ej. María García"
            error={errors.nombre?.message} autoFocus {...register('nombre')} />
        </FieldGroup>
        <FieldGroup label="Contacto">
          <FormField label="Teléfono" hint="opcional" placeholder="55 1234 5678"
            error={errors.telefono?.message} {...register('telefono')} />
          <FormField label="Correo electrónico" hint="opcional" type="email"
            placeholder="ejemplo@correo.com" error={errors.email?.message} {...register('email')} />
        </FieldGroup>
      </div>
      <SheetFooter className="border-t border-border/60 px-4 py-3 flex-row justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="default" size="sm" disabled={pending}>
          {pending ? 'Guardando…' : modo === 'crear' ? 'Crear' : 'Guardar'}
        </Button>
      </SheetFooter>
    </form>
  );
}

// ─── Vista lista/tarjetas, recordada por navegador ────────────────────────────
type Vista = 'lista' | 'tarjetas';
const VISTA_KEY = 'clientes:vista';
const vistaListeners = new Set<() => void>();

function leerVista(): Vista {
  try { return localStorage.getItem(VISTA_KEY) === 'tarjetas' ? 'tarjetas' : 'lista'; }
  catch { return 'lista'; }
}

function guardarVista(v: Vista) {
  try { localStorage.setItem(VISTA_KEY, v); } catch { /* storage bloqueado */ }
  vistaListeners.forEach(l => l());
}

function suscribirVista(l: () => void) {
  vistaListeners.add(l);
  return () => { vistaListeners.delete(l); };
}

function useVista(): Vista {
  return useSyncExternalStore(suscribirVista, leerVista, () => 'lista');
}

function VistaToggle({ vista }: { vista: Vista }) {
  const opciones = [
    { value: 'lista' as const,    icon: List,       label: 'Ver como lista' },
    { value: 'tarjetas' as const, icon: LayoutGrid, label: 'Ver como tarjetas' },
  ];
  return (
    <div className="inline-flex items-center rounded-md border border-border p-0.5">
      {opciones.map(({ value, icon: Icon, label }) => (
        <button key={value} type="button" aria-label={label} title={label}
          aria-pressed={vista === value}
          onClick={() => guardarVista(value)}
          className={[
            'h-7 w-7 inline-flex items-center justify-center rounded-[5px] transition-colors',
            vista === value ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}>
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}

function ClienteAcciones({ onEditar, onEliminar }: { onEditar: () => void; onEliminar: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Abrir menú" />}>
        <MoreVertical size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEditar}>
          <Pencil size={13} className="mr-2" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
          onClick={onEliminar}
        >
          <Trash2 size={13} className="mr-2" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  const vista = useVista();

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

      <div className="flex items-center gap-2">
        <Input placeholder="Buscar por nombre, teléfono o email…"
          value={busqueda} onChange={e => setBusqueda(e.target.value)} className="max-w-sm" />
        <div className="ml-auto">
          <VistaToggle vista={vista} />
        </div>
      </div>

      {todosLos.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin clientes.</p>
      ) : (
        <>
        {vista === 'lista' ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="hidden md:table-cell">Correo</TableHead>
                  <TableHead className="hidden sm:table-cell">Alta</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <UserRound size={13} className="text-muted-foreground" />
                        </div>
                        <span className="font-medium text-sm">{c.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.telefono ?? <span className="text-muted-foreground/50 italic">—</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {c.email ?? <span className="text-muted-foreground/50 italic">—</span>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {formatDate(c.creado_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <ClienteAcciones onEditar={() => abrirEditar(c)} onEliminar={() => pedirEliminar(c)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
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
                <div className="-mr-1 -mt-0.5">
                  <ClienteAcciones onEditar={() => abrirEditar(c)} onEliminar={() => pedirEliminar(c)} />
                </div>
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
        )}
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

      {/* Sheet crear/editar */}
      <Sheet open={modal !== null} onOpenChange={open => !open && setModal(null)}>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 pt-5 pb-4 border-b border-border/60">
            <SheetTitle className="text-sm font-semibold">
              {modal === 'crear' ? 'Nuevo cliente' : 'Editar cliente'}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {modal === 'crear'
                ? 'Ingresa los datos para registrar un nuevo cliente.'
                : 'Modifica los datos del cliente.'}
            </SheetDescription>
          </SheetHeader>
          {modal !== null && (
            <ClienteForm key={modal + editId} defaultValues={defaultValues}
              onSubmit={handleSubmit} pending={pending} onCancel={() => setModal(null)} modo={modal} />
          )}
        </SheetContent>
      </Sheet>

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
