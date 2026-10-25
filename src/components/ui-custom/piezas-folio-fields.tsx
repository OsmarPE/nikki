'use client';

import { useSyncExternalStore } from 'react';
import { FormField } from '@/components/ui/form-field';
import { leerUltimoFolio } from '@/lib/ultimo-folio';

const sinSuscripcion = () => () => {};

// Campos "Piezas" + "Folio de la nota" que se usan al dar de alta un producto
// y al agregarle piezas. Ofrece el último folio usado como atajo.
export function PiezasFolioFields({
  piezas, onPiezasChange, folio, onFolioChange, errorPiezas, errorFolio, autoFocus,
}: {
  piezas: string;
  onPiezasChange: (v: string) => void;
  folio: string;
  onFolioChange: (v: string) => void;
  errorPiezas?: string;
  errorFolio?: string;
  autoFocus?: boolean;
}) {
  // En el servidor no hay localStorage: ahí se usa '' y en el cliente el valor guardado.
  const ultimoFolio = useSyncExternalStore(sinSuscripcion, leerUltimoFolio, () => '');

  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        label="Piezas que llegaron"
        type="number"
        min="0"
        step="1"
        placeholder="0"
        autoFocus={autoFocus}
        value={piezas}
        onChange={e => onPiezasChange(e.target.value)}
        error={errorPiezas}
      />
      <div className="space-y-1">
        <FormField
          label="Folio de la nota"
          placeholder="Ej. 7316"
          className="font-mono"
          value={folio}
          onChange={e => onFolioChange(e.target.value)}
          error={errorFolio}
        />
        {ultimoFolio && folio.trim() !== ultimoFolio && (
          <button
            type="button"
            onClick={() => onFolioChange(ultimoFolio)}
            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Usar el último: <span className="font-mono">{ultimoFolio}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** Valida piezas + folio; devuelve los errores por campo o los valores limpios. */
export function validarPiezasFolio(piezas: string, folio: string, { permitirCero }: { permitirCero: boolean }) {
  const n = Number(piezas || 0);
  const errores: { piezas?: string; folio?: string } = {};
  if (!Number.isInteger(n) || n < 0) errores.piezas = 'Ingresa un número entero de piezas.';
  else if (n === 0 && !permitirCero) errores.piezas = 'Ingresa cuántas piezas llegaron.';
  if (n > 0 && !folio.trim()) errores.folio = 'El folio de la nota es obligatorio.';
  return { errores, cantidad: n, folio: folio.trim() };
}
