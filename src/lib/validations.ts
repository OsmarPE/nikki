import { z } from 'zod';
import { zodResolver as baseZodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';

// @hookform/resolvers@5.4.0 fue publicado con tipos compilados contra
// zod@4.0.x exactamente (su firma exige la versión menor "0" en un tipo
// interno de zod). Usamos zod@4.4.x porque versiones 4.0.x tienen un bug de
// inferencia en z.coerce.number(). El resolver funciona bien en runtime con
// cualquier zod 4.x — el choque es solo a nivel de tipos — así que
// centralizamos el cast aquí en vez de repetirlo en cada formulario.
export function zodResolver<T extends FieldValues>(schema: z.ZodType<T, unknown>): Resolver<T> {
  return baseZodResolver(schema as never) as unknown as Resolver<T>;
}

// ─── Cliente ──────────────────────────────────────────────────────────────────
export const clienteSchema = z.object({
  nombre:   z.string().min(1, 'El nombre es requerido').max(100),
  telefono: z.string().max(20).optional().or(z.literal('')),
  email:    z.string().email('Email inválido').max(100).optional().or(z.literal('')),
});
export type ClienteFormValues = z.infer<typeof clienteSchema>;

// ─── Producto ─────────────────────────────────────────────────────────────────
export const productoSchema = z.object({
  sku:              z.string().min(1, 'El SKU es requerido').max(50),
  nombre:           z.string().min(1, 'El nombre es requerido').max(150),
  precio:           z.coerce.number().positive('El precio debe ser mayor a 0'),
  precio_descuento: z.coerce.number().positive('Debe ser mayor a 0').optional().or(z.literal('')),
  descripcion:      z.string().max(500).optional().or(z.literal('')),
  imagen_url:       z.string().optional().or(z.literal('')),
  categoria_id:     z.string().optional(),
  marca_id:         z.string().optional(),
  coleccion_id:     z.string().optional(),
});
export type ProductoFormValues = z.infer<typeof productoSchema>;

// ─── Movimiento Inventario ────────────────────────────────────────────────────
// Una línea del lote: solo lo que varía por producto. Referencia/notas se
// capturan una vez para todo el lote (ver movimientosBatchSchema) porque en
// la práctica describen el evento completo (una compra, un conteo físico),
// no cada producto individual.
const movimientoLineaSchema = z.object({
  producto_id: z.coerce.number().int().positive('Producto inválido'),
  tipo:        z.enum(['entrada', 'salida']),
  // 'venta' se excluye a propósito: esos movimientos solo los genera el
  // flujo de venta (ver actions/ventas.ts), nunca el registro manual — así
  // el motivo sirve como señal confiable de qué movimientos son intocables.
  motivo:      z.enum(['devolucion', 'compra', 'ajuste']),
  cantidad:    z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
});
export type MovimientoLineaValues = z.infer<typeof movimientoLineaSchema>;

export const movimientosBatchSchema = z.object({
  lineas:      z.array(movimientoLineaSchema).min(1, 'Agrega al menos un producto'),
  referencia:  z.string().max(100).optional().or(z.literal('')),
  notas:       z.string().max(500).optional().or(z.literal('')),
});
export type MovimientosBatchFormValues = z.infer<typeof movimientosBatchSchema>;

// ─── Apertura de caja ─────────────────────────────────────────────────────────
export const abrirCajaSchema = z.object({
  saldo_inicial: z.coerce.number().min(0, 'El saldo no puede ser negativo'),
});
export type AbrirCajaFormValues = z.infer<typeof abrirCajaSchema>;

// ─── Cierre de caja ───────────────────────────────────────────────────────────
export const cerrarCajaSchema = z.object({
  saldo_declarado: z.coerce.number().min(0, 'El saldo no puede ser negativo'),
});
export type CerrarCajaFormValues = z.infer<typeof cerrarCajaSchema>;

// ─── Usuarios ─────────────────────────────────────────────────────────────────
export const usuarioSchema = z.object({
  nombre:   z.string().min(1, 'El nombre es requerido').max(150),
  email:    z.string().email('Email inválido').max(255),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  rol:      z.enum(['admin', 'vendedor']),
});
export type UsuarioFormValues = z.infer<typeof usuarioSchema>;

export const usuarioEditSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(150),
  email:  z.string().email('Email inválido').max(255),
  rol:    z.enum(['admin', 'vendedor']),
});
export type UsuarioEditFormValues = z.infer<typeof usuarioEditSchema>;

export const passwordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});
export type PasswordFormValues = z.infer<typeof passwordSchema>;

// ─── Abono a venta a crédito ───────────────────────────────────────────────────
export const abonoSchema = z.object({
  monto:       z.coerce.number().positive('El monto debe ser mayor a 0'),
  metodo_pago: z.enum(['efectivo', 'transferencia', 'tarjeta']),
});
export type AbonoFormValues = z.infer<typeof abonoSchema>;

// ─── Catálogo simple (categorías, marcas) ─────────────────────────────────────
export const catalogoNombreSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
});
export type CatalogoNombreValues = z.infer<typeof catalogoNombreSchema>;
