'use client';

import { useState, useTransition, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, User, CreditCard, ClipboardList,
  Search, Plus, Minus, Trash2, X,
  CheckCircle2, ArrowLeft, ArrowRight,
  Banknote, ArrowRightLeft, FileDown, Package,
  UserPlus,
} from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { calcularCarrito } from '@/lib/promocion';
import { procesarVenta } from '@/actions/ventas';
import { crearCliente, buscarClientes } from '@/actions/clientes';
import { buscarProductosPOS } from '@/actions/productos';
import { zodResolver, clienteSchema, type ClienteFormValues } from '@/lib/validations';
import type { Producto, Cliente } from '@/types';

// ─── Tipos locales ─────────────────────────────────────────────────────────────
interface LineaCarrito { producto: Producto; cantidad: number }
type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta';
interface VentaExitosa { ventaId: number; folio: string }

const PASOS = [
  { n: 1, label: 'Productos',  icon: ShoppingCart },
  { n: 2, label: 'Cliente',    icon: User         },
  { n: 3, label: 'Pago',       icon: CreditCard   },
  { n: 4, label: 'Confirmar',  icon: ClipboardList },
] as const;

const METODOS: { value: MetodoPago; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'efectivo',      label: 'Efectivo',      desc: 'Pago en billetes o monedas',  icon: <Banknote size={20} />      },
  { value: 'transferencia', label: 'Transferencia', desc: 'Transferencia bancaria / SPEI', icon: <ArrowRightLeft size={20} /> },
  { value: 'tarjeta',       label: 'Tarjeta',       desc: 'Débito o crédito',             icon: <CreditCard size={20} />    },
];

// ─── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ paso }: { paso: number }) {
  return (
    <div className="flex items-center">
      {PASOS.map((p, i) => {
        const activo     = paso === p.n;
        const completado = paso > p.n;
        const Icon       = p.icon;
        return (
          <div key={p.n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-200',
                activo    && 'border-foreground bg-foreground text-background',
                completado && 'border-foreground bg-foreground text-background',
                !activo && !completado && 'border-border bg-background text-muted-foreground',
              )}>
                {completado
                  ? <CheckCircle2 size={14} />
                  : <Icon size={13} />
                }
              </div>
              <span className={cn(
                'text-[11px] font-medium whitespace-nowrap',
                activo    && 'text-foreground',
                completado && 'text-muted-foreground',
                !activo && !completado && 'text-muted-foreground/50',
              )}>
                {p.label}
              </span>
            </div>
            {i < PASOS.length - 1 && (
              <div className={cn(
                'flex-1 h-px mx-3 mb-5 transition-colors duration-300',
                paso > p.n ? 'bg-foreground' : 'bg-border',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Paso 1 — Productos ────────────────────────────────────────────────────────
function PasoProductos({
  lineas, carrito, onAbrirBuscador, onCantidad, onEliminar,
}: {
  lineas: LineaCarrito[];
  carrito: ReturnType<typeof calcularCarrito>;
  onAbrirBuscador: () => void;
  onCantidad: (id: number, delta: number) => void;
  onEliminar: (id: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Productos del carrito</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Agrega los artículos que lleva el cliente</p>
        </div>
        <Button variant="outline" onClick={onAbrirBuscador}>
          <Search size={13} />
          Buscar producto
        </Button>
      </div>

      {lineas.length === 0 ? (
        <div
          onClick={onAbrirBuscador}
          className="rounded-xl border-2 border-dashed border-border py-14 flex flex-col items-center gap-3 text-muted-foreground cursor-pointer hover:border-foreground/30 hover:bg-muted/30 transition-all"
        >
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <ShoppingCart size={20} className="opacity-50" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">El carrito está vacío</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Haz clic para buscar productos</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Cabecera */}
          <div className="grid grid-cols-[1fr_120px_100px_32px] gap-3 px-4 py-2.5 bg-muted/40 border-b border-border">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Producto</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Cantidad</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Subtotal</span>
            <span />
          </div>

          {/* Filas */}
          <div className="divide-y divide-border/50">
            {carrito.items.map(item => (
              <div key={item.producto.id} className="grid grid-cols-[1fr_120px_100px_32px] gap-3 px-4 py-3 items-center">
                {/* Info producto */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.producto.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.producto.imagen_url} alt={item.producto.nombre}
                      className="h-8 w-8 rounded-md object-cover shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Package size={13} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.producto.nombre}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-mono text-muted-foreground">{item.producto.sku}</span>
                      {item.descuento_aplicado > 0 && (
                        <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-px font-medium">
                          −{formatCurrency(item.descuento_aplicado)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cantidad */}
                <div className="flex items-center gap-1.5 justify-center">
                  <button onClick={() => onCantidad(item.producto.id, -1)}
                    className="h-6 w-6 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors">
                    <Minus size={11} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{item.cantidad}</span>
                  <button onClick={() => onCantidad(item.producto.id, 1)}
                    className="h-6 w-6 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors">
                    <Plus size={11} />
                  </button>
                </div>

                {/* Subtotal */}
                <p className="text-sm font-semibold text-right tabular-nums">{formatCurrency(item.subtotal)}</p>

                {/* Eliminar */}
                <button onClick={() => onEliminar(item.producto.id)}
                  className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="px-4 py-3 border-t border-border bg-muted/20 space-y-1">
            {carrito.promocion_aplicada && (
              <div className="flex justify-between text-sm text-green-700">
                <span className="font-medium">Descuento (promoción 4x3)</span>
                <span className="tabular-nums font-semibold">−{formatCurrency(carrito.descuento_total)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(carrito.total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Paso 2 — Cliente ──────────────────────────────────────────────────────────
function PasoCliente({
  cliente, query, resultados, buscando,
  onQueryChange, onSeleccionar, onQuitar, onNuevo,
}: {
  cliente: Cliente | null;
  query: string;
  resultados: Cliente[];
  buscando: boolean;
  onQueryChange: (q: string) => void;
  onSeleccionar: (c: Cliente) => void;
  onQuitar: () => void;
  onNuevo: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Seleccionar cliente</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Opcional — puedes continuar como público general</p>
      </div>

      {/* Cliente seleccionado */}
      {cliente ? (
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3.5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
            <User size={16} className="text-foreground/60" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">{cliente.nombre}</p>
            <p className="text-[11px] text-muted-foreground">{cliente.telefono ?? cliente.email ?? 'Sin contacto'}</p>
          </div>
          <button onClick={onQuitar}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X size={13} />
          </button>
        </div>
      ) : (
        /* Buscador */
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar por nombre o teléfono…"
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Resultados flotantes */}
          {query.length >= 2 && (
            <div className="rounded-xl border border-border bg-popover shadow-md overflow-hidden">
              {buscando ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">Buscando…</div>
              ) : resultados.length === 0 ? (
                <div className="px-4 py-4 text-center text-xs text-muted-foreground">
                  Sin resultados para "{query}"
                </div>
              ) : (
                <div className="divide-y divide-border/50 max-h-52 overflow-y-auto">
                  {resultados.map(c => (
                    <button key={c.id} onClick={() => onSeleccionar(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User size={13} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{c.nombre}</p>
                        <p className="text-[11px] text-muted-foreground">{c.telefono ?? c.email ?? '—'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="border-t border-border/60 p-2">
                <button onClick={onNuevo}
                  className="w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <UserPlus size={12} />
                  Registrar nuevo cliente
                </button>
              </div>
            </div>
          )}

          {/* Sin búsqueda aún */}
          {query.length < 2 && (
            <div className="rounded-xl border-2 border-dashed border-border py-10 flex flex-col items-center gap-2 text-muted-foreground">
              <User size={24} className="opacity-30" />
              <div className="text-center">
                <p className="text-sm">Sin cliente asignado</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Se registrará como público general</p>
              </div>
              <button onClick={onNuevo}
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-foreground/60 hover:text-foreground transition-colors">
                <UserPlus size={12} />
                Registrar nuevo cliente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Paso 3 — Pago ─────────────────────────────────────────────────────────────
function PasoPago({ metodo, onChange }: { metodo: MetodoPago; onChange: (m: MetodoPago) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Método de pago</h3>
        <p className="text-xs text-muted-foreground mt-0.5">¿Cómo va a pagar el cliente?</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {METODOS.map(m => (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            className={cn(
              'flex flex-col items-center gap-3 rounded-xl border-2 px-5 py-7 transition-all duration-150 text-center',
              metodo === m.value
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:bg-muted/30',
            )}
          >
            {m.icon}
            <div>
              <p className="font-semibold text-sm">{m.label}</p>
              <p className={cn('text-[11px] mt-0.5', metodo === m.value ? 'text-background/70' : 'text-muted-foreground/70')}>
                {m.desc}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Paso 4 — Confirmar ────────────────────────────────────────────────────────
function PasoConfirmar({
  carrito, cliente, metodo,
}: {
  carrito: ReturnType<typeof calcularCarrito>;
  cliente: Cliente | null;
  metodo: MetodoPago;
}) {
  const metodoInfo = METODOS.find(m => m.value === metodo)!;
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Resumen de la venta</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Verifica los detalles antes de confirmar</p>
      </div>

      {/* Productos */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="divide-y divide-border/50">
          {carrito.items.map(item => (
            <div key={item.producto.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{item.producto.nombre}</p>
                <p className="text-[11px] text-muted-foreground">
                  {item.cantidad} × {formatCurrency(item.precio_unitario)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{formatCurrency(item.subtotal)}</p>
                {item.descuento_aplicado > 0 && (
                  <p className="text-[11px] text-green-700 tabular-nums">−{formatCurrency(item.descuento_aplicado)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-border bg-muted/20 space-y-1">
          {carrito.promocion_aplicada && (
            <div className="flex justify-between text-sm text-green-700 font-medium">
              <span>Descuento promoción</span>
              <span className="tabular-nums">−{formatCurrency(carrito.descuento_total)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(carrito.total)}</span>
          </div>
        </div>
      </div>

      {/* Cliente + método */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border px-4 py-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Cliente</p>
          <div className="flex items-center gap-2">
            <User size={13} className="text-muted-foreground shrink-0" />
            <p className="text-sm font-medium">{cliente?.nombre ?? 'Público general'}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border px-4 py-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Método de pago</p>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{metodoInfo.icon}</span>
            <p className="text-sm font-medium">{metodoInfo.label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pantalla de éxito ─────────────────────────────────────────────────────────
function PantallaExito({
  folio, ventaId, carrito, cliente, metodo, onNueva,
}: {
  folio: string;
  ventaId: number;
  carrito: ReturnType<typeof calcularCarrito>;
  cliente: Cliente | null;
  metodo: MetodoPago;
  onNueva: () => void;
}) {
  const metodoInfo = METODOS.find(m => m.value === metodo)!;
  return (
    <div className="max-w-lg mx-auto space-y-6 py-4">
      {/* Check */}
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={30} className="text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">¡Venta registrada!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Folio: <span className="font-mono font-semibold text-foreground">{folio}</span>
          </p>
        </div>
      </div>

      {/* Detalles */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="divide-y divide-border/50">
          {carrito.items.map(item => (
            <div key={item.producto.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm font-medium">{item.producto.nombre}</p>
                <p className="text-[11px] text-muted-foreground">{item.cantidad} × {formatCurrency(item.precio_unitario)}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(item.subtotal)}</p>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-border bg-muted/20 space-y-1">
          {carrito.promocion_aplicada && (
            <div className="flex justify-between text-sm text-green-700 font-medium">
              <span>Descuento</span>
              <span className="tabular-nums">−{formatCurrency(carrito.descuento_total)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg">
            <span>Total cobrado</span>
            <span className="tabular-nums">{formatCurrency(carrito.total)}</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-border px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1">Cliente</p>
          <p className="font-medium">{cliente?.nombre ?? 'Público general'}</p>
        </div>
        <div className="rounded-xl border border-border px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1">Método</p>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground [&_svg]:size-3">{metodoInfo.icon}</span>
            <p className="font-medium">{metodoInfo.label}</p>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <a
          href={`/api/pdf/${ventaId}`}
          target="_blank"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          <FileDown size={15} />
          Descargar PDF
        </a>
        <Button variant="default" className="flex-1" onClick={onNueva}>
          <Plus size={13} />
          Nueva venta
        </Button>
      </div>
    </div>
  );
}

// ─── Formulario rápido de nuevo cliente ────────────────────────────────────────
function NuevoClienteModal({
  open, onClose, onCreado,
}: {
  open: boolean;
  onClose: () => void;
  onCreado: (c: Cliente) => void;
}) {
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: { nombre: '', telefono: '', email: '' },
  });

  function onSubmit(data: ClienteFormValues) {
    startTransition(async () => {
      const r = await crearCliente(data);
      if (r?.error) { toast.error(r.error); return; }
      const nuevo: Cliente = {
        id: r.id!, nombre: data.nombre,
        telefono: data.telefono || null, email: data.email || null,
        creado_at: new Date().toISOString(),
      };
      reset();
      onCreado(nuevo);
      toast.success('Cliente registrado.');
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <DialogTitle className="text-sm font-semibold">Nuevo cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="px-5 py-4 space-y-3">
            <FormField label="Nombre completo" placeholder="Ej. María García"
              error={errors.nombre?.message} autoFocus {...register('nombre')} />
            <FormField label="Teléfono" hint="opcional" placeholder="55 1234 5678"
              error={errors.telefono?.message} {...register('telefono')} />
            <FormField label="Email" hint="opcional" type="email" placeholder="correo@ejemplo.com"
              error={errors.email?.message} {...register('email')} />
          </div>
          <div className="flex justify-end gap-2 px-5 pb-4 border-t border-border/60 pt-3">
            <Button type="button" variant="ghost" onClick={onClose}><X size={13} /> Cancelar</Button>
            <Button type="submit" variant="default" disabled={pending}>
              {pending ? 'Guardando…' : 'Crear cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal buscador de productos ───────────────────────────────────────────────
function BuscadorProductos({
  open, onClose, onAgregar,
}: {
  open: boolean;
  onClose: () => void;
  onAgregar: (p: Producto) => void;
}) {
  const [query, setQuery]         = useState('');
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [buscando, setBuscando]   = useState(false);

  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 1) { setResultados([]); return; }
    setBuscando(true);
    const r = await buscarProductosPOS(q);
    setResultados(r);
    setBuscando(false);
  }, []);

  function handleQuery(q: string) {
    setQuery(q);
    buscar(q);
  }

  function seleccionar(p: Producto) {
    onAgregar(p);
    setQuery('');
    setResultados([]);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setQuery(''); setResultados([]); onClose(); } }}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/60">
          <DialogTitle className="text-sm font-semibold">Buscar producto</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Nombre o SKU del producto…"
              value={query}
              onChange={e => handleQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto divide-y divide-border/50 pb-2">
          {buscando && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">Buscando…</div>
          )}
          {!buscando && query.length >= 1 && resultados.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Sin resultados para "{query}"
            </div>
          )}
          {!buscando && query.length < 1 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Escribe para buscar productos
            </div>
          )}
          {resultados.map(p => {
            const precio = p.precio_descuento ?? p.precio;
            const stock  = Number(p.stock ?? 0);
            return (
              <button
                key={p.id}
                onClick={() => seleccionar(p)}
                disabled={stock <= 0}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {p.imagen_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagen_url} alt={p.nombre}
                    className="h-9 w-9 rounded-md object-cover shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Package size={14} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.nombre}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-mono text-muted-foreground">{p.sku}</span>
                    <Badge
                      variant={stock > 0 ? 'outline' : 'destructive'}
                      className="text-[10px] h-4 px-1"
                    >
                      {stock > 0 ? `${stock} disp.` : 'Sin stock'}
                    </Badge>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(precio)}</p>
                  {p.precio_descuento && (
                    <p className="text-[11px] text-muted-foreground line-through tabular-nums">
                      {formatCurrency(p.precio)}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function NuevaVentaClient({
  sesionCajaId, clientesIniciales, productosIniciales,
}: {
  sesionCajaId: number;
  clientesIniciales: Cliente[];
  productosIniciales: Producto[];
}) {
  const router = useRouter();

  // Estado wizard
  const [paso, setPaso]           = useState(1);
  const [lineas, setLineas]       = useState<LineaCarrito[]>([]);
  const [cliente, setCliente]     = useState<Cliente | null>(null);
  const [metodo, setMetodo]       = useState<MetodoPago>('efectivo');
  const [exitosa, setExitosa]     = useState<VentaExitosa | null>(null);
  const [pending, startTransition] = useTransition();

  // Buscador de productos (modal)
  const [modalProductos, setModalProductos] = useState(false);

  // Buscador de clientes (inline)
  const [clienteQuery, setClienteQuery]         = useState('');
  const [clienteResultados, setClienteResultados] = useState<Cliente[]>([]);
  const [clienteBuscando, setClienteBuscando]     = useState(false);
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);

  const carrito = calcularCarrito(lineas);

  // ── Carrito ────────────────────────────────────────────────────────────────
  function agregarProducto(p: Producto) {
    setLineas(prev => {
      const idx = prev.findIndex(l => l.producto.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + 1 };
        return next;
      }
      return [...prev, { producto: p, cantidad: 1 }];
    });
  }

  function cambiarCantidad(id: number, delta: number) {
    setLineas(prev =>
      prev.map(l => l.producto.id === id
        ? { ...l, cantidad: Math.max(1, l.cantidad + delta) }
        : l
      )
    );
  }

  function eliminarLinea(id: number) {
    setLineas(prev => prev.filter(l => l.producto.id !== id));
  }

  // ── Búsqueda de clientes ───────────────────────────────────────────────────
  async function handleClienteQuery(q: string) {
    setClienteQuery(q);
    if (q.trim().length < 2) { setClienteResultados([]); return; }
    setClienteBuscando(true);
    const r = await buscarClientes(q);
    setClienteResultados(r);
    setClienteBuscando(false);
  }

  // ── Confirmar venta ────────────────────────────────────────────────────────
  function confirmar() {
    startTransition(async () => {
      const r = await procesarVenta({
        lineas,
        metodo_pago:    metodo,
        cliente_id:     cliente?.id ?? null,
        sesion_caja_id: sesionCajaId,
      });
      if (r?.error) { toast.error(r.error); return; }
      setExitosa({ ventaId: r.ventaId!, folio: r.folio! });
    });
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function nuevaVenta() {
    setPaso(1);
    setLineas([]);
    setCliente(null);
    setMetodo('efectivo');
    setExitosa(null);
    setClienteQuery('');
    setClienteResultados([]);
  }

  // ── Validación por paso ────────────────────────────────────────────────────
  const puedeSiguiente =
    (paso === 1 && lineas.length > 0) ||
    paso === 2 ||
    paso === 3 ||
    paso === 4;

  // ── Pantalla éxito ─────────────────────────────────────────────────────────
  if (exitosa) {
    return (
      <div className="max-w-2xl">
        <PantallaExito
          folio={exitosa.folio}
          ventaId={exitosa.ventaId}
          carrito={carrito}
          cliente={cliente}
          metodo={metodo}
          onNueva={nuevaVenta}
        />
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-6 mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
         
          <div>
            <h1 className="text-lg font-semibold leading-tight">Nueva venta</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Paso {paso} de {PASOS.length}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/ventas')}>
          <X size={13} />
          Cancelar
        </Button>
      </div>

      {/* Stepper */}
      <Stepper paso={paso} />

      {/* Contenido del paso */}
      <div className="min-h-[360px]">
        {paso === 1 && (
          <PasoProductos
            lineas={lineas}
            carrito={carrito}
            onAbrirBuscador={() => setModalProductos(true)}
            onCantidad={cambiarCantidad}
            onEliminar={eliminarLinea}
          />
        )}
        {paso === 2 && (
          <PasoCliente
            cliente={cliente}
            query={clienteQuery}
            resultados={clienteResultados}
            buscando={clienteBuscando}
            onQueryChange={handleClienteQuery}
            onSeleccionar={c => { setCliente(c); setClienteQuery(''); setClienteResultados([]); }}
            onQuitar={() => setCliente(null)}
            onNuevo={() => setModalNuevoCliente(true)}
          />
        )}
        {paso === 3 && <PasoPago metodo={metodo} onChange={setMetodo} />}
        {paso === 4 && <PasoConfirmar carrito={carrito} cliente={cliente} metodo={metodo} />}
      </div>

      {/* Navegación */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={() => setPaso(p => p - 1)} disabled={paso === 1}>
          <ArrowLeft size={13} />
          Anterior
        </Button>

        <div className="flex items-center gap-1.5">
          {PASOS.map(p => (
            <div key={p.n} className={cn(
              'h-1.5 rounded-full transition-all duration-200',
              paso === p.n ? 'w-6 bg-foreground' : 'w-1.5 bg-border',
            )} />
          ))}
        </div>

        {paso < 4 ? (
          <Button variant="default" onClick={() => setPaso(p => p + 1)} disabled={!puedeSiguiente}>
            Siguiente
            <ArrowRight size={13} />
          </Button>
        ) : (
          <Button variant="default" onClick={confirmar} disabled={pending || lineas.length === 0}>
            {pending ? 'Procesando…' : 'Confirmar venta'}
          </Button>
        )}
      </div>

      {/* Modales */}
      <BuscadorProductos
        open={modalProductos}
        onClose={() => setModalProductos(false)}
        onAgregar={p => { agregarProducto(p); setModalProductos(false); }}
      />
      <NuevoClienteModal
        open={modalNuevoCliente}
        onClose={() => setModalNuevoCliente(false)}
        onCreado={c => { setCliente(c); setModalNuevoCliente(false); }}
      />
    </div>
  );
}
