import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationControlsProps {
  page: number;          // 0-indexed
  totalPages: number;
  total: number;
  pageSize: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

export function PaginationControls({
  page, totalPages, total, pageSize,
  hasPrev, hasNext, onPrev, onNext,
  className,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const from = page * pageSize + 1;
  const to   = Math.min((page + 1) * pageSize, total);

  return (
    <div className={cn('flex items-center justify-between text-sm text-muted-foreground', className)}>
      <span className="tabular-nums text-xs">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={!hasPrev}
          className="h-7"
        >
          <ChevronLeft className="size-3" />
          Anterior
        </Button>
        <span className="text-xs tabular-nums px-1">
          {page + 1} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNext}
          className="h-7"
        >
          Siguiente
          <ChevronRight className="size-3" />
        </Button>
      </div>
    </div>
  );
}
