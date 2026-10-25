import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from '@/lib/uploads';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const EXT_POR_TIPO: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
};
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB

export async function POST(request: NextRequest) {
  // Auth
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  if (session.rol !== 'admin') return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Usa JPG, PNG, WebP o GIF.' }, { status: 415 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el límite de 4 MB.' }, { status: 413 });
  }

  // Nombre único para evitar colisiones
  // Extensión según el tipo real (no el nombre original), para que coincida con lo que sirve /uploads.
  const ext = EXT_POR_TIPO[file.type];
  const filename = `${randomBytes(12).toString('hex')}${ext}`;
  const filepath = join(UPLOAD_DIR, filename);

  // Crear directorio si no existe
  await mkdir(UPLOAD_DIR, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const url = `${UPLOAD_URL_PREFIX}${filename}`;
  return NextResponse.json({ url }, { status: 200 });
}
