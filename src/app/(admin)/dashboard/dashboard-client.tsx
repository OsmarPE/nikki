'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, ShoppingCart, Package, Receipt, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardByRange, type DashboardRangeData } from '@/actions/ventas';
import { formatCurrency, todayLocal, monthStartLocal, yesterdayLocal } from '@/lib/utils';

// ─── Utilidades de fecha ──────────────────────────────────────────────────────
// Usar funciones de utils que respetan la zona horaria local de la app
const today      = todayLocal;
const yesterday  = yesterdayLocal;
const monthStart = monthStartLocal;

const PRESETS = [
  { key: 'hoy',       label: 'Hoy',            desde: today,     hasta: today     },
  { key: 'ayer',      label: 'Ayer',            desde: yesterday, hasta: yesterday },
  { key: 'mes',       label: 'Este mes',        desde: monthStart, hasta: today    },
  { key: 'custom',    label: 'Personalizado',   desde: null,      hasta: null      },
] as const;

type PresetKey = (typeof PRESETS)[number]['key'];

// ─── Tooltip del chart ────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const [year, month, day] = (label ?? '').split('-');
  const fecha = `${day}/${month}/${year}`;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-xs">
      <p className="text-muted-foreground mb-1">{fecha}</p>
      <p className="font-semibold text-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card className="px-4 py-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading
            ? <Skeleton className="h-7 w-28 mt-1" />
            : <p className="text-xl font-bold tracking-tight">{value}</p>
          }
          {sub && !loading && (
            <p className="text-[11px] text-muted-foreground">{sub}</p>
          )}
        </div>
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon size={15} className="text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props {
  initialData: DashboardRangeData;
  hoyStats: { total_ventas: number; ingresos: number };
  mesStats: { total_ventas: number; ingresos: number };
  stockTotal: number;
}

export default function DashboardClient({
  initialData, hoyStats, mesStats, stockTotal,
}: Props) {
  const [tab, setTab]       = useState<PresetKey>('mes');
  const [data, setData]     = useState<DashboardRangeData>(initialData);
  const [desde, setDesde]   = useState(monthStart());
  const [hasta, setHasta]   = useState(today());
  const [customDesde, setCustomDesde] = useState(monthStart());
  const [customHasta, setCustomHasta] = useState(today());
  const [pending, startTransition]    = useTransition();

  const fetchData = useCallback((d: string, h: string) => {
    startTransition(async () => {
      const result = await getDashboardByRange(d, h);
      if (result) setData(result);
    });
  }, []);

  // Cambio de pestaña
  function handleTabChange(key: PresetKey) {
    setTab(key);
    if (key === 'custom') return; // espera que el usuario confirme rango
    const preset = PRESETS.find(p => p.key === key)!;
    const d = preset.desde!();
    const h = preset.hasta!();
    setDesde(d);
    setHasta(h);
    fetchData(d, h);
  }

  // Aplicar rango custom
  function applyCustom() {
    setDesde(customDesde);
    setHasta(customHasta);
    fetchData(customDesde, customHasta);
  }

  // Cargar datos al montar
  useEffect(() => {
    fetchData(monthStart(), today());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatXAxis = (tick: string) => {
    const [, m, d] = tick.split('-');
    return `${d}/${m}`;
  };

  const maxIngresos = Math.max(...data.ventas_por_dia.map(d => Number(d.ingresos)), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Text as="h2" variant="title">Dashboard</Text>
          <Text variant="description">Resumen general del negocio</Text>
        </div>
      </div>

      {/* KPI fijos — siempre muestran hoy y el mes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Receipt}     label="Ventas hoy"      value={String(hoyStats.total_ventas)}              sub="transacciones" />
        <KpiCard icon={TrendingUp}  label="Ingresos hoy"    value={formatCurrency(Number(hoyStats.ingresos))}  />
        <KpiCard icon={ShoppingCart}label="Ingresos del mes" value={formatCurrency(Number(mesStats.ingresos))} sub={`${mesStats.total_ventas} ventas`} />
        <KpiCard icon={Package}     label="Stock total"     value={`${stockTotal} pzas`} />
      </div>

      {/* Chart con tabs */}
      <Card className="gap-0 py-0 overflow-hidden">
        {/* Cabecera del card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-muted-foreground" />
            <span className="text-sm font-medium">Ingresos</span>
            {!pending && data.total_ingresos > 0 && (
              <span className="text-xs text-muted-foreground">
                — {formatCurrency(data.total_ingresos)} en el período
              </span>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={v => handleTabChange(v as PresetKey)}>
            <TabsList>
              {PRESETS.map(p => (
                <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Rango custom */}
        {tab === 'custom' && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border/60 bg-muted/30 flex-wrap">
            <Calendar size={13} className="text-muted-foreground shrink-0" />
            <Input
              type="date"
              value={customDesde}
              max={customHasta}
              onChange={e => setCustomDesde(e.target.value)}
              className="h-7 w-36 text-sm"
            />
            <span className="text-xs text-muted-foreground">hasta</span>
            <Input
              type="date"
              value={customHasta}
              min={customDesde}
              max={today()}
              onChange={e => setCustomHasta(e.target.value)}
              className="h-7 w-36 text-sm"
            />
            <Button variant="default" size="sm" onClick={applyCustom} className="h-7">
              Aplicar
            </Button>
          </div>
        )}

        {/* Chart */}
        <div className="px-2 pt-4 pb-3">
          {pending ? (
            <div className="h-64 flex items-center justify-center">
              <Skeleton className="h-48 w-full mx-4" />
            </div>
          ) : data.ventas_por_dia.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <TrendingUp size={28} className="opacity-30" />
              <p className="text-sm">Sin ventas en este período</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.ventas_por_dia} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--foreground))" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={formatXAxis}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  domain={[0, maxIngresos * 1.15 || 100]}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="ingresos"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={1.5}
                  fill="url(#gradIngresos)"
                  dot={data.ventas_por_dia.length <= 7
                    ? { fill: 'hsl(var(--foreground))', r: 3, strokeWidth: 0 }
                    : false
                  }
                  activeDot={{ r: 4, fill: 'hsl(var(--foreground))', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Footer con métricas del período */}
        {!pending && data.ventas_por_dia.length > 0 && (
          <div className="flex items-center gap-6 px-5 py-3 border-t border-border/60 bg-muted/20">
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground">Ventas</p>
              <p className="text-sm font-semibold tabular-nums">{data.total_ventas}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground">Ingresos</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(data.total_ingresos)}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground">Piezas vendidas</p>
              <p className="text-sm font-semibold tabular-nums">{data.productos_vendidos}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
