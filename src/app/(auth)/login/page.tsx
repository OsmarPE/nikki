'use client';

import { useActionState } from 'react';
import { loginAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Lock } from 'lucide-react';

const initialState = { error: '' };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await loginAction(formData);
      return result ?? initialState;
    },
    initialState
  );

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-[300px]">
        <div className='size-12 text-white mb-4 mx-auto bg-primary rounded-full flex items-center justify-center'>
          <Lock size={16} />
        </div>
        <div className="mb-6 text-center">
          <Text variant='title'>Iniciar sesión</Text>
          <Text variant='description'>Ingresa tus credenciales para continuar</Text>
        </div>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" name="email" type="email" placeholder="admin@ejemplo.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" placeholder="••••••••" required />
          </div>
          {state?.error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-md">{state.error}</p>
          )}
          <Button type="submit" variant={'default'} size={'lg'} className="w-full mt-4" disabled={pending}>
            {pending ? 'Cargando...' : 'Iniciar sesión'}
          </Button>
        </form>

      </div>
    </div>
  );
}
