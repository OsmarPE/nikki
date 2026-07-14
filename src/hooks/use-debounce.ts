import { useEffect, useRef } from 'react';

/**
 * Ejecuta `callback` después de `delay` ms desde el último cambio de `value`.
 * Cancela la ejecución si el componente se desmonta.
 */
export function useDebounce<T>(callback: (value: T) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (value: T) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callback(value), delay);
  };
}
