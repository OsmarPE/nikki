// Opciones del export de ventas a Excel (página /dashboard/exportar).
// Compartido entre la página (cliente), la vista previa (server action) y el
// route handler /api/export/ventas, que reciben las mismas opciones por URL.

import { todayLocal } from '@/lib/utils';

export const METODOS_PAGO = ['efectivo', 'transferencia', 'tarjeta'] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta',
};

export const HOJAS = [
  { key: 'resumen',   label: 'Resumen',             descripcion: 'Totales por día y cobrado por método de pago.' },
  { key: 'ventas',    label: 'Ventas',              descripcion: 'Una fila por venta: cliente, vendedor, total y saldo.' },
  { key: 'detalle',   label: 'Detalle de productos', descripcion: 'Una fila por producto vendido en cada venta.' },
  { key: 'productos', label: 'Por producto',        descripcion: 'Ranking de productos más vendidos (piezas e importe).' },
  { key: 'abonos',    label: 'Abonos recibidos',    descripcion: 'Cada abono cobrado en el periodo y quién lo cobró.' },
] as const;
export type Hoja = (typeof HOJAS)[number]['key'];

export interface ExportVentasOpciones {
  desde: string;              // YYYY-MM-DD
  hasta: string;              // YYYY-MM-DD
  tipo: 'todos' | 'contado' | 'credito';
  /** Vacío = todos los métodos. */
  metodos: MetodoPago[];
  /** Vacío = todos los vendedores. */
  vendedores: number[];
  hojas: Hoja[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HOJA_KEYS = HOJAS.map(h => h.key) as readonly string[];

// ─── Aritmética de fechas sobre 'YYYY-MM-DD' (sin zonas horarias) ────────────
function aUTC(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function aStr(d: Date) { return d.toISOString().slice(0, 10); }
function sumarDias(s: string, n: number) { const d = aUTC(s); d.setUTCDate(d.getUTCDate() + n); return aStr(d); }

/** Primer y último día de un mes ('2026-10' → ['2026-10-01', '2026-10-31']). */
export function rangoMes(ym: string): [string, string] {
  const [y, m] = ym.split('-').map(Number);
  return [aStr(new Date(Date.UTC(y, m - 1, 1))), aStr(new Date(Date.UTC(y, m, 0)))];
}

/** Últimos `n` meses, del actual hacia atrás: [{ value: '2026-10', label: 'Octubre 2026' }, …]. */
export function mesesRecientes(n: number): { value: string; label: string }[] {
  const [y, m] = todayLocal().split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .replace(' de ', ' ');
    return { value: aStr(d).slice(0, 7), label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
}

export const PRESETS_PERIODO = [
  { key: 'este-mes',     label: 'Este mes' },
  { key: 'mes-anterior', label: 'Mes anterior' },
  { key: 'esta-semana',  label: 'Esta semana' },
  { key: 'semana-pasada', label: 'Semana pasada' },
  { key: 'ultimos-30',   label: 'Últimos 30 días' },
  { key: 'este-anio',    label: 'Este año' },
] as const;
export type PresetPeriodo = (typeof PRESETS_PERIODO)[number]['key'];

export function rangoPreset(key: PresetPeriodo): [string, string] {
  const hoy = todayLocal();
  const lunes = sumarDias(hoy, -((aUTC(hoy).getUTCDay() + 6) % 7)); // semana de lunes a domingo
  switch (key) {
    case 'este-mes':      return [hoy.slice(0, 8) + '01', hoy];
    case 'mes-anterior':  return rangoMes(sumarDias(hoy.slice(0, 8) + '01', -1).slice(0, 7));
    case 'esta-semana':   return [lunes, hoy];
    case 'semana-pasada': return [sumarDias(lunes, -7), sumarDias(lunes, -1)];
    case 'ultimos-30':    return [sumarDias(hoy, -29), hoy];
    case 'este-anio':     return [hoy.slice(0, 5) + '01-01', hoy];
  }
}

export function opcionesPorDefecto(): ExportVentasOpciones {
  const [desde, hasta] = rangoPreset('este-mes');
  return { desde, hasta, tipo: 'todos', metodos: [], vendedores: [], hojas: HOJAS.map(h => h.key) };
}

/** Valida opciones que llegan del cliente; null si el rango no es válido. */
export function validarOpciones(o: ExportVentasOpciones): ExportVentasOpciones | null {
  if (!DATE_RE.test(o.desde) || !DATE_RE.test(o.hasta) || o.desde > o.hasta) return null;
  return {
    desde: o.desde,
    hasta: o.hasta,
    tipo: o.tipo === 'contado' || o.tipo === 'credito' ? o.tipo : 'todos',
    metodos: o.metodos.filter((m): m is MetodoPago => (METODOS_PAGO as readonly string[]).includes(m)),
    vendedores: o.vendedores.map(Number).filter(n => Number.isInteger(n) && n > 0),
    hojas: o.hojas.filter((h): h is Hoja => HOJA_KEYS.includes(h)),
  };
}

// ─── URL ⇄ opciones ───────────────────────────────────────────────────────────
export function opcionesAQuery(o: ExportVentasOpciones): string {
  const p = new URLSearchParams({ desde: o.desde, hasta: o.hasta });
  if (o.tipo !== 'todos') p.set('tipo', o.tipo);
  o.metodos.forEach(m => p.append('metodo', m));
  o.vendedores.forEach(v => p.append('vendedor', String(v)));
  o.hojas.forEach(h => p.append('hoja', h));
  return p.toString();
}

export function opcionesDesdeQuery(p: URLSearchParams): ExportVentasOpciones | null {
  const def = opcionesPorDefecto();
  const hojas = p.getAll('hoja');
  return validarOpciones({
    desde: p.get('desde') ?? def.desde,
    hasta: p.get('hasta') ?? def.hasta,
    tipo: (p.get('tipo') ?? 'todos') as ExportVentasOpciones['tipo'],
    metodos: p.getAll('metodo') as MetodoPago[],
    vendedores: p.getAll('vendedor').map(Number),
    hojas: (hojas.length ? hojas : def.hojas) as Hoja[],
  });
}
