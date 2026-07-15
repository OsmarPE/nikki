'use client';

import { useState, useTransition, useMemo, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
  MoreHorizontalIcon, PencilIcon, KeyRound, Ban, CheckCircle2,
  Plus, ShieldCheck, Database, Download, UserRound, Lock, TriangleAlert, Trash2, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Text } from '@/components/ui/text';
import { reload } from '@/hooks/use-reload';
import { formatDate } from '@/lib/utils';
import {
  crearUsuario, actualizarUsuario, resetearPasswordUsuario, cambiarActivoUsuario,
  getPermisosUsuario, guardarPermisosUsuario,
} from '@/actions/usuarios';
import { borrarDatosNegocio, cargarDatosMuestra } from '@/actions/mantenimiento';
import {
  zodResolver, usuarioSchema, usuarioEditSchema, passwordSchema,
  type UsuarioFormValues, type UsuarioEditFormValues, type PasswordFormValues,
} from '@/lib/validations';
import { MODULOS, ACCIONES, PERMISO_VACIO, type PermisosMap, type Modulo, type Accion } from '@/lib/permisos';
import type { Usuario, Rol } from '@/types';

interface Props {
  usuarios: Usuario[];
  usuarioActualId: number;
}

const ROL_LABEL: Record<Rol, string> = { admin: 'Administrador', vendedor: 'Vendedor' };

// ─── Formulario crear/editar usuario ───────────────────────────────────────────
function UsuarioForm({
  modo, defaultValues, onSubmit, pending, onCancel,
}: {
  modo: 'crear' | 'editar';
  defaultValues: UsuarioFormValues;
  onSubmit: (data: UsuarioFormValues | UsuarioEditFormValues) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const schema = modo === 'crear' ? usuarioSchema : usuarioEditSchema;
  const { register, handleSubmit, control, formState: { errors } } = useForm<UsuarioFormValues>({
    resolver: zodResolver(schema as typeof usuarioSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="flex-1 px-4 py-6 space-y-4">
        <FormField label="Nombre" placeholder="Ej. Carlos Vendedor" error={errors.nombre?.message} autoFocus {...register('nombre')} />
        <FormField label="Correo electrónico" type="email" placeholder="correo@ejemplo.com" error={errors.email?.message} {...register('email')} />
        {modo === 'crear' && (
          <FormField label="Contraseña" type="password" placeholder="Mínimo 8 caracteres" error={errors.password?.message} {...register('password')} />
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Rol</label>
          <Controller
            name="rol"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? 'vendedor'} onValueChange={field.onChange}>
                <SelectTrigger className="h-8 text-sm w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor" label="Vendedor">Vendedor</SelectItem>
                  <SelectItem value="admin" label="Administrador">Administrador</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <SheetFooter className="border-t border-border/60 px-4 py-3 flex-row justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="default" size="sm" disabled={pending}>
          {pending ? 'Guardando…' : modo === 'crear' ? 'Crear usuario' : 'Guardar cambios'}
        </Button>
      </SheetFooter>
    </form>
  );
}

// ─── Formulario resetear contraseña ─────────────────────────────────────────────
function PasswordForm({ onSubmit, pending, onCancel }: {
  onSubmit: (data: PasswordFormValues) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField label="Nueva contraseña" type="password" placeholder="Mínimo 8 caracteres" error={errors.password?.message} autoFocus {...register('password')} />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="default" disabled={pending}>{pending ? 'Guardando…' : 'Restablecer'}</Button>
      </DialogFooter>
    </form>
  );
}

// ─── Matriz de permisos por módulo ───────────────────────────────────────────────
function PermisosForm({
  valores, onChange, onSubmit, pending, onCancel, cargando,
}: {
  valores: PermisosMap;
  onChange: (modulo: Modulo, accion: Accion, checked: boolean) => void;
  onSubmit: () => void;
  pending: boolean;
  onCancel: () => void;
  cargando: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 px-4 py-6">
        {cargando ? (
          <p className="text-xs text-muted-foreground">Cargando permisos…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground">
                  <th className="pb-2 font-medium">Módulo</th>
                  {ACCIONES.map(a => (
                    <th key={a.key} className="pb-2 font-medium text-center px-1">{a.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULOS.map(m => (
                  <tr key={m.key} className="border-t border-border/60">
                    <td className="py-2 pr-2 font-medium">{m.label}</td>
                    {ACCIONES.map(a => (
                      <td key={a.key} className="py-2 px-1 text-center">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-foreground cursor-pointer"
                          checked={valores[m.key]?.[a.key] ?? false}
                          onChange={e => onChange(m.key, a.key, e.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <SheetFooter className="border-t border-border/60 px-4 py-3 flex-row justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="button" variant="default" size="sm" disabled={pending || cargando} onClick={onSubmit}>
          {pending ? 'Guardando…' : 'Guardar permisos'}
        </Button>
      </SheetFooter>
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────────
export default function ConfiguracionClient({ usuarios: initial, usuarioActualId }: Props) {
  const [usuarios] = useState(initial);
  const [sheet, setSheet] = useState<{ modo: 'crear' | 'editar'; usuario?: Usuario } | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Usuario | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Usuario | null>(null);
  const [pending, startTransition] = useTransition();
  const [descargando, setDescargando] = useState(false);
  const [tab, setTab] = useState<'usuarios' | 'respaldo' | 'datos'>('usuarios');
  const [permisosTarget, setPermisosTarget] = useState<Usuario | null>(null);
  const [permisosValores, setPermisosValores] = useState<PermisosMap>({});
  const [permisosCargando, setPermisosCargando] = useState(false);
  const [confirmMuestra, setConfirmMuestra] = useState(false);
  const [confirmBorrar, setConfirmBorrar] = useState(false);
  const [textoConfirmBorrar, setTextoConfirmBorrar] = useState('');

  function abrirCrear() { setSheet({ modo: 'crear' }); }
  function abrirEditar(usuario: Usuario) { setSheet({ modo: 'editar', usuario }); }

  function handleSubmitUsuario(data: UsuarioFormValues | UsuarioEditFormValues) {
    startTransition(async () => {
      const r = sheet?.modo === 'crear'
        ? await crearUsuario(data as UsuarioFormValues)
        : await actualizarUsuario(sheet!.usuario!.id, data);
      if (r?.error) { toast.error(r.error); return; }
      toast.success(sheet?.modo === 'crear' ? 'Usuario creado.' : 'Cambios guardados.');
      setSheet(null);
      reload();
    });
  }

  function handleSubmitPassword(data: PasswordFormValues) {
    if (!passwordTarget) return;
    startTransition(async () => {
      const r = await resetearPasswordUsuario(passwordTarget.id, data.password);
      if (r?.error) { toast.error(r.error); return; }
      toast.success('Contraseña actualizada.');
      setPasswordTarget(null);
    });
  }

  function pedirDesactivar(usuario: Usuario) { setConfirmTarget(usuario); }

  function abrirPermisos(usuario: Usuario) {
    setPermisosTarget(usuario);
    setPermisosCargando(true);
    getPermisosUsuario(usuario.id).then(p => {
      setPermisosValores(p);
      setPermisosCargando(false);
    });
  }

  function handleChangePermiso(modulo: Modulo, accion: Accion, checked: boolean) {
    setPermisosValores(prev => ({
      ...prev,
      [modulo]: { ...(prev[modulo] ?? PERMISO_VACIO), [accion]: checked },
    }));
  }

  function handleSubmitPermisos() {
    if (!permisosTarget) return;
    startTransition(async () => {
      const r = await guardarPermisosUsuario(permisosTarget.id, permisosValores);
      if (r?.error) { toast.error(r.error); return; }
      toast.success('Permisos guardados. Aplican la próxima vez que ese usuario inicie sesión.');
      setPermisosTarget(null);
    });
  }

  const handleToggleActivo = useCallback((usuario: Usuario, activo: boolean) => {
    startTransition(async () => {
      const r = await cambiarActivoUsuario(usuario.id, activo);
      if (r?.error) { toast.error(r.error); return; }
      toast.success(activo ? 'Usuario activado.' : 'Usuario desactivado.');
      setConfirmTarget(null);
      reload();
    });
  }, []);

  async function handleDescargarBackup() {
    setDescargando(true);
    try {
      const res = await fetch('/api/export/backup');
      if (!res.ok) { toast.error('Error al generar el respaldo.'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `backup-nikki-${new Date().toISOString().slice(0, 10)}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Respaldo descargado.');
    } catch { toast.error('Error de red al generar el respaldo.'); }
    finally { setDescargando(false); }
  }

  function handleCargarMuestra() {
    startTransition(async () => {
      const r = await cargarDatosMuestra();
      if (r?.error) { toast.error(r.error); return; }
      toast.success('Datos de muestra cargados.');
      setConfirmMuestra(false);
      reload();
    });
  }

  function handleBorrarDatos() {
    startTransition(async () => {
      const r = await borrarDatosNegocio();
      if (r?.error) { toast.error(r.error); return; }
      toast.success('Datos de negocio borrados. Usuarios y permisos se conservaron.');
      setConfirmBorrar(false);
      setTextoConfirmBorrar('');
      reload();
    });
  }

  const columns = useMemo<ColumnDef<Usuario>[]>(() => [
    {
      accessorKey: 'nombre',
      header: 'Usuario',
      cell: ({ row }) => (
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <UserRound size={13} className="text-muted-foreground shrink-0" />
            {row.original.nombre}
            {row.original.id === usuarioActualId && (
              <span className="text-[10px] text-muted-foreground">(tú)</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground ml-5.25">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: 'rol',
      header: 'Rol',
      cell: ({ row }) => (
        <Badge variant={row.original.rol === 'admin' ? 'default' : 'outline'} className="text-xs">
          {ROL_LABEL[row.original.rol]}
        </Badge>
      ),
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={Number(row.original.activo) === 1 ? 'outline' : 'destructive'} className="text-xs">
          {Number(row.original.activo) === 1 ? 'Activo' : 'Desactivado'}
        </Badge>
      ),
    },
    {
      accessorKey: 'creado_at',
      header: 'Creado',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.creado_at)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const u = row.original;
        const esUno = Number(u.activo) === 1;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Abrir menú" />}>
                <MoreHorizontalIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => abrirEditar(u)}>
                  <PencilIcon /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPasswordTarget(u)}>
                  <KeyRound /> Restablecer contraseña
                </DropdownMenuItem>
                {u.rol === 'vendedor' && (
                  <DropdownMenuItem onClick={() => abrirPermisos(u)}>
                    <Lock /> Permisos
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {esUno ? (
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={u.id === usuarioActualId}
                    onClick={() => pedirDesactivar(u)}
                  >
                    <Ban /> Desactivar
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => handleToggleActivo(u, true)}>
                    <CheckCircle2 /> Activar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], [usuarioActualId, handleToggleActivo]);

  return (
    <div className="space-y-6">
      <div>
        <Text as="h2" variant="title">Configuración</Text>
        <Text variant="description">Administra usuarios, permisos y el respaldo de la base de datos</Text>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as 'usuarios' | 'respaldo' | 'datos')}>
        <TabsList>
          <TabsTrigger value="usuarios"><ShieldCheck size={13} className="mr-1.5" />Usuarios y permisos</TabsTrigger>
          <TabsTrigger value="respaldo"><Database size={13} className="mr-1.5" />Respaldo</TabsTrigger>
          <TabsTrigger value="datos"><TriangleAlert size={13} className="mr-1.5" />Datos</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4 pt-4">
          <div className="flex items-center justify-end">
            <Button size="sm" variant="outline" onClick={abrirCrear}>
              <Plus size={14} className="mr-1.5" />
              Nuevo usuario
            </Button>
          </div>
          <DataTable columns={columns} data={usuarios} emptyMessage="Sin usuarios." pageSize={20} />
        </TabsContent>

        <TabsContent value="respaldo" className="pt-4">
          <Card className="p-6 max-w-xl">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Database size={18} className="text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-semibold">Respaldo de la base de datos</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Descarga un archivo .sql con la estructura y todos los datos actuales
                  (productos, ventas, clientes, usuarios, etc.). Guárdalo en un lugar seguro:
                  incluye información sensible como las contraseñas cifradas de los usuarios.
                </p>
              </div>
            </div>
            <Button className="mt-4" size="sm" onClick={handleDescargarBackup} disabled={descargando}>
              <Download size={14} className="mr-1.5" />
              {descargando ? 'Generando…' : 'Descargar respaldo'}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="datos" className="space-y-4 pt-4 max-w-xl">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-semibold">Cargar datos de muestra</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Inserta clientes, categorías, marcas, productos y algunas ventas de ejemplo
                  para probar el sistema. No toca usuarios ni permisos.
                </p>
              </div>
            </div>
            <Button className="mt-4" size="sm" variant="outline" onClick={() => setConfirmMuestra(true)}>
              <Sparkles size={14} className="mr-1.5" />
              Cargar datos de muestra
            </Button>
          </Card>

          <Card className="p-6 border-destructive/30">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <TriangleAlert size={18} className="text-destructive" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-semibold">Borrar todos los datos de negocio</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Elimina permanentemente productos, categorías, marcas, colecciones, clientes,
                  inventario, ventas y sesiones de caja. <strong>No se puede deshacer.</strong> Los
                  usuarios y sus permisos NO se tocan — nadie pierde su cuenta.
                  Descarga un respaldo antes si quieres poder recuperar algo después.
                </p>
              </div>
            </div>
            <Button className="mt-4" size="sm" variant="destructive" onClick={() => setConfirmBorrar(true)}>
              <Trash2 size={14} className="mr-1.5" />
              Borrar todos los datos de negocio
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sheet crear/editar usuario */}
      <Sheet open={sheet !== null} onOpenChange={open => !open && setSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 pt-5 pb-4 border-b border-border/60">
            <SheetTitle className="text-sm font-semibold">
              {sheet?.modo === 'crear' ? 'Nuevo usuario' : 'Editar usuario'}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {sheet?.modo === 'crear'
                ? 'Crea una cuenta y asígnale un rol.'
                : 'Modifica los datos y el rol del usuario.'}
            </SheetDescription>
          </SheetHeader>
          {sheet !== null && (
            <UsuarioForm
              key={sheet.modo + (sheet.usuario?.id ?? '')}
              modo={sheet.modo}
              defaultValues={{
                nombre:   sheet.usuario?.nombre ?? '',
                email:    sheet.usuario?.email ?? '',
                password: '',
                rol:      sheet.usuario?.rol ?? 'vendedor',
              }}
              onSubmit={handleSubmitUsuario}
              pending={pending}
              onCancel={() => setSheet(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog resetear contraseña */}
      <Dialog open={passwordTarget !== null} onOpenChange={open => !open && setPasswordTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Nueva contraseña para <strong>{passwordTarget?.nombre}</strong>.
          </p>
          {passwordTarget !== null && (
            <PasswordForm
              onSubmit={handleSubmitPassword}
              pending={pending}
              onCancel={() => setPasswordTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Sheet permisos por módulo */}
      <Sheet open={permisosTarget !== null} onOpenChange={open => !open && setPermisosTarget(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
          <SheetHeader className="px-4 pt-5 pb-4 border-b border-border/60">
            <SheetTitle className="text-sm font-semibold">
              Permisos de {permisosTarget?.nombre}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Marca qué puede ver, crear, editar o eliminar en cada módulo del panel.
            </SheetDescription>
          </SheetHeader>
          {permisosTarget !== null && (
            <PermisosForm
              valores={permisosValores}
              onChange={handleChangePermiso}
              onSubmit={handleSubmitPermisos}
              pending={pending}
              cargando={permisosCargando}
              onCancel={() => setPermisosTarget(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Confirmar desactivación */}
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={open => !open && setConfirmTarget(null)}
        title="Desactivar usuario"
        description={`"${confirmTarget?.nombre}" no podrá iniciar sesión hasta que lo reactives. Su historial de ventas y movimientos se conserva.`}
        confirmLabel="Desactivar"
        onConfirm={() => confirmTarget && handleToggleActivo(confirmTarget, false)}
        pending={pending}
      />

      {/* Confirmar carga de datos de muestra */}
      <ConfirmDialog
        open={confirmMuestra}
        onOpenChange={setConfirmMuestra}
        title="Cargar datos de muestra"
        description="Se insertarán clientes, productos, categorías y ventas de ejemplo. No afecta a los usuarios. Si ya hay productos o clientes con esos mismos nombres, la operación fallará — borra los datos de negocio primero si quieres empezar limpio."
        confirmLabel="Cargar datos"
        onConfirm={handleCargarMuestra}
        pending={pending}
      />

      {/* Confirmar borrado de datos de negocio — requiere escribir BORRAR */}
      <Dialog open={confirmBorrar} onOpenChange={open => { setConfirmBorrar(open); if (!open) setTextoConfirmBorrar(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert size={16} />
              Borrar todos los datos de negocio
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground leading-relaxed">
              Esto borra <strong>permanentemente</strong> productos, categorías, marcas, colecciones,
              clientes, inventario, ventas y sesiones de caja. No se puede deshacer. Los usuarios y
              sus permisos se conservan.
            </p>
            <p className="text-muted-foreground">
              Escribe <strong className="text-foreground">BORRAR</strong> para confirmar.
            </p>
            <input
              type="text"
              value={textoConfirmBorrar}
              onChange={e => setTextoConfirmBorrar(e.target.value)}
              placeholder="BORRAR"
              autoFocus
              className="w-full h-9 rounded-md border border-border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmBorrar(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={textoConfirmBorrar !== 'BORRAR' || pending}
              onClick={handleBorrarDatos}
            >
              {pending ? 'Borrando…' : 'Borrar definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
