import { join } from 'path';

// Carpeta donde se guardan las imágenes subidas (fotos de productos, etc.).
//
// NO debe vivir dentro de la app: en Hostinger cada despliegue crea una carpeta
// de versión nueva (hbuilds/versions/<uuid>) y borra la anterior, así que todo
// lo que se guardaba en public/uploads se perdía al publicar. En producción
// UPLOAD_DIR apunta a una carpeta fija fuera de las versiones, p. ej.
// /home/<usuario>/domains/<dominio>/uploads. En desarrollo usa storage/uploads.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'storage', 'uploads');

// Las imágenes se sirven en /uploads/<archivo> (ver app/uploads/[archivo]/route.ts),
// la misma URL que ya está guardada en la base de datos.
export const UPLOAD_URL_PREFIX = '/uploads/';

export const TIPOS_IMAGEN: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

// Solo nombres generados por la subida (hex + extensión de imagen): evita que
// se pueda pedir cualquier archivo del servidor con "../".
export const NOMBRE_ARCHIVO_VALIDO = /^[a-f0-9]{8,64}\.(jpg|jpeg|png|webp|gif)$/i;
