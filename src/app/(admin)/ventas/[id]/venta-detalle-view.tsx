'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  ArrowLeft, FileDown, User, Store,
  CreditCard, Banknote, ArrowRightLeft,
  Package, Hash, Calendar, Receipt, Wallet, Plus, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { cn, formatCurrency, formatDateLong, formatTime } from '@/lib/utils';
import { registrarAbono } from '@/actions/ventas';
import { getSesionAbierta } from '@/actions/caja';
import { zodResolver, abonoSchema, type AbonoFormValues } from '@/lib/validations';
import type { Venta } from '@/types';

const METODO_LABEL: Record<string, string> = {
  efectivo:      'Efectivo',
  transferencia: 'Transferencia',
  tarjeta:       'Tarjeta',
};
const METODO_ICON: Record<string, React.ReactNode> = {
  efectivo:      <Banknote size={13} />,
  transferencia: <ArrowRightLeft size={13} />,
  tarjeta:       <CreditCard size={13} />,
};



// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 flex items-start gap-3">
      <div className="mt-0.5 h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-none mb-1">{label}</p>
        <p className="text-sm font-medium leading-tight truncate">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Modal — registrar abono ────────────────────────────────────────────────────
function RegistrarAbonoModal({
  open, onClose, ventaId, saldoPendiente, onRegistrado,
}: {
  open: boolean;
  onClose: () => void;
  ventaId: number;
  saldoPendiente: number;
  onRegistrado: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AbonoFormValues>({
    resolver: zodResolver(abonoSchema),
    defaultValues: { monto: saldoPendiente, metodo_pago: 'efectivo' },
  });

  function onSubmit(data: AbonoFormValues) {
    startTransition(async () => {
      const sesion = await getSesionAbierta();
      if (!sesion) {
        toast.error('Necesitas tener una caja abierta para registrar un abono.');
        return;
      }
      const r = await registrarAbono({
        venta_id: ventaId,
        monto: data.monto,
        metodo_pago: data.metodo_pago,
        sesion_caja_id: sesion.id,
      });
      if (r?.error) { toast.error(r.error); return; }
      toast.success('Abono registrado.');
      reset();
      onRegistrado();
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <DialogTitle className="text-sm font-semibold">Registrar abono</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Saldo pendiente: <span className="font-semibold text-foreground">{formatCurrency(saldoPendiente)}</span>
            </p>
            <FormField label="Monto del abono" type="number" step="0.01" autoFocus
              error={errors.monto?.message} {...register('monto')} />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Método de pago</label>
              <select
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
                {...register('metodo_pago')}
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 pb-4 border-t border-border/60 pt-3">
            <Button type="button" variant="ghost" onClick={onClose}><X size={13} /> Cancelar</Button>
            <Button type="submit" variant="default" disabled={pending}>
              {pending ? 'Guardando…' : 'Registrar abono'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────
export default function VentaDetalleView({ venta }: { venta: Venta }) {
  const router = useRouter();
  const [modalAbono, setModalAbono] = useState(false);

  const detalles          = venta.detalles ?? [];
  const descuentoTotal    = detalles.reduce((s, d) => s + Number(d.descuento_aplicado ?? 0), 0);
  const subtotalBruto     = detalles.reduce((s, d) => s + Number(d.subtotal) + Number(d.descuento_aplicado ?? 0), 0);
  const descuentoGlobal   = Number(venta.descuento_monto ?? 0);
  const hayDescuento      = descuentoTotal > 0 || descuentoGlobal > 0;
  const esCredito         = venta.tipo_venta === 'credito';
  const saldoPendiente    = Number(venta.saldo_pendiente ?? 0);
  const abonos            = venta.abonos ?? [];

  return (
    <div className="max-w-3xl space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -ml-1.5"
            onClick={() => router.push('/ventas')}
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold tracking-tight">
                Venta
              </h1>
              <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                {venta.folio}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
              {formatDateLong(venta.creado_at)} · {formatTime(venta.creado_at)}
            </p>
          </div>
        </div>

        <Button
          onClick={() => window.open(`/api/pdf/${venta.id}`, '_blank')}
          className="gap-1.5"
          variant="outline"
        >
          <FileDown size={14} />
          Descargar PDF
        </Button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Receipt}
          label={esCredito ? 'Total de la venta' : 'Total cobrado'}
          value={<span className="text-base font-bold">{formatCurrency(Number(venta.total))}</span>}
        />
        {esCredito ? (
          <StatCard
            icon={Wallet}
            label="Saldo pendiente"
            value={
              <span className={cn('text-base font-bold', saldoPendiente > 0 ? 'text-amber-600' : 'text-green-600')}>
                {formatCurrency(saldoPendiente)}
              </span>
            }
            sub={saldoPendiente > 0 ? 'Venta a crédito' : 'Liquidada'}
          />
        ) : (
          <StatCard
            icon={CreditCard}
            label="Método de pago"
            value={venta.metodo_pago ? METODO_LABEL[venta.metodo_pago] : '—'}
          />
        )}
        <StatCard
          icon={User}
          label="Cliente"
          value={venta.cliente_nombre ?? 'Público general'}
        />
        <StatCard
          icon={Store}
          label="Vendedor"
          value={venta.usuario_nombre ?? '—'}
        />
      </div>

      {/* ── Panel principal ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">

        {/* Cabecera del panel */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium">
              {detalles.length} {detalles.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Hash size={11} /> ID {String(venta.id).padStart(4, '0')}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={11} /> {formatDateLong(venta.creado_at)}
            </span>
          </div>
        </div>

        {/* Tabla de productos */}
        <div className="px-5">
          {/* Cabecera de columnas */}
          <div className="grid grid-cols-[1fr_80px_100px_100px] gap-3 py-2.5 border-b border-border/40">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Producto</span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-center">Cant.</span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-right">Precio unit.</span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-right">Subtotal</span>
          </div>

          {/* Filas */}
          {detalles.map((d, i) => {
            const tieneDescuento = Number(d.descuento_aplicado) > 0;
            return (
              <div
                key={d.id}
                className={`grid grid-cols-[1fr_80px_100px_100px] gap-3 py-3.5 items-center ${
                  i < detalles.length - 1 ? 'border-b border-border/30' : ''
                }`}
              >
                {/* Producto */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Package size={13} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">
                      {d.producto_nombre ?? '—'}
                    </p>
                    {d.producto_sku && (
                      <p className="text-[11px] font-mono text-muted-foreground">{d.producto_sku}</p>
                    )}
                    {tieneDescuento && (
                      <span className="inline-block mt-0.5 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-px">
                        Descuento −{formatCurrency(Number(d.descuento_aplicado))}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cantidad */}
                <p className="text-sm text-center tabular-nums">{d.cantidad}</p>

                {/* Precio unitario */}
                <div className="text-right">
                  <p className="text-sm tabular-nums">{formatCurrency(Number(d.precio_unitario))}</p>
                  {tieneDescuento && (
                    <p className="text-[11px] text-muted-foreground line-through tabular-nums">
                      {formatCurrency(Number(d.precio_unitario) + Number(d.descuento_aplicado) / d.cantidad)}
                    </p>
                  )}
                </div>

                {/* Subtotal */}
                <p className="text-sm font-semibold text-right tabular-nums">
                  {formatCurrency(Number(d.subtotal))}
                </p>
              </div>
            );
          })}
        </div>

        {/* Totales */}
        <div className="border-t border-border/60 bg-muted/20 px-5 py-4">
          <div className="flex flex-col items-end gap-1.5 text-sm">
            {hayDescuento && (
              <>
                <div className="flex items-center gap-12">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums w-28 text-right">{formatCurrency(subtotalBruto)}</span>
                </div>
                {descuentoTotal > 0 && (
                  <div className="flex items-center gap-12">
                    <span className="text-green-700 font-medium">Descuento promoción</span>
                    <span className="tabular-nums w-28 text-right text-green-700 font-medium">
                      −{formatCurrency(descuentoTotal)}
                    </span>
                  </div>
                )}
                {descuentoGlobal > 0 && (
                  <div className="flex items-center gap-12">
                    <span className="text-green-700 font-medium">
                      Descuento ({venta.descuento_porcentaje}%)
                    </span>
                    <span className="tabular-nums w-28 text-right text-green-700 font-medium">
                      −{formatCurrency(descuentoGlobal)}
                    </span>
                  </div>
                )}
                <Separator className="my-1 w-52" />
              </>
            )}
            <div className="flex items-center gap-12">
              <span className="font-semibold">Total</span>
              <span className="tabular-nums w-28 text-right text-base font-bold">
                {formatCurrency(Number(venta.total))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Historial de abonos (solo ventas a crédito) ── */}
      {esCredito && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-muted/30">
            <div className="flex items-center gap-2">
              <Wallet size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium">Historial de abonos</span>
            </div>
            {saldoPendiente > 0 && (
              <Button size="sm" onClick={() => setModalAbono(true)}>
                <Plus size={13} />
                Registrar abono
              </Button>
            )}
          </div>

          {abonos.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
              Aún no se ha registrado ningún abono.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {abonos.map(a => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                      {METODO_ICON[a.metodo_pago]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{METODO_LABEL[a.metodo_pago]}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateLong(a.creado_at)} · {formatTime(a.creado_at)} · {a.usuario_nombre ?? '—'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(Number(a.monto))}</p>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border/60 bg-muted/20 px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total abonado</span>
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(Number(venta.total) - saldoPendiente)}
            </span>
          </div>
        </div>
      )}

      <RegistrarAbonoModal
        open={modalAbono}
        onClose={() => setModalAbono(false)}
        ventaId={venta.id}
        saldoPendiente={saldoPendiente}
        onRegistrado={() => { setModalAbono(false); router.refresh(); }}
      />
    </div>
  );
}
