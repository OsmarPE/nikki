'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { loginAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState = { error: '' };

// Estilos de marca sobre los componentes base (Input/Button) del sistema.
const inputMarca = 'h-11 rounded-md border-black/25 bg-white px-4 text-sm focus-visible:border-[#92678e] focus-visible:ring-[#92678e]/25';
const labelMarca = 'text-sm font-normal text-black/50';

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await loginAction(formData);
      return result ?? initialState;
    },
    initialState
  );
  const [mostrarPassword, setMostrarPassword] = useState(false);

  return (
    <form action={formAction} className="w-full">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className={labelMarca}>Correo electrónico</Label>
          <Input id="email" name="email" type="email" placeholder="ejemplo@gmail.com" autoComplete="email" required className={inputMarca} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className={labelMarca}>Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={mostrarPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className={`${inputMarca} pr-10`}
            />
            <button
              type="button"
              onClick={() => setMostrarPassword(v => !v)}
              tabIndex={-1}
              aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70 transition-colors"
            >
              {mostrarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      {state?.error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{state.error}</p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="mt-[38px] h-[50px] w-full rounded-md bg-[#92678e] text-sm font-medium text-white hover:bg-[#855c80]"
      >
        {pending ? 'Ingresando…' : 'Iniciar sesión'}
      </Button>
    </form>
  );
}
