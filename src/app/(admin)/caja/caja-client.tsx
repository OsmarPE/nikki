'use client';

import { useState, useMemo } from 'react';
import { usePagination } from '@/hooks/use-pagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Banknote, CreditCard, ArrowRightLeft, TrendingUp,
  CheckCircle2, AlertCircle, Clock, Users, Hash,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { cn, formatCurrency, formatDate, formatTime, formatDateTime, formatTimeShort } from '@/lib/utils';
import type { SesionCajaDetalle } from '@/actions/caja';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// mysql2 puede entregar DATETIME como Date o como string sin timezone
// ("YYYY-MM-DD HH:MM:SS"); normalizar ambos casos como UTC.
function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(String(v).replace(' ', 'T') + 'Z');
}

function duracion(apertura: Date | string, cierre: Date | string | null): string {
  const fin = cierre ? toDate(cierre) : new Date();
  const ms  = fin.getTime() - toDate(apertura).getTime();
  const h   = Math.floor(ms / 3_600_000);
  const m   = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className="px-4 py-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className={cn('text-xl font-bold tracking-tight truncate', highlight && 'text-green-700')}>
            {value}
          </p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 ml-2">
          <Icon size={14} className="text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}

// ─── Fila expandible de sesión ────────────────────────────────────────────────
function FilaSesion({ s }: { s: SesionCajaDetalle }) {
  const [open, setOpen] = useState(false);
  const abierta    = s.estado === 'abierta';
  const diferencia = Number(s.diferencia ?? 0);

  return (
    <div className="border-b border-border/50 last:border-0">
      {/* Fila principal */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Estado */}
        <div className="shrink-0">
          {abierta ? (
            <div className="h-2 w-2 rounded-full bg-green-500 ring-2 ring-green-500/20 mt-0.5" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-zinc-300 mt-0.5" />
          )}
        </div>

        {/* Vendedor */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{s.usuario_nombre}</p>
            <Badge
              variant={abierta ? 'outline' : 'secondary'}
              className={cn('text-[10px] h-4 px-1.5 shrink-0', abierta && 'text-green-700 border-green-300')}
            >
              {abierta ? 'Abierta' : 'Cerrada'}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Apertura {formatTime(s.fecha_apertura)}
            {s.fecha_cierre && ` · Cierre ${formatTime(s.fecha_cierre)}`}
            {' · '}{duracion(s.fecha_apertura, s.fecha_cierre)}
          </p>
        </div>

        {/* Ventas */}
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-sm font-semibold tabular-nums">{formatCurrency(Number(s.total_ventas))}</p>
          <p className="text-[11px] text-muted-foreground">{s.num_transacciones} ventas</p>
        </div>

        {/* Diferencia (solo cajas cerradas) */}
        {!abierta && (
          <div className={cn('text-right shrink-0 hidden md:block w-20', diferencia < 0 ? 'text-red-600' : diferencia > 0 ? 'text-amber-600' : 'text-green-700')}>
            <p className="text-sm font-semibold tabular-nums">
              {diferencia === 0 ? '—' : (diferencia > 0 ? '+' : '') + formatCurrency(diferencia)}
            </p>
            <p className="text-[10px] opacity-70">diferencia</p>
          </div>
        )}

        {/* Chevron */}
        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {/* Detalle expandido */}
      {open && (
        <div className="px-4 pb-4 pt-1 bg-muted/20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg border border-border bg-background px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground mb-1">Saldo inicial</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(Number(s.saldo_inicial))}</p>
            </div>
            <div className="rounded-lg border border-border bg-background px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                <Banknote size={10} /> Efectivo
              </p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(Number(s.monto_efectivo))}</p>
            </div>
            <div className="rounded-lg border border-border bg-background px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                <ArrowRightLeft size={10} /> Transferencia
              </p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(Number(s.monto_transferencia))}</p>
            </div>
            <div className="rounded-lg border border-border bg-background px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                <CreditCard size={10} /> Tarjeta
              </p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(Number(s.monto_tarjeta))}</p>
            </div>
          </div>

          {!abierta && s.saldo_final_declarado != null && (
            <>
              <Separator className="mb-3" />
              <div className="flex items-center gap-6 text-sm flex-wrap">
                <div>
                  <span className="text-[11px] text-muted-foreground mr-1.5">Esperado en caja:</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(Number(s.saldo_final_esperado))}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground mr-1.5">Declarado:</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(Number(s.saldo_final_declarado))}
                  </span>
                </div>
                <div className={cn('font-semibold tabular-nums', diferencia < -1 ? 'text-red-600' : diferencia > 1 ? 'text-amber-600' : 'text-green-700')}>
                  {diferencia === 0
                    ? '✓ Sin diferencia'
                    : diferencia > 0
                    ? `↑ Sobrante ${formatCurrency(Math.abs(diferencia))}`
                    : `↓ Faltante ${formatCurrency(Math.abs(diferencia))}`
                  }
                </div>
              </div>
            </>
          )}

          <p className="text-[11px] text-muted-foreground mt-3">
            Apertura: {formatTimeShort(s.fecha_apertura)}
            {s.fecha_cierre && ` · Cierre: ${formatTimeShort(s.fecha_cierre)}`}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props {
  sesiones: SesionCajaDetalle[];
  resumen: Record<string, number | string> | null;
}

export default function CajaClient({ sesiones, resumen }: Props) {
  const [tab, setTab] = useState<'hoy' | 'historial'>('hoy');

  // Comparar usando fecha local de la zona de la app (no UTC)
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

  const hoy      = useMemo(() => sesiones.filter(s => {
    const localStr = toDate(s.fecha_apertura).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    return localStr === todayStr;
  }), [sesiones, todayStr]);

  const historial = useMemo(() => sesiones.filter(s => {
    const localStr = toDate(s.fecha_apertura).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    return localStr !== todayStr;
  }), [sesiones, todayStr]);

  const lista = tab === 'hoy' ? hoy : historial;
  const { paged: mostradas, ...pag } = usePagination(lista, { pageSize: 15 });

  const cajasAbiertas = Number(resumen?.cajas_abiertas ?? 0);
  const cajasCerradas = Number(resumen?.cajas_cerradas ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Text as="h2" variant="title">Control de caja</Text>
        <Text variant="description">Monitoreo de sesiones y flujo de efectivo</Text>
      </div>

      {/* KPIs del día */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={TrendingUp}
          label="Ingresos del día"
          value={formatCurrency(Number(resumen?.ingresos_totales ?? 0))}
          sub={`${resumen?.num_ventas ?? 0} ventas`}
          highlight
        />
        <KpiCard
          icon={Banknote}
          label="Total efectivo"
          value={formatCurrency(Number(resumen?.total_efectivo ?? 0))}
        />
        <KpiCard
          icon={ArrowRightLeft}
          label="Transferencias"
          value={formatCurrency(Number(resumen?.total_transferencia ?? 0))}
        />
        <KpiCard
          icon={CreditCard}
          label="Tarjeta"
          value={formatCurrency(Number(resumen?.total_tarjeta ?? 0))}
        />
      </div>


      {/* Tabla de sesiones con tabs */}
      <Card className="py-0 gap-0 overflow-hidden">
        {/* Header del card */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium">Sesiones de caja</span>
          </div>
          <Tabs value={tab} onValueChange={v => { setTab(v as 'hoy' | 'historial'); pag.reset(); }}>
            <TabsList className="h-7">
              <TabsTrigger value="hoy" className="text-xs h-6 px-2.5">
                Hoy
                {hoy.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold min-w-[16px] h-3.5 px-1">
                    {hoy.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="historial" className="text-xs h-6 px-2.5">
                Últimos 30 días
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Cabecera de columnas */}
        <div className="grid grid-cols-[20px_1fr_auto_auto_24px] gap-4 px-4 py-2 bg-muted/30 border-b border-border/40">
          <span />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Vendedor</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right hidden sm:block">Ingresos</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right hidden md:block">Diferencia</span>
          <span />
        </div>

        {/* Filas */}
        <div>
          {mostradas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              {tab === 'hoy'
                ? <><Clock size={28} className="opacity-30" /><p className="text-sm">No hay sesiones de caja hoy</p></>
                : <><Hash size={28} className="opacity-30" /><p className="text-sm">Sin sesiones en los últimos 30 días</p></>
              }
            </div>
          ) : (
            mostradas.map(s => <FilaSesion key={s.id} s={s} />)
          )}
        </div>
        {pag.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border/40">
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
          </div>
        )}
      </Card>
    </div>
  );
}
