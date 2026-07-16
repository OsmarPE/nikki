'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Banknote, CreditCard, ArrowRightLeft,
  LockOpen, LockKeyhole, ShoppingCart, TrendingUp,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { FormField } from '@/components/ui/form-field';
import { abrirCaja, cerrarCaja } from '@/actions/caja';
import { zodResolver, abrirCajaSchema, cerrarCajaSchema, type AbrirCajaFormValues, type CerrarCajaFormValues } from '@/lib/validations';
import { formatCurrency, formatTime, formatTimeShort } from '@/lib/utils';
import type { SesionCajaDetalle } from '@/actions/caja';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function duracion(apertura: Date | string): string {
  const d   = apertura instanceof Date ? apertura : new Date(String(apertura).replace(' ', 'T') + 'Z');
  const ms  = Date.now() - d.getTime();
  const h   = Math.floor(ms / 3_600_000);
  const m   = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Sheet de cierre de caja ──────────────────────────────────────────────────
function CerrarCajaSheet({
  open, sesion, onClose, onCerrada,
}: {
  open: boolean;
  sesion: SesionCajaDetalle;
  onClose: () => void;
  onCerrada: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<{ esperado: number; diferencia: number } | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CerrarCajaFormValues>({
    resolver: zodResolver(cerrarCajaSchema),
    defaultValues: { saldo_declarado: '' as unknown as number },
  });

  const saldoDeclarado   = watch('saldo_declarado');
  const efectivoEnCaja   = Number(sesion.saldo_inicial) + Number(sesion.monto_efectivo);
  const diferenciaPrev   = saldoDeclarado ? Number(saldoDeclarado) - efectivoEnCaja : null;

  function onSubmit(data: CerrarCajaFormValues) {
    startTransition(async () => {
      const r = await cerrarCaja(sesion.id, data.saldo_declarado);
      if (r?.error) { toast.error(r.error); return; }
      setResultado({ esperado: r.esperado!, diferencia: r.diferencia! });
    });
  }

  // Pantalla de resultado
  if (resultado) {
    const { diferencia } = resultado;
    const cuadrada = Math.abs(diferencia) < 1;
    return (
      <Sheet open={open} onOpenChange={() => { onClose(); onCerrada(); }}>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col gap-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60">
            <SheetTitle className="text-sm font-semibold">Caja cerrada</SheetTitle>
          </SheetHeader>
          <div className="flex-1 px-5 py-6 space-y-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className={`h-14 w-14 rounded-full flex items-center justify-center ${cuadrada ? 'bg-green-100' : 'bg-amber-100'}`}>
                {cuadrada
                  ? <CheckCircle2 size={28} className="text-green-600" />
                  : <AlertTriangle size={28} className="text-amber-600" />
                }
              </div>
              <div>
                <p className="font-semibold">
                  {cuadrada ? '¡Caja cuadrada!' : diferencia > 0 ? 'Sobrante en caja' : 'Faltante en caja'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {cuadrada ? 'El efectivo declarado coincide.' : `Diferencia de ${formatCurrency(Math.abs(diferencia))}`}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border divide-y divide-border/50">
              <div className="flex justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">Total vendido</span>
                <span className="font-semibold">{formatCurrency(Number(sesion.total_ventas))}</span>
              </div>
              <div className="flex justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">Esperado en caja</span>
                <span className="font-semibold">{formatCurrency(resultado.esperado)}</span>
              </div>
              {!cuadrada && (
                <div className={`flex justify-between px-4 py-3 text-sm font-semibold ${diferencia > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                  <span>{diferencia > 0 ? 'Sobrante' : 'Faltante'}</span>
                  <span>{diferencia > 0 ? '+' : ''}{formatCurrency(diferencia)}</span>
                </div>
              )}
            </div>
          </div>
          <SheetFooter className="border-t border-border/60 px-5 py-3">
            <Button variant="default" className="w-full" onClick={() => { onClose(); onCerrada(); }}>
              Finalizar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col gap-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60">
          <SheetTitle className="text-sm font-semibold">Cerrar caja</SheetTitle>
          <SheetDescription className="text-xs">
            Cuenta el efectivo físico e ingrésalo para calcular la diferencia.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1">
          <div className="flex-1 px-5 py-5 space-y-4">
            <div className="rounded-xl border border-border divide-y divide-border/50">
              <div className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Ventas del día</span>
                <span className="font-semibold tabular-nums">{formatCurrency(Number(sesion.total_ventas))}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground"><Banknote size={13}/> Efectivo</span>
                <span className="tabular-nums">{formatCurrency(Number(sesion.monto_efectivo))}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground"><ArrowRightLeft size={13}/> Transferencia</span>
                <span className="tabular-nums">{formatCurrency(Number(sesion.monto_transferencia))}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground"><CreditCard size={13}/> Tarjeta</span>
                <span className="tabular-nums">{formatCurrency(Number(sesion.monto_tarjeta))}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 text-sm bg-muted/30">
                <span className="text-muted-foreground font-medium">Efectivo esperado en caja</span>
                <span className="font-bold tabular-nums">{formatCurrency(efectivoEnCaja)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <FormField
                label="Efectivo que tienes en caja (MXN)"
                type="number" min="0" step="0.01" placeholder="0.00"
                description="Cuenta los billetes y monedas físicamente"
                error={errors.saldo_declarado?.message}
                autoFocus
                {...register('saldo_declarado')}
              />
              <button
                type="button"
                onClick={() => setValue('saldo_declarado', efectivoEnCaja, { shouldValidate: true })}
                className="text-xs text-green-700 hover:text-foreground hover:underline transition-colors"
              >
                Usar el monto esperado ({formatCurrency(efectivoEnCaja)})
              </button>
            </div>

            {diferenciaPrev !== null && (
              <div className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium border ${
                Math.abs(diferenciaPrev) < 1
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : diferenciaPrev > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <span>{Math.abs(diferenciaPrev) < 1 ? 'Caja cuadrada' : diferenciaPrev > 0 ? '↑ Sobrante' : 'Faltante'}</span>
                {Math.abs(diferenciaPrev) >= 1 && <span className="tabular-nums">{formatCurrency(Math.abs(diferenciaPrev))}</span>}
              </div>
            )}
          </div>
          <SheetFooter className="border-t border-border/60 px-5 py-3 flex-row gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button type="submit" variant="destructive" disabled={pending} className="flex-1">
              <LockKeyhole size={13} />
              {pending ? 'Cerrando…' : 'Cerrar caja'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Sin caja abierta ─────────────────────────────────────────────────────────
function SinCaja({ onAbierta }: { onAbierta: () => void }) {
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<AbrirCajaFormValues>({
    resolver: zodResolver(abrirCajaSchema),
    defaultValues: { saldo_inicial: '' as unknown as number },
  });

  function onSubmit(data: AbrirCajaFormValues) {
    startTransition(async () => {
      const r = await abrirCaja(data.saldo_inicial);
      if (r?.error) { toast.error(r.error); return; }
      toast.success('¡Caja abierta! Ya puedes empezar a vender.');
      onAbierta();
    });
  }

  return (
    <div className="max-w-sm mx-auto">
      <div className="flex flex-col items-center gap-3 mb-8 text-center">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <LockOpen size={24} className="text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Abrir caja para comenzar</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ingresa el efectivo con el que inicias el día para empezar a registrar ventas.
          </p>
        </div>
      </div>
      <Card className="px-5 py-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            label="Fondo inicial en efectivo (MXN)"
            type="number" min="0" step="0.01" placeholder="0.00"
            description="Es el dinero que ya tienes en la caja antes de empezar"
            error={errors.saldo_inicial?.message}
            autoFocus
            {...register('saldo_inicial')}
          />
          <Button type="submit" variant="default" className="w-full" disabled={pending}>
            <LockOpen size={14} />
            {pending ? 'Abriendo caja…' : 'Abrir caja y comenzar a vender'}
          </Button>
        </form>
      </Card>
    </div>
  );
}



function CajaAbierta({ sesion, onContinuar }: { sesion: SesionCajaDetalle; onContinuar: () => void }) {
  const router = useRouter();
  const [sheetCierre, setSheetCierre] = useState(false);

  const metodos = [
    { label: 'Efectivo',      icon: <Banknote size={13} />,       value: Number(sesion.monto_efectivo) },
    { label: 'Transferencia', icon: <ArrowRightLeft size={13} />, value: Number(sesion.monto_transferencia) },
    { label: 'Tarjeta',       icon: <CreditCard size={13} />,     value: Number(sesion.monto_tarjeta) },
  ];

  const cajaActual = Number(sesion.saldo_inicial) + Number(sesion.monto_efectivo);


  return (
    <div className="max-w-md w-full mx-auto space-y-5">
     

      {/* Tarjeta principal */}
      <Card className="px-5 py-5 ">
        <div>
          <h2 className="text-sm mb-1 font-semibold">Tu caja está abierta</h2>
          <div className='flex items-center gap-2'>
            <div className='w-1.5 h-1.5 rounded-full bg-green-500'></div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Abierta desde las {formatTimeShort(sesion.fecha_apertura)} · {duracion(sesion.fecha_apertura)} activa
            </p>
          </div>
        </div>
         <Separator />
        {/* Ingresos totales */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp size={14} />
            <span className="text-xs">Ingresos de la sesión</span>
          </div>
          <p className="text-xl font-bold tabular-nums text-green-700">
            {formatCurrency(Number(sesion.total_ventas))}
          </p>
        </div>

        <Separator />

        {/* Desglose por método */}
        <div className="space-y-2">
          {metodos.map(m => (
            <div key={m.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {m.icon} {m.label}
              </span>
              <span className="tabular-nums font-medium">
                {m.value > 0 ? formatCurrency(m.value) : <span className="text-muted-foreground/40">—</span>}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Stats rápidos */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Transacciones</p>
            <p className="text-sm font-bold tabular-nums">{sesion.num_transacciones}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Efectivo en caja</p>
            <p className="text-sm font-bold tabular-nums">{formatCurrency(cajaActual)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Fondo inicial</p>
            <p className="text-sm font-bold tabular-nums">{formatCurrency(Number(sesion.saldo_inicial))}</p>
          </div>
        </div>
      </Card>

      {/* CTA */}
       <div className="space-y-2">
         <Button variant="outline" className="w-full shadow" size="lg" onClick={onContinuar}>
        Continuar con la venta
      </Button>
        <Button variant="outline" className="w-full" onClick={() => setSheetCierre(true)}>
          <LockKeyhole size={14} />
          Cerrar caja del día
        </Button>
      </div>
     <CerrarCajaSheet
        open={sheetCierre}
        sesion={sesion}
        onClose={() => setSheetCierre(false)}
        onCerrada={() => {
          toast.success('Caja cerrada correctamente.');
          router.push('/ventas');
        }}
      />
    </div>
  );
}


// ─── Gateway ──────────────────────────────────────────────────────────────────
export default function CajaGateway({ sesionInicial }: { sesionInicial: SesionCajaDetalle | null }) {
  const router = useRouter();
  const [sesion] = useState(sesionInicial);
  const [listo, setListo] = useState(false);

  if (listo) {
    router.push('/ventas/nueva/wizard');
    return null;
  }

  if (!sesion) return <SinCaja onAbierta={() => window.location.reload()} />;

  return <CajaAbierta sesion={sesion} onContinuar={() => setListo(true)} />;
}
