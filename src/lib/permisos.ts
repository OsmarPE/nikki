export type Modulo =
  | 'productos' | 'categorias' | 'marcas' | 'colecciones'
  | 'inventario' | 'clientes' | 'ventas' | 'caja';

export type Accion = 'ver' | 'crear' | 'editar' | 'eliminar';

export interface PermisoModulo {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
}

export type PermisosMap = Partial<Record<Modulo, PermisoModulo>>;

export const PERMISO_VACIO: PermisoModulo = { ver: false, crear: false, editar: false, eliminar: false };

export const MODULOS: { key: Modulo; label: string }[] = [
  { key: 'productos',   label: 'Productos' },
  { key: 'categorias',  label: 'Categorías' },
  { key: 'marcas',      label: 'Marcas' },
  { key: 'colecciones', label: 'Colecciones' },
  { key: 'inventario',  label: 'Inventario' },
  { key: 'clientes',    label: 'Clientes' },
  { key: 'ventas',      label: 'Ventas' },
  { key: 'caja',        label: 'Caja' },
];

export const ACCIONES: { key: Accion; label: string }[] = [
  { key: 'ver',      label: 'Ver' },
  { key: 'crear',    label: 'Crear' },
  { key: 'editar',   label: 'Editar' },
  { key: 'eliminar', label: 'Eliminar' },
];

// Ruta del panel admin que corresponde a cada módulo — usada tanto por el
// sidebar del panel admin como por el layout de /pos para saber a dónde
// mandar a un vendedor con permisos (ver components/app-sidebar.tsx y
// app/(pos)/layout.tsx). Debe reflejar exactamente RUTA_MODULO en middleware.ts.
export const MODULO_RUTA: Record<Modulo, string> = {
  productos:   '/productos',
  categorias:  '/categorias',
  marcas:      '/marcas',
  colecciones: '/colecciones',
  inventario:  '/inventario',
  clientes:    '/clientes',
  ventas:      '/ventas',
  caja:        '/caja',
};

interface SesionConPermisos {
  rol: 'admin' | 'vendedor';
  permisos?: PermisosMap;
}

/**
 * El admin siempre tiene acceso total. Un vendedor solo tiene la acción si
 * un admin se la asignó explícitamente en `permisos_usuario` — ver
 * `actions/usuarios.ts` (guardarPermisosUsuario) y `actions/auth.ts`
 * (loginAction incluye este mapa en el JWT al iniciar sesión).
 */
export function tienePermiso(
  session: SesionConPermisos | null | undefined,
  modulo: Modulo,
  accion: Accion,
): boolean {
  if (!session) return false;
  if (session.rol === 'admin') return true;
  return !!session.permisos?.[modulo]?.[accion];
}

export function tieneAccesoModulo(session: SesionConPermisos | null | undefined, modulo: Modulo): boolean {
  return tienePermiso(session, modulo, 'ver');
}

/** Primer módulo (en el orden de MODULOS) al que el usuario tiene acceso, o null. */
export function primerModuloAccesible(session: SesionConPermisos | null | undefined): Modulo | null {
  const modulo = MODULOS.find(m => tieneAccesoModulo(session, m.key));
  return modulo?.key ?? null;
}
