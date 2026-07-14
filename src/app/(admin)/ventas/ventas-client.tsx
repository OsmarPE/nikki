'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { FacetedFilter } from '@/components/ui/combobox';
import { Text } from '@/components/ui/text';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Banknote, CreditCard, ArrowRightLeft, X, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Venta } from '@/types';

const METODO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

const METODO_ICONS: Record<string, React.ReactNode> = {
  efectivo:      <Banknote size={13} />,
  transferencia: <ArrowRightLeft size={13} />,
  tarjeta:       <CreditCard size={13} />,
};

function buildColumns(router: ReturnType<typeof useRouter>): ColumnDef<Venta>[] {
  return [
  {
    accessorKey: 'folio',
    header: 'Folio',
    cell: ({ row }) => (
      <button
        onClick={() => router.push(`/ventas/${row.original.id}`)}
        className="font-mono text-xs font-semibold hover:text-primary hover:underline underline-offset-2 transition-colors"
      >
        {row.original.folio}
      </button>
    ),
  },
  {
    accessorKey: 'cliente_nombre',
    header: 'Cliente',
    cell: ({ row }) =>
      row.original.cliente_nombre ?? (
        <span className="text-muted-foreground italic text-xs">Público general</span>
      ),
  },
  {
    accessorKey: 'usuario_nombre',
    header: 'Vendedor',
    cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.usuario_nombre}</span>,
  },
  {
    accessorKey: 'metodo_pago',
    header: 'Método',
    cell: ({ row }) => (
      <Badge variant="secondary" className="gap-1.5 font-normal">
        {METODO_ICONS[row.original.metodo_pago]}
        {METODO_LABELS[row.original.metodo_pago]}
      </Badge>
    ),
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => (
      <span className="font-semibold tabular-nums">{formatCurrency(row.original.total)}</span>
    ),
  },
  {
    accessorKey: 'creado_at',
    header: 'Fecha',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">{formatDate(row.original.creado_at)}</span>
    ),
  },
  {
    id: 'acciones',
    header: '',
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => router.push(`/ventas/${row.original.id}`)}
          className="inline-flex items-center px-2.5 py-1 text-xs rounded-md hover:bg-muted transition-colors font-medium text-muted-foreground hover:text-foreground"
        >
          Ver detalle
        </button>
        <a
          href={`/api/pdf/${row.original.id}`}
          target="_blank"
          className="inline-flex items-center px-2.5 py-1 text-xs border rounded-md hover:bg-muted transition-colors font-medium"
        >
          PDF
        </a>
      </div>
    ),
  },
  ];
}

const METODO_OPTIONS = Object.entries(METODO_LABELS).map(([value, label]) => ({
  value,
  label,
  icon: METODO_ICONS[value],
}));

export default function VentasClient({ ventas }: { ventas: Venta[] }) {
  const router = useRouter();
  const columns = useMemo(() => buildColumns(router), [router]);
  const [busqueda, setBusqueda] = useState('');
  const [metodos, setMetodos] = useState<Set<string>>(new Set());

  // Contar métodos para el badge de cantidad en el filter
  const metodosConConteo = useMemo(() =>
    METODO_OPTIONS.map(o => ({
      ...o,
      count: ventas.filter(v => v.metodo_pago === o.value).length,
    })),
  [ventas]);

  const filtradas = useMemo(() =>
    ventas.filter(v => {
      const matchBusqueda =
        v.folio.toLowerCase().includes(busqueda.toLowerCase()) ||
        (v.cliente_nombre ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (v.usuario_nombre ?? '').toLowerCase().includes(busqueda.toLowerCase());

      const matchMetodo = metodos.size === 0 || metodos.has(v.metodo_pago);

      return matchBusqueda && matchMetodo;
    }),
  [ventas, busqueda, metodos]);

  const hayFiltros = busqueda || metodos.size > 0;

  function limpiarTodo() {
    setBusqueda('');
    setMetodos(new Set());
  }

  return (
    <div className="space-y-5">
      <div>
        <Text as="h2" variant="title">Historial de ventas</Text>
        <Text variant="description">Registro de ventas</Text>
      </div>
      <Button variant="outline" onClick={() => router.push('/ventas/nueva')}>
        <PlusCircle size={13} />
        Nueva venta
      </Button>

      {/* Barra de filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Buscar folio, cliente o vendedor…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="h-8 w-64 text-sm"
        />

        <FacetedFilter
          title="Método de pago"
          options={metodosConConteo}
          selected={metodos}
          onSelectionChange={setMetodos}
        />

        {hayFiltros && (
          <Button
            variant="outline"
            size="sm"
            onClick={limpiarTodo}
            className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1.5"
          >
            <X size={13} />
            Limpiar
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtradas.length} {filtradas.length === 1 ? 'venta' : 'ventas'}
        </span>
      </div>

      <DataTable
        columns={columns}
        data={filtradas}
        emptyMessage="Sin ventas."
          pageSize={25}
      />
    </div>
  );
}
