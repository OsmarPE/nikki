import { z } from 'zod';

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
export const movimientoSchema = z.object({
  producto_id: z.string().min(1, 'Selecciona un producto'),
  tipo:        z.enum(['entrada', 'salida']),
  motivo:      z.enum(['venta', 'devolucion', 'compra', 'ajuste']),
  cantidad:    z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
  referencia:  z.string().max(100).optional().or(z.literal('')),
  notas:       z.string().max(500).optional().or(z.literal('')),
});
export type MovimientoFormValues = z.infer<typeof movimientoSchema>;

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

// ─── Catálogo simple (categorías, marcas) ─────────────────────────────────────
export const catalogoNombreSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
});
export type CatalogoNombreValues = z.infer<typeof catalogoNombreSchema>;
