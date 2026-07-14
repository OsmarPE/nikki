'use client';

import { useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <WifiOff size={20} className="text-muted-foreground" />
      </div>
      <Text variant="title">No pudimos cargar esta sección</Text>
      <Text variant="description" className="max-w-sm">
        Puede ser un problema temporal de conexión con el servidor. Intenta de nuevo en unos segundos.
      </Text>
      <Button onClick={() => window.location.reload()} className="mt-2">
        Reintentar
      </Button>
    </div>
  );
}
