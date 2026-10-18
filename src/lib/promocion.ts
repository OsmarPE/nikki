import type { ItemCarrito, Producto, ResultadoCarrito } from '@/types';

interface LineaCarrito {
  producto: Producto;
  cantidad: number;
}

export interface CandidatoDescuento {
  producto_id: number;
  nombre: string;
  cantidad: number;
}

function esElegibleParaPromocion(producto: Producto): boolean {
  return (
    producto.marca_nombre?.toLowerCase() !== 'nikkol' &&
    (!producto.precio_descuento || producto.precio_descuento === 0)
  );
}

/** Suma de TODAS las unidades del carrito, elegibles o no — cualquier pieza
 * comprada cuenta para llegar a la 4ta, sin importar marca o si ya tiene
 * precio_descuento propio. Esa elegibilidad solo decide dónde se puede
 * "gastar" el 20% una vez que se llega al umbral, no si la pieza cuenta. */
function totalUnidadesCarrito(lineas: LineaCarrito[]): number {
  return lineas.reduce((s, l) => s + l.cantidad, 0);
}

/**
 * Líneas elegibles para que el vendedor les asigne el 20% de descuento. Solo
 * hay algo que ofrecer cuando el carrito acumula 4+ piezas EN TOTAL (de
 * cualquier producto, elegible o no); las líneas devueltas son las que sí
 * pueden recibir el descuento (marca distinta de "nikkol", sin
 * precio_descuento propio).
 */
export function calcularCandidatosDescuento(lineas: LineaCarrito[]): CandidatoDescuento[] {
  if (totalUnidadesCarrito(lineas) < 4) return [];
  return lineas
    .filter(l => esElegibleParaPromocion(l.producto))
    .map(l => ({
      producto_id: l.producto.id,
      nombre:      l.producto.nombre,
      cantidad:    l.cantidad,
    }));
}

/**
 * A partir de la 4ta pieza del carrito (sumando TODOS los productos, incluida
 * marca "nikkol" y los que ya tienen precio_descuento propio), las unidades
 * excedentes (total del carrito - 3) reciben 20% de descuento. El vendedor
 * decide en cuáles productos ELEGIBLES se "gastan" esas unidades marcándolos
 * en `productosConDescuento` — se reparten en el orden en que aparecen las
 * líneas del carrito, sin poder superar el total disponible ni aplicar sobre
 * productos no elegibles (marca "nikkol" o con precio_descuento propio),
 * aunque esos sí cuentan para alcanzar el umbral.
 */
export function calcularCarrito(
  lineas: LineaCarrito[],
  productosConDescuento: Set<number> | number[] = new Set(),
  descuentoGlobalPorcentaje: number | null = null,
): ResultadoCarrito {
  const seleccionados = productosConDescuento instanceof Set
    ? productosConDescuento
    : new Set(productosConDescuento);

  let poolDescuento = Math.max(0, totalUnidadesCarrito(lineas) - 3);

  const items: ItemCarrito[] = [];
  let totalDescuento = 0;

  for (const linea of lineas) {
    const elegible = esElegibleParaPromocion(linea.producto) && seleccionados.has(linea.producto.id);
    const unidadesConDescuento = elegible ? Math.min(linea.cantidad, poolDescuento) : 0;
    poolDescuento -= unidadesConDescuento;

    const precioUnitario = linea.producto.precio_descuento
      ? linea.producto.precio_descuento
      : linea.producto.precio;

    const descuentoPromocion = unidadesConDescuento * precioUnitario * 0.2;
    const subtotalLinea = linea.cantidad * precioUnitario - descuentoPromocion;

    totalDescuento += descuentoPromocion;

    items.push({
      producto:           linea.producto,
      cantidad:           linea.cantidad,
      precio_unitario:    precioUnitario,
      descuento_aplicado: parseFloat(descuentoPromocion.toFixed(2)),
      subtotal:           parseFloat(subtotalLinea.toFixed(2)),
    });
  }

  const subtotal = parseFloat(items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));

  // Descuento global (porcentaje entero 1–100) que el vendedor aplica sobre el total ya
  // resuelto por la promoción 4x3 — se acumula con esta, no la sustituye.
  const descuentoGlobalMonto = descuentoGlobalPorcentaje
    ? parseFloat((subtotal * descuentoGlobalPorcentaje / 100).toFixed(2))
    : 0;
  const total = parseFloat((subtotal - descuentoGlobalMonto).toFixed(2));

  return {
    items,
    subtotal,
    total,
    descuento_total:             parseFloat(totalDescuento.toFixed(2)),
    promocion_aplicada:          totalDescuento > 0,
    descuento_global_porcentaje: descuentoGlobalPorcentaje,
    descuento_global_monto:      descuentoGlobalMonto,
  };
}
