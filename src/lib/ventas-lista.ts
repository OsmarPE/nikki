// Reglas de la lista de Ventas (Historial de ventas): qué fecha y qué monto se
// muestran por fila y en qué orden. Funciones puras, sin React, para poder
// probarlas por separado.
import { parseMySQL } from '@/lib/utils';
import type { Venta } from '@/types';

export type EstadoPago = 'pagada' | 'parcial' | 'pendiente';

export function estadoPago(v: Venta): EstadoPago {
  if (v.tipo_venta !== 'credito') return 'pagada';
  const saldo = Number(v.saldo_pendiente ?? 0);
  if (saldo <= 0) return 'pagada';
  if (saldo >= Number(v.total)) return 'pendiente';
  return 'parcial';
}

/** Fecha de la fila: apartado con abonos = su último abono; si no, la de la venta. */
export function fechaFila(v: Venta): string {
  return v.tipo_venta === 'credito' && v.ultimo_abono ? v.ultimo_abono : v.creado_at;
}

/**
 * Monto que acompaña a la fecha de la fila: contado = total de la venta; apartado con
 * abonos = lo abonado el día de su último abono (misma fecha que muestra la fila).
 */
export function montoFila(v: Venta): number {
  if (v.tipo_venta !== 'credito') return Number(v.total);
  if (v.ultimo_abono) return Number(v.abonado_ultimo_dia ?? 0);
  // Sin la columna ultimo_abono (BD sin la migración 007): todo lo abonado.
  return Math.max(0, Number(v.total) - Number(v.saldo_pendiente ?? v.total));
}

/** Momento más reciente en que pasó algo con la venta (se hizo o recibió un abono). Ordena la lista. */
export function ultimaActividad(v: Venta): number {
  const venta = parseMySQL(v.creado_at).getTime();
  const abono = v.ultimo_abono ? parseMySQL(v.ultimo_abono).getTime() : 0;
  return Math.max(venta, abono);
}
