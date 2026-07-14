'use client';

import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TriangleAlert, Ban } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  // Advertencia informativa (amarillo) — se muestra antes de confirmar
  warning?: string;
  // Error bloqueante (rojo) — impide la acción, solo muestra Cerrar
  blocked?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  warning,
  blocked,
  confirmLabel = 'Eliminar',
  onConfirm,
  pending = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </DialogDescription>

          {/* Error bloqueante — no se puede proceder */}
          {blocked && (
            <div className="flex items-start gap-2 mt-3 rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2.5">
              <Ban size={14} className="text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive leading-relaxed">{blocked}</p>
            </div>
          )}

          {/* Advertencia informativa — se puede proceder con cuidado */}
          {!blocked && warning && (
            <div className="flex items-start gap-2 mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
              <TriangleAlert size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">{warning}</p>
            </div>
          )}
        </DialogHeader>

        <DialogFooter className="px-5 pb-4 pt-0 border-t-0 bg-transparent flex-row justify-end gap-2 rounded-none">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {blocked ? 'Entendido' : 'Cancelar'}
          </Button>

          {/* Solo mostrar el botón de confirmar si la acción no está bloqueada */}
          {!blocked && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? 'Eliminando…' : confirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
