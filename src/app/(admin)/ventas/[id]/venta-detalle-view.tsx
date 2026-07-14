'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileDown, User, Store,
  CreditCard, Banknote, ArrowRightLeft,
  Package, Hash, Calendar, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDateLong, formatTime } from '@/lib/utils';
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

// ─── Vista principal ──────────────────────────────────────────────────────────
export default function VentaDetalleView({ venta }: { venta: Venta }) {
  const router = useRouter();

  const detalles        = venta.detalles ?? [];
  const descuentoTotal  = detalles.reduce((s, d) => s + Number(d.descuento_aplicado ?? 0), 0);
  const subtotalBruto   = detalles.reduce((s, d) => s + Number(d.subtotal) + Number(d.descuento_aplicado ?? 0), 0);
  const hayDescuento    = descuentoTotal > 0;

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
          label="Total cobrado"
          value={<span className="text-base font-bold">{formatCurrency(Number(venta.total))}</span>}
        />
        <StatCard
          icon={METODO_ICON[venta.metodo_pago] ? CreditCard : CreditCard}
          label="Método de pago"
          value={
            METODO_LABEL[venta.metodo_pago]
          }
        />
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
                <div className="flex items-center gap-12">
                  <span className="text-green-700 font-medium">Descuento</span>
                  <span className="tabular-nums w-28 text-right text-green-700 font-medium">
                    −{formatCurrency(descuentoTotal)}
                  </span>
                </div>
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


    </div>
  );
}
