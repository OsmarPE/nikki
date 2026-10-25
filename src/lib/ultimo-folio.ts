// Último folio de nota de compra usado en este navegador. Se ofrece como
// sugerencia ("Usar 7316") al registrar piezas, porque una nota suele traer
// varios productos que se capturan uno tras otro. No se rellena solo, para no
// arrastrar por error el folio de una nota anterior.
const KEY = 'inventario:ultimo-folio';

export function leerUltimoFolio(): string {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

export function guardarUltimoFolio(folio: string) {
  const f = folio.trim();
  if (!f) return;
  try { localStorage.setItem(KEY, f); } catch { /* storage bloqueado */ }
}
