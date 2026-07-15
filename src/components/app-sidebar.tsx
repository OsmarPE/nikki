'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Users,
  Tag,
  Award,
  Layers,
  LogOut,
  PlusCircle,
  Vault,
  Settings,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { logoutAction } from '@/actions/auth';
import { tieneAccesoModulo, type Modulo, type PermisosMap } from '@/lib/permisos';
import type { Rol } from '@/types';

// `modulo: null` = exclusivo de admin, sin importar los permisos granulares.
const NAV: { href: string; label: string; icon: React.ElementType; modulo: Modulo | null }[] = [
  { href: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard, modulo: null },
  { href: '/ventas/nueva', label: 'Nueva venta',  icon: PlusCircle,     modulo: 'ventas' },
  { href: '/caja',         label: 'Caja',         icon: Vault,          modulo: 'caja' },
  { href: '/productos',   label: 'Productos',     icon: Package,        modulo: 'productos' },
  { href: '/inventario',  label: 'Inventario',    icon: Warehouse,      modulo: 'inventario' },
  { href: '/ventas',      label: 'Ventas',        icon: ShoppingCart,   modulo: 'ventas' },
  { href: '/clientes',    label: 'Clientes',      icon: Users,          modulo: 'clientes' },
  { href: '/categorias',  label: 'Categorías',    icon: Tag,            modulo: 'categorias' },
  { href: '/marcas',      label: 'Marcas',        icon: Award,          modulo: 'marcas' },
  { href: '/colecciones', label: 'Colecciones',   icon: Layers,         modulo: 'colecciones' },
  { href: '/configuracion', label: 'Configuración', icon: Settings,     modulo: null },
];

interface AppSidebarProps {
  nombre: string;
  rol: Rol;
  permisos?: PermisosMap;
}

export function AppSidebar({ nombre, rol, permisos }: AppSidebarProps) {
  const pathname = usePathname();
  const sesion = { rol, permisos };

  const navVisible = NAV.filter(item =>
    rol === 'admin' || (item.modulo !== null && tieneAccesoModulo(sesion, item.modulo))
  );

  // El item activo es el de href más específico que coincide con la ruta actual,
  // para que rutas hermanas con prefijo compartido (ej. /ventas y /ventas/nueva)
  // no queden ambas resaltadas a la vez.
  const activeHref = navVisible.reduce<string | null>((best, { href }) => {
    const matches = pathname === href || pathname.startsWith(href + '/');
    if (!matches) return best;
    if (!best || href.length > best.length) return href;
    return best;
  }, null);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex flex-col items-start gap-0 cursor-default select-none">
                <span className="font-semibold leading-tight truncate">
                  Nikki
                </span>
                <span className="text-xs text-sidebar-foreground/60 truncate group-data-[collapsible=icon]:hidden">
                  {nombre}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className='gap-1'>
              {navVisible.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    isActive={href === activeHref}
                    tooltip={label}
                  >
                    <Link href={href} className="flex items-center gap-2 text-sm flex-1">
                      <Icon width="14" height="14" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={logoutAction} className="w-full">
              <SidebarMenuButton
                type="submit"
                tooltip="Cerrar sesión"
                className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                <LogOut />
                <span>Cerrar sesión</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
