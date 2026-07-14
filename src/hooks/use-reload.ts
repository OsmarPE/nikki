'use client';

/**
 * Reemplaza window.location.reload() en contextos donde se muestra
 * un toast antes de recargar. Espera `delay` ms para que el toast
 * sea visible antes de destruir el DOM.
 *
 * Uso: import { reload } from '@/hooks/use-reload'
 *      toast.success('Guardado.'); reload();
 */
export function reload(delay = 900) {
  setTimeout(() => window.location.reload(), delay);
}
