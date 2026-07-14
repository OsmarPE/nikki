'use client';

import { useMemo } from 'react';
import { createColumnsSaleDay } from '@/components/ui/columns';
import { DataTable } from '@/components/ui/data-table';

type VentaDia = { fecha: string; ventas: number; ingresos: number };

export function DashboardTable({ data }: { data: VentaDia[] }) {
  const columns = useMemo(
    () =>
      createColumnsSaleDay({
        onEdit: (row) => {
          console.log('Editar:', row);
          // TODO: abrir modal de edición
        },
        onDelete: (row) => {
          console.log('Eliminar:', row);
          // TODO: confirmar y eliminar
        },
      }),
    []
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage="Sin datos."
      pageSize={31}
    />
  );
}
