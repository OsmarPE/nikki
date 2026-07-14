'use client';

import { reload } from '@/hooks/use-reload';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { abrirCaja } from '@/actions/caja';
import { zodResolver, abrirCajaSchema, type AbrirCajaFormValues } from '@/lib/validations';

export default function AbrirCajaForm() {
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<AbrirCajaFormValues>({
    resolver: zodResolver(abrirCajaSchema),
    defaultValues: { saldo_inicial: '' as unknown as number },
  });

  function onSubmit(data: AbrirCajaFormValues) {
    startTransition(async () => {
      const r = await abrirCaja(data.saldo_inicial);
      if (r?.error) { toast.error(r.error); return; }
      toast.success('Caja abierta. ¡Listo para vender!');
      reload();
    });
  }

  return (
    <Card className="w-full max-w-sm shadow-md">
      <CardHeader>
        <CardTitle>Apertura de caja</CardTitle>
        <CardDescription>Ingresa el fondo inicial antes de comenzar a vender.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Saldo inicial (MXN)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            error={errors.saldo_inicial?.message}
            {...register('saldo_inicial')}
          />
          <Button type="submit" variant="default" className="w-full" disabled={pending}>
            {pending ? 'Abriendo…' : 'Abrir caja'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
