'use client';

import { formatCurrency } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { Box, Calendar, MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

type VentaDia = { fecha: string; ventas: number; ingresos: number };

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleDateString('es-MX', { month: 'long' });
  const year = date.getFullYear();
  return `${day}/${month.charAt(0).toUpperCase() + month.slice(1)}/${year}`;
}

interface VentaDiaActions {
  onEdit?: (row: VentaDia) => void;
  onDelete?: (row: VentaDia) => void;
}

export function createColumnsSaleDay(
  actions: VentaDiaActions = {}
): ColumnDef<VentaDia>[] {
  return [
    {
      accessorKey: 'fecha',
      header: 'Fecha',
      cell: ({ row }) => (
        <span className="text-zinc-700 flex items-center gap-2">
            <Calendar width="14" height="14" />
            {formatDate(row.original.fecha)}
        </span>
      ),
    },
    {
      accessorKey: 'ventas',
      header: 'Ventas',
      cell: ({ row }) => (
        <span className="font-medium flex items-center gap-2">
            <Box width="14" height="14" />
            {row.original.ventas}
        </span>
      ),
    },
    {
      accessorKey: 'ingresos',
      header: 'Ingresos',
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(Number(row.original.ingresos))}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                  <Button variant="ghost" size="icon-sm" aria-label="Abrir menú" />
                }
                >
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => actions.onEdit?.(row.original)}>
                <PencilIcon />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => actions.onDelete?.(row.original)}
              >
                <Trash2Icon />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
}

/** @deprecated Usa `createColumnsSaleDay()` en su lugar */
export const columnsSaleDay = createColumnsSaleDay();
