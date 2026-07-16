'use client';

import { reload } from '@/hooks/use-reload';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { FormField } from '@/components/ui/form-field';
import { buscarProductosPOS } from '@/actions/productos';
import { buscarClientes, crearCliente } from '@/actions/clientes';
import { procesarVenta } from '@/actions/ventas';
import { cerrarCaja, getSesionAbiertaDetalle } from '@/actions/caja';
import { calcularCarrito, calcularCandidatosDescuento } from '@/lib/promocion';
import { formatCurrency } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { Text } from '@/components/ui/text';
import { zodResolver, clienteSchema, cerrarCajaSchema, type ClienteFormValues, type CerrarCajaFormValues } from '@/lib/validations';
import type { Producto, Cliente, SesionCaja, ItemCarrito } from '@/types';

type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta';
interface Linea { producto: Producto; cantidad: number }
interface Props { sesion: SesionCaja; usuarioNombre: string }

// ─── Formulario cerrar caja ───────────────────────────────────────────────────
function CerrarCajaForm({
  onSubmit, pending, onCancel, montoEsperado,
}: {
  onSubmit: (data: CerrarCajaFormValues) => void;
  pending: boolean;
  onCancel: () => void;
  montoEsperado: number | null;
}) {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CerrarCajaFormValues>({
    resolver: zodResolver(cerrarCajaSchema),
    defaultValues: { saldo_declarado: '' as unknown as number },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-sm text-zinc-600">Cuenta el efectivo físico e ingresa el total que tienes en caja.</p>
      <div className="space-y-1.5">
        <FormField
          label="Saldo declarado (MXN)"
          type="number" min="0" step="0.01" placeholder="0.00"
          error={errors.saldo_declarado?.message}
          {...register('saldo_declarado')}
        />
        {montoEsperado !== null && (
          <button
            type="button"
            onClick={() => setValue('saldo_declarado', montoEsperado, { shouldValidate: true })}
            className="text-xs text-zinc-500 hover:text-zinc-800 hover:underline transition-colors"
          >
            Usar el monto esperado ({formatCurrency(montoEsperado)})
          </button>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? 'Cerrando…' : 'Cerrar caja'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─── Formulario nuevo cliente rápido ─────────────────────────────────────────
function NuevoClienteForm({
  onSubmit, pending, onCancel,
}: {
  onSubmit: (data: ClienteFormValues) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: { nombre: '', telefono: '', email: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 py-2">
      <FormField label="Nombre" error={errors.nombre?.message} {...register('nombre')} />
      <FormField label="Teléfono" error={errors.telefono?.message} {...register('telefono')} />
      <FormField label="Email" type="email" error={errors.email?.message} {...register('email')} />
      <DialogFooter className="pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Creando…' : 'Crear'}</Button>
      </DialogFooter>
    </form>
  );
}

// ─── Componente principal POS ─────────────────────────────────────────────────
export default function PosInterface({ sesion, usuarioNombre }: Props) {
  // Carrito
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [productosConDescuento, setProductosConDescuento] = useState<Set<number>>(new Set());

  // Búsqueda de productos
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<Producto[]>([]);

  // Búsqueda de clientes
  const [clienteQuery, setClienteQuery] = useState('');
  const [clienteResultados, setClienteResultados] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  // Pago
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');

  // Modales
  const [modalPago, setModalPago] = useState(false);
  const [modalCerrarCaja, setModalCerrarCaja] = useState(false);
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [montoEsperado, setMontoEsperado] = useState<number | null>(null);

  const [pending, startTransition] = useTransition();

  const { items, total, descuento_total, promocion_aplicada } = calcularCarrito(lineas, productosConDescuento);
  const candidatosDescuento = calcularCandidatosDescuento(lineas);

  // ── Debounce búsquedas ────────────────────────────────────────────────────
  const buscarProducto = useDebounce(async (val: string) => {
    if (!val.trim()) { setResultados([]); return; }
    setResultados(await buscarProductosPOS(val));
  }, 300);

  const buscarCliente = useDebounce(async (val: string) => {
    if (!val.trim()) { setClienteResultados([]); return; }
    setClienteResultados(await buscarClientes(val));
  }, 300);

  // ── Carrito ───────────────────────────────────────────────────────────────
  function agregarProducto(p: Producto) {
    setLineas(prev => {
      const idx = prev.findIndex(l => l.producto.id === p.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 };
        return updated;
      }
      return [...prev, { producto: p, cantidad: 1 }];
    });
    setQuery('');
    setResultados([]);
  }

  function cambiarCantidad(productoId: number, delta: number) {
    setLineas(prev => prev.map(l =>
      l.producto.id === productoId ? { ...l, cantidad: Math.max(1, l.cantidad + delta) } : l
    ));
  }

  function eliminarLinea(productoId: number) {
    setLineas(prev => prev.filter(l => l.producto.id !== productoId));
    setProductosConDescuento(prev => {
      if (!prev.has(productoId)) return prev;
      const next = new Set(prev);
      next.delete(productoId);
      return next;
    });
  }

  function toggleDescuentoProducto(productoId: number) {
    setProductosConDescuento(prev => {
      const next = new Set(prev);
      if (next.has(productoId)) next.delete(productoId); else next.add(productoId);
      return next;
    });
  }

  // ── Venta ─────────────────────────────────────────────────────────────────
  function handleProcesarVenta() {
    startTransition(async () => {
      const r = await procesarVenta({
        lineas, metodo_pago: metodoPago,
        cliente_id: clienteSeleccionado?.id ?? null,
        sesion_caja_id: sesion.id,
        productosConDescuento: Array.from(productosConDescuento),
      });
      if (r?.error) { toast.error(r.error); return; }
      toast.success(`Venta ${r.folio} registrada.`);
      setModalPago(false);
      setLineas([]);
      setProductosConDescuento(new Set());
      setClienteSeleccionado(null);
      setClienteQuery('');
      window.open(`/api/pdf/${r.ventaId}`, '_blank');
    });
  }

  // ── Cerrar caja ───────────────────────────────────────────────────────────
  function abrirModalCerrarCaja() {
    setModalCerrarCaja(true);
    setMontoEsperado(null);
    // Se pide fresco al abrir (no desde `sesion`, que es del momento en que
    // cargó la página) para que refleje las ventas hechas durante el turno.
    getSesionAbiertaDetalle().then(detalle => {
      if (detalle) setMontoEsperado(Number(detalle.saldo_inicial) + Number(detalle.monto_efectivo));
    });
  }

  function handleCerrarCaja(data: CerrarCajaFormValues) {
    startTransition(async () => {
      const r = await cerrarCaja(sesion.id, data.saldo_declarado);
      if (r?.error) { toast.error(r.error); return; }
      const diff = r.diferencia ?? 0;
      toast.success(`Caja cerrada. ${diff >= 0 ? 'Sobrante' : 'Faltante'}: ${formatCurrency(Math.abs(diff))}`);
      setModalCerrarCaja(false);
      reload();
    });
  }

  // ── Nuevo cliente ─────────────────────────────────────────────────────────
  function handleCrearCliente(data: ClienteFormValues) {
    startTransition(async () => {
      const r = await crearCliente(data);
      if (r?.error) { toast.error(r.error); return; }
      const nuevo: Cliente = { id: r.id!, nombre: data.nombre, telefono: data.telefono || null, email: data.email || null, creado_at: '' };
      setClienteSeleccionado(nuevo);
      setClienteQuery(data.nombre);
      setModalNuevoCliente(false);
      toast.success('Cliente creado.');
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Panel izquierdo */}
      <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <Text as="h2" variant="title">Punto de venta</Text>
            <p className="text-xs text-zinc-500">Vendedor: {usuarioNombre}</p>
          </div>
          <Button size="sm" onClick={abrirModalCerrarCaja}>
            Cerrar caja
          </Button>
        </div>

        {/* Búsqueda productos */}
        <div className="relative">
          <Input
            placeholder="Buscar producto por nombre o SKU…"
            value={query}
            onChange={e => { setQuery(e.target.value); buscarProducto(e.target.value); }}
            autoFocus
          />
          {resultados.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-64 overflow-y-auto">
              {resultados.map(p => (
                <button
                  key={p.id}
                  className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 text-sm border-b last:border-0"
                  onClick={() => agregarProducto(p)}
                >
                  <span className="font-medium">{p.nombre}</span>
                  <span className="text-zinc-400 ml-2 font-mono text-xs">{p.sku}</span>
                  <span className="float-right font-semibold text-zinc-700">
                    {formatCurrency(p.precio_descuento ?? p.precio)}
                    {Number(p.stock) <= 0 && <Badge variant="destructive" className="ml-2 text-xs">Sin stock</Badge>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="flex-1 overflow-auto">
          {lineas.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
              Busca un producto para agregarlo al carrito
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-zinc-500 text-left">
                  <th className="pb-2 pr-3 font-medium">Producto</th>
                  <th className="pb-2 pr-3 font-medium text-center">Cant.</th>
                  <th className="pb-2 pr-3 font-medium text-right">Precio</th>
                  <th className="pb-2 pr-3 font-medium text-right">Dto.</th>
                  <th className="pb-2 pr-3 font-medium text-center">Promo 4+</th>
                  <th className="pb-2 pr-3 font-medium text-right">Subtotal</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: ItemCarrito) => {
                  const esCandidato = candidatosDescuento.some(c => c.producto_id === item.producto.id);
                  return (
                  <tr key={item.producto.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium leading-tight flex items-center gap-1.5">
                        {item.producto.nombre}
                        {item.producto.precio_descuento && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px] border-blue-300 text-blue-700 bg-blue-50">
                            Descuento
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-zinc-400 font-mono">{item.producto.sku}</p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1 justify-center">
                        <Button size="icon" variant="outline" className="h-6 w-6 text-xs" onClick={() => cambiarCantidad(item.producto.id, -1)}>−</Button>
                        <span className="w-6 text-center font-semibold">{item.cantidad}</span>
                        <Button size="icon" variant="outline" className="h-6 w-6 text-xs" onClick={() => cambiarCantidad(item.producto.id, 1)}>+</Button>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      {item.producto.precio_descuento ? (
                        <>
                          <p className="text-[11px] text-zinc-400 line-through leading-tight">{formatCurrency(item.producto.precio)}</p>
                          <p className="text-blue-700">{formatCurrency(item.precio_unitario)}</p>
                        </>
                      ) : (
                        formatCurrency(item.precio_unitario)
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-green-600 font-medium">
                      {item.descuento_aplicado > 0 ? `−${formatCurrency(item.descuento_aplicado)}` : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-center">
                      {esCandidato && (
                        <label className="inline-flex items-center gap-1 text-xs text-zinc-600 cursor-pointer select-none" title="Aplicar 20% de descuento a partir de la 4ta pieza de este producto">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-green-600"
                            checked={productosConDescuento.has(item.producto.id)}
                            onChange={() => toggleDescuentoProducto(item.producto.id)}
                          />
                          20%
                        </label>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold">{formatCurrency(item.subtotal)}</td>
                    <td className="py-2.5">
                      <Button size="sm" variant="ghost" className="text-red-500 h-7 px-2" onClick={() => eliminarLinea(item.producto.id)}>✕</Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Panel derecho: resumen */}
      <div className="w-72 shrink-0 border-l bg-white flex flex-col p-5 gap-4">
        <Text as="h3" variant="title" className="text-base">Resumen</Text>

        {/* Búsqueda cliente */}
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-500">Cliente (opcional)</Label>
          <div className="relative">
            <Input
              placeholder="Buscar cliente…"
              value={clienteSeleccionado ? clienteSeleccionado.nombre : clienteQuery}
              onChange={e => {
                setClienteSeleccionado(null);
                setClienteQuery(e.target.value);
                buscarCliente(e.target.value);
              }}
              className="text-sm h-8"
            />
            {clienteResultados.length > 0 && !clienteSeleccionado && (
              <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {clienteResultados.map(c => (
                  <button key={c.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 border-b last:border-0"
                    onClick={() => { setClienteSeleccionado(c); setClienteResultados([]); }}
                  >
                    {c.nombre} {c.telefono && <span className="text-zinc-400 text-xs">{c.telefono}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="text-xs text-blue-600 hover:underline" onClick={() => setModalNuevoCliente(true)}>
            + Nuevo cliente rápido
          </button>
        </div>

        <Separator />

        {/* Totales */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-zinc-600">
            <span>{lineas.reduce((s, l) => s + l.cantidad, 0)} piezas</span>
          </div>
          {promocion_aplicada && (
            <div className="flex justify-between text-green-600 font-medium">
              <span>Promoción 20%</span>
              <span>−{formatCurrency(descuento_total)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-1">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <Separator />

        {/* Método de pago */}
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-500">Método de pago</Label>
          <Select value={metodoPago} onValueChange={(v) => setMetodoPago(v as MetodoPago)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="efectivo">Efectivo</SelectItem>
              <SelectItem value="transferencia">Transferencia</SelectItem>
              <SelectItem value="tarjeta">Tarjeta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="default" className="w-full mt-auto" size="lg" disabled={lineas.length === 0 || pending} onClick={() => setModalPago(true)}>
          Cobrar {total > 0 && formatCurrency(total)}
        </Button>
      </div>

      {/* Modal confirmar pago */}
      <Dialog open={modalPago} onOpenChange={setModalPago}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar venta</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2 text-sm">
            <div className="flex justify-between"><span>Artículos</span><span>{lineas.reduce((s, l) => s + l.cantidad, 0)}</span></div>
            {promocion_aplicada && (
              <div className="flex justify-between text-green-600"><span>Descuento promoción</span><span>−{formatCurrency(descuento_total)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(total)}</span></div>
            <div className="flex justify-between text-zinc-600"><span>Método</span><span className="capitalize">{metodoPago}</span></div>
            {clienteSeleccionado && (
              <div className="flex justify-between text-zinc-600"><span>Cliente</span><span>{clienteSeleccionado.nombre}</span></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalPago(false)}>Cancelar</Button>
            <Button variant="default" onClick={handleProcesarVenta} disabled={pending}>
              {pending ? 'Procesando…' : 'Confirmar y generar PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal cerrar caja */}
      <Dialog open={modalCerrarCaja} onOpenChange={setModalCerrarCaja}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cerrar caja</DialogTitle></DialogHeader>
          {modalCerrarCaja && (
            <CerrarCajaForm
              onSubmit={handleCerrarCaja}
              pending={pending}
              onCancel={() => setModalCerrarCaja(false)}
              montoEsperado={montoEsperado}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal nuevo cliente */}
      <Dialog open={modalNuevoCliente} onOpenChange={setModalNuevoCliente}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
          {modalNuevoCliente && (
            <NuevoClienteForm
              onSubmit={handleCrearCliente}
              pending={pending}
              onCancel={() => setModalNuevoCliente(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
