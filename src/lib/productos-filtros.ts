// Filtros de la lista de productos serializados en la URL, para que sobrevivan
// al entrar al detalle de un producto y regresar (botón Volver o Atrás).

export interface ProductosFiltros {
  busqueda: string;
  marcas: string[];
  categorias: string[];
  colecciones: string[];
  soloSinStock: boolean;
  /** 0-based (en la URL se guarda 1-based como `pagina`). */
  pagina: number;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function lista(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).filter(Boolean);
}

export function parseProductosFiltros(sp: RawSearchParams): ProductosFiltros {
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const pag = parseInt((Array.isArray(sp.pagina) ? sp.pagina[0] : sp.pagina) ?? '', 10);
  return {
    busqueda:     q ?? '',
    marcas:       lista(sp.marca),
    categorias:   lista(sp.categoria),
    colecciones:  lista(sp.coleccion),
    soloSinStock: sp.sinstock === '1',
    pagina:       Number.isFinite(pag) && pag > 1 ? pag - 1 : 0,
  };
}

export function productosFiltrosQuery(f: ProductosFiltros): string {
  const p = new URLSearchParams();
  if (f.busqueda) p.set('q', f.busqueda);
  f.marcas.forEach(v => p.append('marca', v));
  f.categorias.forEach(v => p.append('categoria', v));
  f.colecciones.forEach(v => p.append('coleccion', v));
  if (f.soloSinStock) p.set('sinstock', '1');
  if (f.pagina > 0) p.set('pagina', String(f.pagina + 1));
  const s = p.toString();
  return s ? `?${s}` : '';
}

// Última URL de la lista, para que el detalle regrese a ella en vez de a /productos "limpio".
const RETORNO_KEY = 'productos:retorno';

export function guardarRetornoProductos(query: string) {
  try { sessionStorage.setItem(RETORNO_KEY, query); } catch { /* storage bloqueado */ }
}

export function urlRetornoProductos(): string {
  try {
    const q = sessionStorage.getItem(RETORNO_KEY);
    if (q && q.startsWith('?')) return `/productos${q}`;
  } catch { /* storage bloqueado */ }
  return '/productos';
}
