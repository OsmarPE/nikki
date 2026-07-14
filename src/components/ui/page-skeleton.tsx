import { Skeleton } from '@/components/ui/skeleton';

// ─── Primitivos compartidos ───────────────────────────────────────────────────

function SkeletonHeader({ withButton = true }: { withButton?: boolean }) {
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-3.5 w-52" />
      </div>
      {withButton && <Skeleton className="h-8 w-32 rounded-lg" />}
    </div>
  );
}

function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  const widths = ['w-40', 'w-28', 'w-20', 'w-24', 'w-16', 'w-12'];
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border/40 last:border-0">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

function SkeletonTable({ rows = 7, cols = 5, withSearch = true, withFilter = false }: {
  rows?: number; cols?: number; withSearch?: boolean; withFilter?: boolean;
}) {
  return (
    <div className="space-y-4">
      {(withSearch || withFilter) && (
        <div className="flex items-center gap-2">
          {withSearch && <Skeleton className="h-8 w-64 rounded-lg" />}
          {withFilter && <Skeleton className="h-8 w-24 rounded-lg" />}
          {withFilter && <Skeleton className="h-8 w-24 rounded-lg" />}
        </div>
      )}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* cabecera */}
        <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/40 border-b border-border">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 w-16" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} cols={cols} />
        ))}
      </div>
    </div>
  );
}

function SkeletonKpiCards({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card px-4 py-4 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

// ─── Variantes por módulo ─────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonHeader withButton={false} />
      <SkeletonKpiCards count={4} />
      {/* Chart card */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-56 rounded-lg" />
        </div>
        <div className="p-5">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="flex items-center gap-6 px-5 py-3 border-t border-border/60 bg-muted/20">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-4 w-18" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductosSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <SkeletonTable rows={8} cols={5} withSearch withFilter />
    </div>
  );
}

function ProductoDetalleSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>
      {/* Status bar */}
      <Skeleton className="h-11 w-full rounded-xl" />
      {/* Panel sections */}
      <div className="rounded-xl border border-border divide-y divide-border/60">
        {['Imagen', 'Información general', 'Precios', 'Clasificación'].map(s => (
          <div key={s} className="grid grid-cols-[220px_1fr] gap-8 py-8 px-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="space-y-3">
              {s === 'Imagen'
                ? <Skeleton className="aspect-video w-full rounded-lg" />
                : <><Skeleton className="h-8 w-full rounded-lg" /><Skeleton className="h-8 w-full rounded-lg" /></>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VentasSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>
      <SkeletonTable rows={9} cols={6} withSearch={false} />
    </div>
  );
}

function VentaDetalleSkeleton() {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-32 rounded-md" />
            </div>
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border px-4 py-3.5 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      {/* Products panel */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-muted/30 border-b border-border/60">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <div className="divide-y divide-border/50">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_100px_100px] gap-3 px-5 py-4 items-center">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-8 mx-auto" />
              <Skeleton className="h-3.5 w-16 ml-auto" />
              <Skeleton className="h-3.5 w-16 ml-auto" />
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-border bg-muted/20 flex justify-end">
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border px-5 py-4 space-y-3">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3.5 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-8 w-64 rounded-lg" />
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              </div>
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
            <div className="border-t border-dashed border-border pt-3 space-y-2">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InventarioSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonHeader />
      <Skeleton className="h-8 w-64 rounded-lg" />
      <SkeletonTable rows={9} cols={7} withSearch={false} />
    </div>
  );
}

function CajaSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonHeader withButton={false} />
      <SkeletonKpiCards count={4} />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border px-4 py-4 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-10" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-44 rounded-lg" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border/40 last:border-0">
            <Skeleton className="h-2 w-2 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-2.5 w-40" />
            </div>
            <Skeleton className="h-3.5 w-20 hidden sm:block" />
            <Skeleton className="h-3.5 w-16 hidden md:block" />
            <Skeleton className="h-5 w-5 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CatalogoSkeleton({ titulo }: { titulo: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3.5 w-48" />
        </div>
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>
      <div className="grid gap-4 grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-md border border-border p-3 flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-md shrink-0" />
            <div className="flex-1 flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NuevaVentaSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="max-w-sm w-full mx-auto space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-52 mx-auto" />
            <Skeleton className="h-3.5 w-64 mx-auto" />
            <Skeleton className="h-3.5 w-48 mx-auto" />
          </div>
        </div>
        <div className="rounded-xl border border-border px-5 py-5 space-y-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-2.5 w-56" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function WizardVentaSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
      {/* Stepper */}
      <div className="flex items-center">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-2.5 w-14" />
            </div>
            {i < 3 && <Skeleton className="flex-1 h-px mx-3 mb-5" />}
          </div>
        ))}
      </div>
      {/* Contenido */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 w-16" />
          ))}
        </div>
        <div className="flex flex-col items-center gap-4 py-14">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
      </div>
      {/* Nav */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={`h-1.5 rounded-full ${i === 0 ? 'w-6' : 'w-1.5'}`} />
          ))}
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Exportación principal ────────────────────────────────────────────────────
export type PageSkeletonVariant =
  | 'dashboard'
  | 'productos'
  | 'producto-detalle'
  | 'ventas'
  | 'venta-detalle'
  | 'clientes'
  | 'inventario'
  | 'caja'
  | 'catalogo'
  | 'nueva-venta'
  | 'wizard-venta';

interface PageSkeletonProps {
  variant: PageSkeletonVariant;
  titulo?: string; // requerido para variant="catalogo"
}

export function PageSkeleton({ variant, titulo = '' }: PageSkeletonProps) {
  switch (variant) {
    case 'dashboard':       return <DashboardSkeleton />;
    case 'productos':       return <ProductosSkeleton />;
    case 'producto-detalle':return <ProductoDetalleSkeleton />;
    case 'ventas':          return <VentasSkeleton />;
    case 'venta-detalle':   return <VentaDetalleSkeleton />;
    case 'clientes':        return <ClientesSkeleton />;
    case 'inventario':      return <InventarioSkeleton />;
    case 'caja':            return <CajaSkeleton />;
    case 'catalogo':        return <CatalogoSkeleton titulo={titulo} />;
    case 'nueva-venta':     return <NuevaVentaSkeleton />;
    case 'wizard-venta':    return <WizardVentaSkeleton />;
  }
}
