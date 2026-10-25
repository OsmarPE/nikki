import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { UPLOAD_DIR, TIPOS_IMAGEN, NOMBRE_ARCHIVO_VALIDO } from '@/lib/uploads';

// Sirve las imágenes subidas desde UPLOAD_DIR (fuera de la carpeta de la app,
// ver lib/uploads.ts). Como respaldo busca también en public/uploads, donde
// quedaron las imágenes de desarrollo y las subidas antes de este cambio.
export async function GET(_request: Request, { params }: { params: Promise<{ archivo: string }> }) {
  const { archivo } = await params;
  if (!NOMBRE_ARCHIVO_VALIDO.test(archivo)) {
    return new NextResponse('No encontrado', { status: 404 });
  }

  for (const dir of [UPLOAD_DIR, join(process.cwd(), 'public', 'uploads')]) {
    try {
      const buffer = await readFile(join(dir, archivo));
      return new NextResponse(buffer, {
        headers: {
          'Content-Type':  TIPOS_IMAGEN[extname(archivo).toLowerCase()] ?? 'application/octet-stream',
          // El nombre es aleatorio y nunca se reutiliza: se puede cachear indefinidamente.
          'Cache-Control': 'private, max-age=31536000, immutable',
        },
      });
    } catch {
      // No está en esta carpeta: probar la siguiente.
    }
  }
  return new NextResponse('No encontrado', { status: 404 });
}
