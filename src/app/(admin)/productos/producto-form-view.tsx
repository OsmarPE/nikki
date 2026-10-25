
'use client';

import { useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Save, Trash2, Package,
  Tag, Layers, Award, DollarSign, FileText, Image, PackagePlus, Plus, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FormField, TextareaField, FieldGroup } from '@/components/ui/form-field';
import { ImageUpload } from '@/components/ui/image-upload';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PiezasFolioFields, validarPiezasFolio } from '@/components/ui-custom/piezas-folio-fields';
import { crearProducto, actualizarProducto, eliminarProducto } from '@/actions/productos';
import { registrarMovimientosBatch } from '@/actions/inventario';
import { guardarUltimoFolio } from '@/lib/ultimo-folio';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { urlRetornoProductos } from '@/lib/productos-filtros';
import { zodResolver, productoSchema, type ProductoFormValues } from '@/lib/validations';
import type { Producto, Categoria, Marca, Coleccion, MovimientoInventario } from '@/types';

interface Props {
  producto?: Producto;
  movimientos?: MovimientoInventario[];
  categorias: Categoria[];
  marcas: Marca[];
  colecciones: Coleccion[];
  modo: 'crear' | 'editar';
  /** Permiso inventario:crear — habilita registrar piezas desde aquí. */
  puedeRegistrarPiezas: boolean;
}

const MOTIVO_LABELS: Record<string, string> = {
  venta: 'Venta', compra: 'Compra', devolucion: 'Devolución', ajuste: 'Ajuste',
};

// ─── Sección ──────────────────────────────────────────────────────────────────
function Section({
  icon: Icon, title, description, children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[220px_1fr] gap-8 py-8 px-8">
      {/* Sidebar de la sección */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Icon size={15} className="text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
        </div>
        {description && (
          <p className="text-[12px] text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {/* Contenido */}
      <div>{children}</div>
    </div>
  );
}

// ─── Modal — agregar piezas a un producto existente ───────────────────────────
function AgregarPiezasModal({
  open, onClose, productoId, onRegistrado,
}: {
  open: boolean;
  onClose: () => void;
  productoId: number;
  onRegistrado: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [piezas, setPiezas] = useState('');
  const [folio, setFolio] = useState('');
  const [errores, setErrores] = useState<{ piezas?: string; folio?: string }>({});

  function handleGuardar() {
    const v = validarPiezasFolio(piezas, folio, { permitirCero: false });
    setErrores(v.errores);
    if (v.errores.piezas || v.errores.folio) return;
    startTransition(async () => {
      const r = await registrarMovimientosBatch({
        lineas: [{ producto_id: productoId, tipo: 'entrada', motivo: 'compra', cantidad: v.cantidad }],
        referencia: v.folio,
      });
      if (r?.error) { toast.error(r.error); return; }
      guardarUltimoFolio(v.folio);
      toast.success(`${v.cantidad} ${v.cantidad === 1 ? 'pieza agregada' : 'piezas agregadas'}.`);
      setPiezas(''); setFolio('');
      onRegistrado();
    });
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <DialogTitle className="text-sm font-semibold">Agregar piezas</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4">
          <PiezasFolioFields
            autoFocus
            piezas={piezas} onPiezasChange={setPiezas}
            folio={folio} onFolioChange={setFolio}
            errorPiezas={errores.piezas} errorFolio={errores.folio}
          />
        </div>
        <div className="flex justify-end gap-2 px-5 pb-4 border-t border-border/60 pt-3">
          <Button type="button" variant="ghost" onClick={onClose}><X size={13} /> Cancelar</Button>
          <Button type="button" variant="default" disabled={pending} onClick={handleGuardar}>
            {pending ? 'Guardando…' : 'Agregar piezas'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export default function ProductoFormView({
  producto, movimientos = [], categorias, marcas, colecciones, modo, puedeRegistrarPiezas,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [modalPiezas, setModalPiezas] = useState(false);

  // Piezas iniciales (solo al crear): se registran junto con el alta.
  const [piezas, setPiezas] = useState('');
  const [folio, setFolio] = useState('');
  const [erroresPiezas, setErroresPiezas] = useState<{ piezas?: string; folio?: string }>({});
  // Datos del formulario en espera de confirmar "guardar sin piezas".
  const [sinPiezasPendiente, setSinPiezasPendiente] = useState<ProductoFormValues | null>(null);

  const { register, handleSubmit, control, setValue, watch, formState: { errors, isDirty } } = useForm<ProductoFormValues>({
    resolver: zodResolver(productoSchema),
    defaultValues: producto ? {
      sku:              producto.sku,
      nombre:           producto.nombre,
      precio:           producto.precio,
      precio_descuento: producto.precio_descuento ? producto.precio_descuento : '',
      descripcion:      producto.descripcion ?? '',
      imagen_url:       producto.imagen_url ?? '',
      categoria_id:     producto.categoria_id ? String(producto.categoria_id) : '',
      marca_id:         producto.marca_id ? String(producto.marca_id) : '',
      coleccion_id:     producto.coleccion_id ? String(producto.coleccion_id) : '',
    } : {
      sku: '', nombre: '', precio: '' as unknown as number, precio_descuento: '',
      descripcion: '', imagen_url: '', categoria_id: '', marca_id: '', coleccion_id: '',
    },
  });

  const imagenUrl = watch('imagen_url');
  const stock = Number(producto?.stock ?? 0);

  function onSubmit(data: ProductoFormValues) {
    if (modo === 'crear' && puedeRegistrarPiezas) {
      const v = validarPiezasFolio(piezas, folio, { permitirCero: true });
      setErroresPiezas(v.errores);
      if (v.errores.piezas || v.errores.folio) return;
      if (v.cantidad === 0) { setSinPiezasPendiente(data); return; }
      guardar(data, { cantidad: v.cantidad, referencia: v.folio });
      return;
    }
    guardar(data, null);
  }

  function guardar(data: ProductoFormValues, entradaInicial: { cantidad: number; referencia: string } | null) {
    startTransition(async () => {
      const payload = {
        sku:              data.sku,
        nombre:           data.nombre,
        precio:           Number(data.precio),
        precio_descuento: data.precio_descuento ? Number(data.precio_descuento) : null,
        descripcion:      data.descripcion || undefined,
        imagen_url:       data.imagen_url || null,  // null borra la imagen; undefined la omitiría
        categoria_id:     data.categoria_id ? parseInt(data.categoria_id) : null,
        marca_id:         data.marca_id ? parseInt(data.marca_id) : null,
        coleccion_id:     data.coleccion_id ? parseInt(data.coleccion_id) : null,
      };

      const r = modo === 'crear'
        ? await crearProducto(payload, entradaInicial)
        : await actualizarProducto(producto!.id, payload);

      if (r?.error) { toast.error(r.error); return; }
      if (entradaInicial) guardarUltimoFolio(entradaInicial.referencia);
      toast.success(modo === 'crear' ? 'Producto creado.' : 'Cambios guardados.');
      router.push(urlRetornoProductos());
      router.refresh();
    });
  }

  function handleEliminar() {
    startTransition(async () => {
      const r = await eliminarProducto(producto!.id);
      if (r?.error) { toast.error(r.error); return; }
      toast.success('Producto eliminado.');
      router.push(urlRetornoProductos());
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} className="max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 -ml-2"
            onClick={() => router.push(urlRetornoProductos())}
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              {modo === 'crear' ? 'Nuevo producto' : (producto?.nombre ?? 'Editar producto')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {modo === 'crear'
                ? 'Completa los campos para agregar un producto al catálogo'
                : `SKU: ${producto?.sku}`}
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {modo === 'editar' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmEliminar(true)}
              disabled={pending}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50"
            >
              <Trash2 size={14} />
              Eliminar
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(urlRetornoProductos())}
          >
            Cancelar
          </Button>
          <Button type="submit" size="sm" variant="default" disabled={pending} className="gap-1.5">
            <Save size={14} />
            {pending ? 'Guardando…' : modo === 'crear' ? 'Crear producto' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {/* ── Status bar (solo edición) ── */}
      {modo === 'editar' && (
        <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-muted/40 border border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Stock actual</span>
            <Badge
              variant={stock > 0 ? 'outline' : 'destructive'}
              className="font-mono text-xs font-semibold"
            >
              {stock} {stock === 1 ? 'pieza' : 'piezas'}
            </Badge>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Precio</span>
            <span className={cn('text-xs font-semibold', producto?.precio_descuento && 'line-through text-muted-foreground font-normal')}>
              {formatCurrency(producto?.precio ?? 0)}
            </span>
          </div>
          {producto?.precio_descuento && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Con descuento</span>
                <span className="text-xs font-bold">{formatCurrency(producto.precio_descuento)}</span>
              </div>
            </>
          )}
          <div className="ml-auto">
            <span className="text-[11px] text-muted-foreground">
              Creado {formatDate(producto?.creado_at ?? '')}
            </span>
          </div>
        </div>
      )}

      {/* ── Contenido principal ── */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border/60">

        {/* Imagen */}
        <Section icon={Image} title="Imagen" description="Foto principal que se mostrará en el catálogo y en los comprobantes.">
          <ImageUpload
            value={imagenUrl ?? ''}
            onChange={url => setValue('imagen_url', url, { shouldValidate: true })}
          />
          {errors.imagen_url && (
            <p className="text-[11px] text-destructive mt-1.5">{errors.imagen_url.message}</p>
          )}
        </Section>

        {/* Información general */}
        <Section
          icon={FileText}
          title="Información general"
          description="Identificador único, nombre visible y descripción del producto."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <FormField
                label="SKU"
                placeholder="ej. ZAP-001"
                className="font-mono uppercase"
                error={errors.sku?.message}
                description="Código único de identificación"
                {...register('sku')}
              />
              <FormField
                label="Nombre del producto"
                placeholder="ej. Zapatilla Running Pro"
                error={errors.nombre?.message}
                {...register('nombre')}
              />
            </div>
            <TextareaField
              label="Descripción"
              hint="opcional"
              placeholder="Describe brevemente el producto, materiales, tallas, etc."
              rows={3}
              error={errors.descripcion?.message}
              {...register('descripcion')}
            />
          </div>
        </Section>

        {/* Precios */}
        <Section
          icon={DollarSign}
          title="Precios"
          description="Ajuste de precios. Si el precio no quieres que tenga descuento, deja el campo en blanco."
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Precio base"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              error={errors.precio?.message}
              description="Precio de lista sin descuento"
              {...register('precio')}
            />
            <FormField
              label="Precio de Descuento"
              hint="opcional"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              error={errors.precio_descuento?.message}
              description="Precio que aparece en el POS"
              {...register('precio_descuento')}
            />
          </div>
        </Section>

        {/* Clasificación */}
        <Section
          icon={Tag}
          title="Clasificación"
          description="Categoriza el producto para facilitar la búsqueda y los filtros."
        >
          <div className="grid grid-cols-3 gap-4">
            {([
              { name: 'categoria_id' as const, label: 'Categoría', icon: Tag, items: categorias, placeholder: 'Sin categoría' },
              { name: 'marca_id' as const,     label: 'Marca',     icon: Award, items: marcas, placeholder: 'Sin marca' },
              { name: 'coleccion_id' as const, label: 'Colección', icon: Layers, items: colecciones.filter(c => !c.deleted_at), placeholder: 'Sin colección' },
            ] as const).map(({ name, label, icon: Icon, items, placeholder }) => (
              <div key={name} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon size={11} className="text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">{label}</span>
                </div>
                <Controller
                  name={name}
                  control={control}
                  render={({ field }) => (
                    <Select
                      items={{ '': placeholder, ...Object.fromEntries(items.map(i => [String(i.id), i.nombre])) }}
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="h-8 text-sm w-full">
                        <SelectValue placeholder={placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="" label={placeholder}>{placeholder}</SelectItem>
                        {items.map(i => (
                          <SelectItem key={i.id} value={String(i.id)} label={i.nombre}>{i.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Piezas iniciales (solo alta): evita productos nuevos en 0 por olvidar Inventario */}
        {modo === 'crear' && puedeRegistrarPiezas && (
          <Section
            icon={PackagePlus}
            title="Piezas iniciales"
            description="Piezas que llegaron de este producto y el folio de la nota del proveedor. Se registran en Inventario al guardar."
          >
            <PiezasFolioFields
              piezas={piezas} onPiezasChange={v => { setPiezas(v); setErroresPiezas({}); }}
              folio={folio} onFolioChange={v => { setFolio(v); setErroresPiezas({}); }}
              errorPiezas={erroresPiezas.piezas} errorFolio={erroresPiezas.folio}
            />
          </Section>
        )}

        {/* Historial de movimientos (solo edición) */}
        {modo === 'editar' && (
          <Section
            icon={Package}
            title="Historial de inventario"
            description="Últimos movimientos registrados para este producto."
          >
            {puedeRegistrarPiezas && (
              <div className="flex justify-end mb-3">
                <Button type="button" size="sm" variant="outline" onClick={() => setModalPiezas(true)}>
                  <Plus size={13} /> Agregar piezas
                </Button>
              </div>
            )}
            {movimientos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package size={28} className="text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Sin movimientos registrados</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Los movimientos de entrada y salida aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tipo</th>
                      <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Motivo</th>
                      <th className="text-right px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Cantidad</th>
                      <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Usuario</th>
                      <th className="text-left px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Referencia</th>
                      <th className="text-right px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {movimientos.slice(0, 10).map(m => (
                      <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5">
                          <Badge
                            variant={m.tipo === 'entrada' ? 'outline' : 'secondary'}
                            className={`text-[11px] font-medium ${m.tipo === 'entrada' ? 'text-green-700 border-green-300' : 'text-red-600'}`}
                          >
                            {m.tipo === 'entrada' ? '↑ Entrada' : '↓ Salida'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground capitalize">
                          {MOTIVO_LABELS[m.motivo] ?? m.motivo}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold">
                          {m.tipo === 'entrada' ? '+' : '−'}{m.cantidad}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {m.usuario_nombre ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">
                          {m.referencia ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground text-xs">
                          {formatDate(m.creado_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {movimientos.length > 10 && (
                  <div className="border-t border-border px-3 py-2 bg-muted/20 text-center">
                    <p className="text-[11px] text-muted-foreground">
                      Mostrando 10 de {movimientos.length} movimientos
                    </p>
                  </div>
                )}
              </div>
            )}
          </Section>
        )}
      </div>

      {modo === 'editar' && producto && (
        <AgregarPiezasModal
          open={modalPiezas}
          onClose={() => setModalPiezas(false)}
          productoId={producto.id}
          onRegistrado={() => { setModalPiezas(false); router.refresh(); }}
        />
      )}

      <ConfirmDialog
        open={sinPiezasPendiente !== null}
        onOpenChange={o => { if (!o) setSinPiezasPendiente(null); }}
        title="¿Guardar sin piezas?"
        description="El producto quedará con 0 piezas y aparecerá como «Sin entradas» hasta que se le registren."
        confirmLabel="Sí, guardar en 0"
        onConfirm={() => { const d = sinPiezasPendiente; setSinPiezasPendiente(null); if (d) guardar(d, null); }}
        pending={pending}
      />

      <ConfirmDialog
        open={confirmEliminar}
        onOpenChange={setConfirmEliminar}
        title="Eliminar producto"
        description={`¿Estás seguro de que deseas eliminar "${producto?.nombre}"?`}
        confirmLabel="Sí, eliminar producto"
        onConfirm={handleEliminar}
        pending={pending}
      />

      {/* ── Footer flotante con cambios sin guardar ── */}
      {isDirty && (
        <div className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/95 backdrop-blur-sm px-4 py-3 shadow-lg">
          <p className="text-sm text-muted-foreground">Tienes cambios sin guardar</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => router.push(urlRetornoProductos())}>
              Descartar
            </Button>
            <Button type="submit" size="sm" variant="default" disabled={pending} className="gap-1.5">
              <Save size={14} />
              {pending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
