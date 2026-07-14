import type { ItemCarrito, Producto, ResultadoCarrito } from '@/types';

interface LineaCarrito {
  producto: Producto;
  cantidad: number;
}

/**
 * Aplica la promoción global: 20% sobre las M unidades de menor precio
 * cuando hay 4 o más unidades elegibles en el carrito.
 *
 * Elegible: marca distinta de "nikkol" Y precio_descuento nulo/cero.
 */
export function calcularCarrito(lineas: LineaCarrito[]): ResultadoCarrito {
  // Expandir cada línea en unidades individuales
  const unidades: { producto: Producto; precio: number }[] = [];
  for (const linea of lineas) {
    for (let i = 0; i < linea.cantidad; i++) {
      unidades.push({ producto: linea.producto, precio: linea.producto.precio });
    }
  }

  // Separar elegibles (no nikkol, sin precio_descuento)
  const elegibles = unidades.filter(
    u =>
      u.producto.marca_nombre?.toLowerCase() !== 'nikkol' &&
      (!u.producto.precio_descuento || u.producto.precio_descuento === 0)
  );

  const N = elegibles.length;
  let unidadesConDescuento = new Set<number>(); // índices globales en `elegibles` que recibirán 20%

  if (N >= 4) {
    const M = N - 3;
    // Ordenar elegibles por precio ascendente; guardar índice original
    const conIndice = elegibles.map((u, i) => ({ ...u, idx: i }));
    conIndice.sort((a, b) => a.precio - b.precio);
    // Las primeras M reciben el 20%
    for (let i = 0; i < M; i++) {
      unidadesConDescuento.add(conIndice[i].idx);
    }
  }

  // Reconstruir items del carrito con descuentos
  let elegibleIdx = 0;
  const items: ItemCarrito[] = [];
  let totalDescuento = 0;

  for (const linea of lineas) {
    let descuentoPorUnidad = 0;
    let unidadesDescuentoEnLinea = 0;

    for (let i = 0; i < linea.cantidad; i++) {
      const esElegible =
        linea.producto.marca_nombre?.toLowerCase() !== 'nikkol' &&
        (!linea.producto.precio_descuento || linea.producto.precio_descuento === 0);

      if (esElegible) {
        if (unidadesConDescuento.has(elegibleIdx)) {
          unidadesDescuentoEnLinea++;
        }
        elegibleIdx++;
      }
    }

    const precioBase = linea.producto.precio_descuento
      ? linea.producto.precio_descuento
      : linea.producto.precio;

    // Precio efectivo por unidad considerando descuento del catálogo
    const precioUnitario = precioBase;

    // El descuento de promoción aplicado al total de la línea
    const descuentoPromocion = unidadesDescuentoEnLinea * precioUnitario * 0.2;
    const subtotalLinea = linea.cantidad * precioUnitario - descuentoPromocion;

    totalDescuento += descuentoPromocion;
    descuentoPorUnidad = linea.cantidad > 0 ? descuentoPromocion / linea.cantidad : 0;

    items.push({
      producto:           linea.producto,
      cantidad:           linea.cantidad,
      precio_unitario:    precioUnitario,
      descuento_aplicado: parseFloat(descuentoPromocion.toFixed(2)),
      subtotal:           parseFloat(subtotalLinea.toFixed(2)),
    });
  }

  const total = items.reduce((s, i) => s + i.subtotal, 0);

  return {
    items,
    total:              parseFloat(total.toFixed(2)),
    descuento_total:    parseFloat(totalDescuento.toFixed(2)),
    promocion_aplicada: unidadesConDescuento.size > 0,
  };
}
