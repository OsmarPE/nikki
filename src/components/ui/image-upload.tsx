'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Upload, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  className?: string;
}

export function ImageUpload({ value, onChange, className }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [value]);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al subir imagen.'); return; }
      onChange(data.url);
    } catch {
      setError('Error de red al subir la imagen.');
    } finally {
      setUploading(false);
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    upload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Preview */}
      {value && !broken ? (
        <div className="relative group w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Preview"
            onError={() => setBroken(true)}
            className="w-full h-full object-cover"
          />
          {/* Overlay con botón quitar */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/90 text-xs font-medium text-zinc-800 hover:bg-white transition-colors"
            >
              <Upload size={13} /> Cambiar
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/90 text-xs font-medium text-red-600 hover:bg-white transition-colors"
            >
              <X size={13} /> Quitar
            </button>
          </div>
        </div>
      ) : (
        /* Drop zone */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          disabled={uploading}
          className={cn(
            'w-full aspect-video rounded-lg border-2 border-dashed transition-all',
            'flex flex-col items-center justify-center gap-2 text-sm',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            dragging
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/40',
          )}
        >
          {uploading ? (
            <>
              <div className="h-8 w-8 rounded-full border-2 border-current border-t-transparent animate-spin" />
              <span>Subiendo…</span>
            </>
          ) : (
            <>
              <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center transition-colors',
                dragging ? 'bg-primary/10' : 'bg-muted',
              )}>
                <ImageIcon size={20} className={dragging ? 'text-primary' : ''} />
              </div>
              {broken ? (
                <div className="text-center leading-snug">
                  <span className="font-medium text-foreground">La imagen ya no está disponible</span>
                  <span className="text-muted-foreground"> — sube una nueva o arrastra aquí</span>
                </div>
              ) : (
                <div className="text-center leading-snug">
                  <span className="font-medium text-foreground">Sube una imagen</span>
                  <span className="text-muted-foreground"> o arrastra aquí</span>
                </div>
              )}
              <span className="text-xs text-muted-foreground">JPG, PNG, WebP · máx. 4 MB</span>
            </>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
