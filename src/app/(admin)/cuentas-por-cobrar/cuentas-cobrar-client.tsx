'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { Wallet, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { FacetedFilter } from '@/components/ui/combobox';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { CuentaPorCobrar } from '@/actions/ventas';

function buildColumns(router: ReturnType<typeof useRouter>): ColumnDef<CuentaPorCobrar>[] {
  return [
    {
      accessorKey: 'cliente_nombre',
      header: 'Cliente',
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/ventas/${row.original.venta_id}`)}
          className="text-sm font-medium hover:text-primary hover:underline underline-offset-2 transition-colors"
        >
          {row.original.cliente_nombre}
        </button>
      ),
    },
    {
      accessorKey: 'folio',
      header: 'Folio',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.folio}</span>,
    },
    {
      accessorKey: 'usuario_nombre',
      header: 'Vendedor',
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.usuario_nombre}</span>,
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.total)}</span>,
    },
    {
      accessorKey: 'abonado',
      header: 'Abonado',
      cell: ({ row }) => <span className="tabular-nums text-green-700">{formatCurrency(row.original.abonado)}</span>,
    },
    {
      accessorKey: 'saldo_pendiente',
      header: 'Saldo pendiente',
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums text-amber-700">
          {formatCurrency(row.original.saldo_pendiente)}
        </span>
      ),
    },
    {
      accessorKey: 'creado_at',
      header: 'Fecha de venta',
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{formatDate(row.original.creado_at)}</span>,
    },
    {
      id: 'acciones',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => router.push(`/ventas/${row.original.venta_id}`)}>
            Registrar abono
          </Button>
        </div>
      ),
    },
  ];
}

export default function CuentasPorCobrarClient({ cuentas }: { cuentas: CuentaPorCobrar[] }) {
  const router = useRouter();
  const columns = useMemo(() => buildColumns(router), [router]);
  const [busqueda, setBusqueda] = useState('');
  const [clientes, setClientes] = useState<Set<string>>(new Set());

  // Un cliente por id (no por nombre, para no mezclar homónimos), con el
  // conteo de cuentas pendientes que tiene — alimenta el filtro facetado.
  const clientesConConteo = useMemo(() => {
    const porCliente = new Map<string, { value: string; label: string; count: number }>();
    for (const c of cuentas) {
      const key = String(c.cliente_id);
      const entry = porCliente.get(key);
      if (entry) entry.count += 1;
      else porCliente.set(key, { value: key, label: c.cliente_nombre, count: 1 });
    }
    return Array.from(porCliente.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [cuentas]);

  const filtradas = useMemo(() =>
    cuentas.filter(c => {
      const matchBusqueda =
        c.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.folio.toLowerCase().includes(busqueda.toLowerCase());
      const matchCliente = clientes.size === 0 || clientes.has(String(c.cliente_id));
      return matchBusqueda && matchCliente;
    }),
  [cuentas, busqueda, clientes]);

  const hayFiltros = busqueda !== '' || clientes.size > 0;

  function limpiarTodo() {
    setBusqueda('');
    setClientes(new Set());
  }

  const totalPorCobrar = useMemo(
    () => cuentas.reduce((s, c) => s + Number(c.saldo_pendiente), 0),
    [cuentas],
  );

  return (
    <div className="space-y-5">
      <div>
        <Text as="h2" variant="title">Cuentas por cobrar</Text>
        <Text variant="description">Ventas a crédito con saldo pendiente</Text>
      </div>

      <Card className="px-4 py-4 max-w-xs">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Wallet size={15} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total por cobrar</p>
            <p className="text-xl font-bold tracking-tight tabular-nums">{formatCurrency(totalPorCobrar)}</p>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Buscar cliente o folio…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="h-8 w-64 text-sm"
        />

        {/* <FacetedFilter
          title="Cliente"
          options={clientesConConteo}
          selected={clientes}
          onSelectionChange={setClientes}
        /> */}

        {hayFiltros && (
          <Button variant="outline" size="sm" onClick={limpiarTodo} className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1.5">
            <X size={13} />
            Limpiar
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtradas.length} {filtradas.length === 1 ? 'cuenta' : 'cuentas'}
        </span>
      </div>

      <DataTable
        columns={columns}
        data={filtradas}
        emptyMessage="No hay cuentas por cobrar."
        pageSize={20}
      />
    </div>
  );
}
