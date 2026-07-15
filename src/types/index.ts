export type Rol = 'admin' | 'vendedor';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: number; // TINYINT(1): 0 o 1
  creado_at: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  creado_at: string;
}

export interface Categoria {
  id: number;
  nombre: string;
}

export interface Marca {
  id: number;
  nombre: string;
}

export interface Coleccion {
  id: number;
  nombre: string;
  deleted_at: string | null;
  creado_at: string;
}

export interface Producto {
  id: number;
  sku: string;
  nombre: string;
  precio: number;
  precio_descuento: number | null;
  descripcion: string | null;
  imagen_url: string | null;
  categoria_id: number | null;
  marca_id: number | null;
  coleccion_id: number | null;
  creado_at: string;
  // joins opcionales
  categoria_nombre?: string;
  marca_nombre?: string;
  coleccion_nombre?: string;
  stock?: number;
}

export interface MovimientoInventario {
  id: number;
  producto_id: number;
  tipo: 'entrada' | 'salida';
  motivo: 'venta' | 'devolucion' | 'compra' | 'ajuste';
  cantidad: number;
  usuario_id: number;
  referencia: string | null;
  notas: string | null;
  creado_at: string;
  producto_nombre?: string;
  usuario_nombre?: string;
}

export interface SesionCaja {
  id: number;
  usuario_id: number;
  fecha_apertura: string;
  fecha_cierre: string | null;
  saldo_inicial: number;
  saldo_final_esperado: number | null;
  saldo_final_declarado: number | null;
  diferencia: number | null;
  estado: 'abierta' | 'cerrada';
}

export interface Venta {
  id: number;
  folio: string;
  cliente_id: number | null;
  usuario_id: number;
  sesion_caja_id: number;
  total: number;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta';
  creado_at: string;
  cliente_nombre?: string;
  usuario_nombre?: string;
  detalles?: DetalleVenta[];
}

export interface DetalleVenta {
  id: number;
  venta_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  descuento_aplicado: number;
  subtotal: number;
  producto_nombre?: string;
  producto_sku?: string;
}

// ---- POS carrito ----
export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
  precio_unitario: number;
  descuento_aplicado: number;
  subtotal: number;
}

export interface ResultadoCarrito {
  items: ItemCarrito[];
  total: number;
  descuento_total: number;
  promocion_aplicada: boolean;
}
