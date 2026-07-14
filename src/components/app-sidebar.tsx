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

const NAV = [
  { href: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/ventas/nueva', label: 'Nueva venta',  icon: PlusCircle },
  { href: '/caja',         label: 'Caja',         icon: Vault },
  { href: '/productos',   label: 'Productos',     icon: Package },
  { href: '/inventario',  label: 'Inventario',    icon: Warehouse },
  { href: '/ventas',      label: 'Ventas',        icon: ShoppingCart },
  { href: '/clientes',    label: 'Clientes',      icon: Users },
  { href: '/categorias',  label: 'Categorías',    icon: Tag },
  { href: '/marcas',      label: 'Marcas',        icon: Award },
  { href: '/colecciones', label: 'Colecciones',   icon: Layers },
];

interface AppSidebarProps {
  nombre: string;
}

export function AppSidebar({ nombre }: AppSidebarProps) {
  const pathname = usePathname();

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
              {NAV.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    isActive={pathname === href || pathname.startsWith(href + '/')}
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
