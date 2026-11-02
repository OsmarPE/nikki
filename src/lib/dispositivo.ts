// En pantallas táctiles (tablet, celular) enfocar un campo abre el teclado
// virtual, que tapa la mitad de la pantalla. En buscadores donde lo principal
// es recorrer una lista (catálogo de productos, clientes) solo se enfoca solo
// el campo si hay mouse/trackpad; en táctil el teclado sale al tocarlo.
export function tienePunteroFino(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;
}
