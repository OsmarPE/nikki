'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, FileDown, Filter, Sheet as SheetIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getVentasExportPreview, type VentasExportPreview } from '@/actions/ventas';
import { formatCurrency, todayLocal } from '@/lib/utils';
import {
  HOJAS, METODOS_PAGO, METODO_LABEL, PRESETS_PERIODO,
  mesesRecientes, opcionesAQuery, opcionesPorDefecto, rangoMes, rangoPreset,
  type ExportVentasOpciones, type Hoja, type MetodoPago, type PresetPeriodo,
} from '@/lib/export-ventas';

interface Vendedor { id: number; nombre: string; activo: boolean }

// Qué originó el periodo actual, para resaltar el control correspondiente.
type OrigenPeriodo = { tipo: 'preset'; key: PresetPeriodo } | { tipo: 'mes'; ym: string } | { tipo: 'custom' };

const fmtDia = (s: string) => s.split('-').reverse().join('/');

// ─── Controles pequeños ───────────────────────────────────────────────────────
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'inline-flex items-center h-8 rounded-md border px-3 text-sm transition-colors',
        active
          ? 'border-primary/40 bg-primary/5 text-foreground font-medium'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function Check({ checked }: { checked: boolean }) {
  return (
    <span className={[
      'h-4 w-4 rounded-[4px] border shrink-0 flex items-center justify-center transition-colors mt-0.5',
      checked ? 'bg-primary border-primary' : 'border-border bg-background',
    ].join(' ')}>
      {checked && (
        <svg viewBox="0 0 12 12" className="size-2.5 text-primary-foreground fill-none stroke-current" strokeWidth="2.5">
          <polyline points="1.5,6 5,9.5 10.5,2.5" />
        </svg>
      )}
    </span>
  );
}

function Seccion({ icon: Icon, titulo, children }: { icon: React.ElementType; titulo: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/60">
        <Icon size={15} className="text-muted-foreground" />
        <span className="text-sm font-medium">{titulo}</span>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </Card>
  );
}

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {label}{hint && <span className="font-normal text-muted-foreground/70"> · {hint}</span>}
      </p>
      {children}
    </div>
  );
}

function toggle<T>(lista: T[], v: T): T[] {
  return lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v];
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ExportarClient({ vendedores }: { vendedores: Vendedor[] }) {
  const [opciones, setOpciones] = useState<ExportVentasOpciones>(opcionesPorDefecto);
  const [origen, setOrigen] = useState<OrigenPeriodo>({ tipo: 'preset', key: 'este-mes' });
  const [preview, setPreview] = useState<VentasExportPreview | null>(null);
  const [cargandoPreview, startPreview] = useTransition();
  const [exportando, setExportando] = useState(false);
  const ultimaConsulta = useRef('');

  const meses = useMemo(() => mesesRecientes(24), []);
  const hoy = todayLocal();
  const query = opcionesAQuery(opciones);
  const rangoValido = opciones.desde <= opciones.hasta;
  const puedeExportar = rangoValido && opciones.hojas.length > 0;

  // Inactivos al final: siguen siendo útiles para reportes de meses pasados.
  const vendedoresOrdenados = useMemo(
    () => [...vendedores].sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre)),
    [vendedores],
  );

  const set = (patch: Partial<ExportVentasOpciones>) => setOpciones(o => ({ ...o, ...patch }));

  function elegirPreset(key: PresetPeriodo) {
    const [desde, hasta] = rangoPreset(key);
    set({ desde, hasta });
    setOrigen({ tipo: 'preset', key });
  }

  function elegirMes(ym: string) {
    const [desde, finMes] = rangoMes(ym);
    set({ desde, hasta: finMes > hoy ? hoy : finMes });
    setOrigen({ tipo: 'mes', ym });
  }

  // Vista previa: se recalcula (con pausa de 300 ms) cada vez que cambian las opciones.
  // Las hojas no afectan los totales, así que no disparan una nueva consulta.
  const queryPreview = opcionesAQuery({ ...opciones, hojas: [] });
  useEffect(() => {
    if (!rangoValido) return;
    const t = setTimeout(() => {
      ultimaConsulta.current = queryPreview;
      startPreview(async () => {
        const r = await getVentasExportPreview(opciones);
        // Descarta respuestas de consultas que ya no son las actuales.
        if (ultimaConsulta.current === queryPreview) setPreview(r);
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryPreview, rangoValido]);

  async function handleExport() {
    setExportando(true);
    try {
      const res = await fetch(`/api/export/ventas?${query}`);
      if (!res.ok) { toast.error((await res.text()) || 'Error al generar el Excel.'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ventas-${opciones.desde}_${opciones.hasta}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel descargado.');
    } catch { toast.error('Error de red al exportar.'); }
    finally { setExportando(false); }
  }

  const periodoTexto = opciones.desde === opciones.hasta
    ? fmtDia(opciones.desde)
    : `${fmtDia(opciones.desde)} al ${fmtDia(opciones.hasta)}`;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={13} /> Dashboard
        </Link>
        <div>
          <Text as="h2" variant="title">Exportar ventas</Text>
          <Text variant="description">Elige el periodo, los filtros y las hojas que quieres en el Excel</Text>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="space-y-4">
          {/* ─── Periodo ─── */}
          <Seccion icon={Calendar} titulo="Periodo">
            <Campo label="Accesos rápidos">
              <div className="flex flex-wrap gap-2">
                {PRESETS_PERIODO.map(p => (
                  <Chip key={p.key} onClick={() => elegirPreset(p.key)}
                    active={origen.tipo === 'preset' && origen.key === p.key}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </Campo>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Un mes completo">
                <Select
                  items={Object.fromEntries(meses.map(m => [m.value, m.label]))}
                  value={origen.tipo === 'mes' ? origen.ym : null}
                  onValueChange={v => { if (v) elegirMes(v as string); }}
                >
                  <SelectTrigger className="h-8 text-sm w-full"><SelectValue placeholder="Elegir mes…" /></SelectTrigger>
                  <SelectContent>
                    {meses.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Campo>

              <Campo label="Rango personalizado">
                <div className="flex items-center gap-2">
                  <Input type="date" value={opciones.desde} max={hoy}
                    onChange={e => { if (e.target.value) { set({ desde: e.target.value }); setOrigen({ tipo: 'custom' }); } }}
                    className="h-8 text-sm" aria-label="Desde" />
                  <span className="text-xs text-muted-foreground shrink-0">a</span>
                  <Input type="date" value={opciones.hasta} max={hoy}
                    onChange={e => { if (e.target.value) { set({ hasta: e.target.value }); setOrigen({ tipo: 'custom' }); } }}
                    className="h-8 text-sm" aria-label="Hasta" />
                </div>
                {!rangoValido && (
                  <p className="text-xs text-destructive">La fecha inicial debe ser anterior a la final.</p>
                )}
              </Campo>
            </div>
          </Seccion>

          {/* ─── Filtros ─── */}
          <Seccion icon={Filter} titulo="Filtros">
            <Campo label="Tipo de venta">
              <div className="flex flex-wrap gap-2">
                {([['todos', 'Todas'], ['contado', 'Contado'], ['credito', 'Crédito']] as const).map(([v, l]) => (
                  <Chip key={v} active={opciones.tipo === v} onClick={() => set({ tipo: v })}>{l}</Chip>
                ))}
              </div>
            </Campo>

            <Campo label="Método de pago" hint={opciones.metodos.length ? undefined : 'todos'}>
              <div className="flex flex-wrap gap-2">
                {METODOS_PAGO.map(m => (
                  <Chip key={m} active={opciones.metodos.includes(m)}
                    onClick={() => set({ metodos: toggle<MetodoPago>(opciones.metodos, m) })}>
                    {METODO_LABEL[m]}
                  </Chip>
                ))}
              </div>
            </Campo>

            <Campo label="Vendedor" hint={opciones.vendedores.length ? undefined : 'todos'}>
              <div className="flex flex-wrap gap-2">
                {vendedoresOrdenados.map(v => (
                  <Chip key={v.id} active={opciones.vendedores.includes(v.id)}
                    onClick={() => set({ vendedores: toggle(opciones.vendedores, v.id) })}>
                    {v.nombre}{!v.activo && <span className="ml-1 text-[11px] text-muted-foreground/70">(inactivo)</span>}
                  </Chip>
                ))}
              </div>
            </Campo>

            {(opciones.metodos.length > 0 || opciones.vendedores.length > 0) && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                En ventas a crédito, el método y el vendedor de los <b>abonos</b> son los de cada abono
                (quién lo cobró y cómo); en las ventas, el vendedor es quien hizo la venta.
              </p>
            )}
          </Seccion>

          {/* ─── Hojas ─── */}
          <Seccion icon={SheetIcon} titulo="Hojas del archivo">
            <div className="grid gap-1 sm:grid-cols-2 -mx-2">
              {HOJAS.map(h => {
                const checked = opciones.hojas.includes(h.key);
                return (
                  <button key={h.key} type="button" role="checkbox" aria-checked={checked}
                    onClick={() => set({ hojas: toggle<Hoja>(opciones.hojas, h.key) })}
                    className="flex items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent transition-colors">
                    <Check checked={checked} />
                    <span>
                      <span className="block text-sm font-medium">{h.label}</span>
                      <span className="block text-xs text-muted-foreground">{h.descripcion}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {opciones.hojas.length === 0 && (
              <p className="text-xs text-destructive">Selecciona al menos una hoja.</p>
            )}
          </Seccion>
        </div>

        {/* ─── Vista previa ─── */}
        <Card className="gap-0 py-0 overflow-hidden lg:sticky lg:top-6">
          <div className="px-5 py-3 border-b border-border/60">
            <p className="text-sm font-medium">Vista previa</p>
            <p className="text-xs text-muted-foreground">{periodoTexto}</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            {([
              ['Ventas',          preview && String(preview.ventas)],
              ['Piezas vendidas', preview && String(preview.piezas)],
              ['Vendido',         preview && formatCurrency(preview.vendido)],
              ['Cobrado',         preview && formatCurrency(preview.cobrado)],
              ['Saldo pendiente', preview && formatCurrency(preview.saldo)],
              ['Abonos',          preview && String(preview.abonos)],
            ] as const).map(([label, valor]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">{label}</span>
                {cargandoPreview || valor == null
                  ? <Skeleton className="h-4 w-16" />
                  : <span className="text-sm font-semibold tabular-nums">{valor}</span>}
              </div>
            ))}
            {!cargandoPreview && preview?.ventas === 0 && preview.abonos === 0 && (
              <p className="text-xs text-muted-foreground">No hay ventas con estos filtros; el archivo saldrá vacío.</p>
            )}
          </div>
          <div className="px-5 py-3 border-t border-border/60 bg-muted/20">
            <Button className="w-full" onClick={handleExport} disabled={!puedeExportar || exportando}>
              <FileDown size={14} />
              {exportando ? 'Generando…' : 'Descargar Excel'}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              {opciones.hojas.length} {opciones.hojas.length === 1 ? 'hoja' : 'hojas'}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
