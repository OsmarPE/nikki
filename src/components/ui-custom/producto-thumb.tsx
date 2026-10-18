'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';

// ─── Miniatura de producto con fallback si no hay imagen o falla al cargar ────
export function ProductoThumb({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
        <Package size={14} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className="h-8 w-8 rounded-md object-cover bg-muted shrink-0"
    />
  );
}
