import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

// ─── Zona horaria de la app ───────────────────────────────────────────────────
const TZ = 'America/Mexico_City';

/**
 * Convierte cualquier valor de fecha proveniente de MySQL a un objeto Date.
 *
 * mysql2 sin `dateStrings: true` convierte DATETIME/TIMESTAMP a objetos Date
 * usando la zona del pool (`timezone: '+00:00'`), por lo que ya llegan en UTC.
 *
 * Cuando sí llegan como string (ej. columnas calculadas, DATE_FORMAT, etc.)
 * pueden venir sin sufijo 'Z', así que los normalizamos.
 */
function parseMySQL(value: Date | string | null | undefined): Date {
  if (!value) return new Date(NaN);

  // mysql2 ya lo convirtió a Date correctamente (UTC)
  if (value instanceof Date) return value;

  // String con offset explícito → parsear directo
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value);

  // String de MySQL sin zona ("2024-11-01 14:30:00" o "2024-11-01T14:30:00")
  // El pool usa timezone '+00:00' → estos valores son UTC, añadir Z
  return new Date(value.replace(' ', 'T') + 'Z');
}

// ─── Funciones de formato ─────────────────────────────────────────────────────

/** "01/11/2024" */
export function formatDate(value: Date | string | null | undefined): string {
  const d = parseMySQL(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: TZ,
  });
}

/** "viernes, 1 de noviembre de 2024" */
export function formatDateLong(value: Date | string | null | undefined): string {
  const d = parseMySQL(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: TZ,
  });
}

/** "14:30" */
export function formatTime(value: Date | string | null | undefined): string {
  const d = parseMySQL(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
    timeZone: TZ,
  });
}

export function formatTimeShort(value: string): string {
    return new Date(value).toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit'
    });
}

/** "01/11/2024 14:30" */
export function formatDateTime(value: Date | string | null | undefined): string {
  const d = parseMySQL(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: TZ,
  });
}

// ─── Helpers para filtros SQL (devuelven YYYY-MM-DD en zona local) ─────────────

/** "2024-11-01" — hoy en zona local */
export function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** "2024-11-01" — ayer en zona local */
export function yesterdayLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

/** "2024-11-01" — primer día del mes actual en zona local */
export function monthStartLocal(): string {
  const [year, month] = new Date()
    .toLocaleDateString('en-CA', { timeZone: TZ })
    .split('-');
  return `${year}-${month}-01`;
}