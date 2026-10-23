'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { FacetedFilter } from '@/components/ui/combobox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatCurrency, formatDate, formatDateTime, formatTime, parseMySQL, toLocalDateKey, todayLocal } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Banknote, CreditCard, ArrowRightLeft, Wallet, X, PlusCircle, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Venta } from '@/types';
import type { AbonoListado } from '@/actions/ventas';

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

type EstadoPago = 'pagada' | 'parcial' | 'pendiente';

function estadoPago(v: Venta): EstadoPago {
  if (v.tipo_venta !== 'credito') return 'pagada';
  const saldo = Number(v.saldo_pendiente ?? 0);
  if (saldo <= 0) return 'pagada';
  if (saldo >= Number(v.total)) return 'pendiente';
  return 'parcial';
}

const ESTADO_LABELS: Record<EstadoPago, string> = {
  pagada: 'Pagada',
  parcial: 'Parcial',
  pendiente: 'Pendiente',
};

const ESTADO_CLASSES: Record<EstadoPago, string> = {
  pagada:    'bg-green-50 text-green-700 border-green-200',
  parcial:   'bg-amber-50 text-amber-700 border-amber-200',
  pendiente: 'bg-red-50 text-red-700 border-red-200',
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
    cell: ({ row }) =>
      row.original.tipo_venta === 'credito' ? (
        <Badge variant="secondary" className="gap-1.5 font-normal">
          <Wallet size={13} />
          Crédito
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1.5 font-normal">
          {row.original.metodo_pago && METODO_ICONS[row.original.metodo_pago]}
          {row.original.metodo_pago ? METODO_LABELS[row.original.metodo_pago] : '—'}
        </Badge>
      ),
  },
  {
    id: 'estado_pago',
    header: 'Estado',
    cell: ({ row }) => {
      const estado = estadoPago(row.original);
      return (
        <Badge variant="outline" className={cn('font-normal', ESTADO_CLASSES[estado])}>
          {ESTADO_LABELS[estado]}
        </Badge>
      );
    },
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

// ─── Columnas de abonos: cada abono aparece en el día en que se cobró ─────────
function buildAbonoColumns(router: ReturnType<typeof useRouter>): ColumnDef<AbonoListado>[] {
  return [
    {
      accessorKey: 'creado_at',
      header: 'Cobrado el',
      cell: ({ row }) => <span className="text-sm">{formatDateTime(row.original.creado_at)}</span>,
    },
    {
      accessorKey: 'folio',
      header: 'Folio',
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/ventas/${row.original.venta_id}`)}
          className="font-mono text-xs font-semibold hover:text-primary hover:underline underline-offset-2 transition-colors"
        >
          {row.original.folio}
        </button>
      ),
    },
    {
      accessorKey: 'cliente_nombre',
      header: 'Cliente',
      cell: ({ row }) => row.original.cliente_nombre ?? <span className="text-muted-foreground">—</span>,
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
      accessorKey: 'usuario_nombre',
      header: 'Cobró',
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.usuario_nombre ?? '—'}</span>,
    },
    {
      accessorKey: 'monto',
      header: 'Monto',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">{formatCurrency(row.original.monto)}</span>
          {row.original.liquidacion && (
            <Badge variant="outline" className={cn('font-normal', ESTADO_CLASSES.pagada)}>Liquidación</Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'venta_creado_at',
      header: 'Venta del',
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{formatDate(row.original.venta_creado_at)}</span>,
    },
  ];
}

// ─── Tabla del día: lo que entró en un día concreto ───────────────────────────
// Una sola columna de importe = dinero cobrado ese día, así el total es lo que
// se ganó en el día (cuadra con el corte de caja):
//   · venta de contado      → su total
//   · abono / liquidación   → su monto
//   · apartado hecho ese día → aparece una vez, con su anticipo (o $0 si no dejó)
interface MovimientoDia {
  key: string;
  hora: string;
  concepto: string;
  ventaId: number;
  folio: string;
  cliente: string | null;
  metodo: string | null;
  importe: number;
}

function TablaDia({ movimientos, onVerVenta }: { movimientos: MovimientoDia[]; onVerVenta: (id: number) => void }) {
  const total = movimientos.reduce((s, m) => s + m.importe, 0);
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Hora</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead>Folio</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Método</TableHead>
            <TableHead className="text-right">Importe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movimientos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-zinc-400 text-sm">
                Sin ventas ni abonos este día.
              </TableCell>
            </TableRow>
          ) : movimientos.map(m => (
            <TableRow key={m.key}>
              <TableCell className="text-muted-foreground text-sm tabular-nums">{formatTime(m.hora)}</TableCell>
              <TableCell className="text-sm">{m.concepto}</TableCell>
              <TableCell>
                <button
                  onClick={() => onVerVenta(m.ventaId)}
                  className="font-mono text-xs font-semibold hover:text-primary hover:underline underline-offset-2 transition-colors"
                >
                  {m.folio}
                </button>
              </TableCell>
              <TableCell className="text-sm">
                {m.cliente ?? <span className="text-muted-foreground italic text-xs">Público general</span>}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{m.metodo ? METODO_LABELS[m.metodo] : '—'}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(m.importe)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5} className="font-semibold">
              Total del día
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {movimientos.length} {movimientos.length === 1 ? 'movimiento' : 'movimientos'}
              </span>
            </TableCell>
            <TableCell className="text-right font-bold tabular-nums text-green-700">{formatCurrency(total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

const METODO_OPTIONS = Object.entries(METODO_LABELS).map(([value, label]) => ({
  value,
  label,
  icon: METODO_ICONS[value],
}));

const ESTADO_OPTIONS = (Object.entries(ESTADO_LABELS) as [EstadoPago, string][]).map(([value, label]) => ({
  value,
  label,
}));

export default function VentasClient({ ventas, abonos }: { ventas: Venta[]; abonos: AbonoListado[] }) {
  const router = useRouter();
  const columns = useMemo(() => buildColumns(router), [router]);
  const abonoColumns = useMemo(() => buildAbonoColumns(router), [router]);
  const [tab, setTab] = useState<'ventas' | 'abonos'>('ventas');
  const [busqueda, setBusqueda] = useState('');
  const [metodos, setMetodos] = useState<Set<string>>(new Set());
  const [estados, setEstados] = useState<Set<string>>(new Set());
  const [fecha, setFecha] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const fechaSeleccionada = fecha ? new Date(`${fecha}T00:00:00`) : undefined;

  // Contar métodos para el badge de cantidad en el filter
  const metodosConConteo = useMemo(() =>
    METODO_OPTIONS.map(o => ({
      ...o,
      count: ventas.filter(v => v.metodo_pago === o.value).length,
    })),
  [ventas]);

  const estadosConConteo = useMemo(() =>
    ESTADO_OPTIONS.map(o => ({
      ...o,
      count: ventas.filter(v => estadoPago(v) === o.value).length,
    })),
  [ventas]);

  const filtradas = useMemo(() =>
    ventas.filter(v => {
      const matchBusqueda =
        v.folio.toLowerCase().includes(busqueda.toLowerCase()) ||
        (v.cliente_nombre ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (v.usuario_nombre ?? '').toLowerCase().includes(busqueda.toLowerCase());

      const matchMetodo = metodos.size === 0 || (v.metodo_pago != null && metodos.has(v.metodo_pago));

      const matchEstado = estados.size === 0 || estados.has(estadoPago(v));

      const matchFecha = !fecha || toLocalDateKey(v.creado_at) === fecha;

      return matchBusqueda && matchMetodo && matchEstado && matchFecha;
    }),
  [ventas, busqueda, metodos, estados, fecha]);

  // Mismos filtros de búsqueda, método y fecha, pero sobre la fecha en que se cobró el abono.
  const abonosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return abonos.filter(a =>
      (a.folio.toLowerCase().includes(q) ||
        (a.cliente_nombre ?? '').toLowerCase().includes(q) ||
        (a.usuario_nombre ?? '').toLowerCase().includes(q)) &&
      (metodos.size === 0 || metodos.has(a.metodo_pago)) &&
      (!fecha || toLocalDateKey(a.creado_at) === fecha));
  }, [abonos, busqueda, metodos, fecha]);

  // Con un día elegido: ventas y abonos de ese día en una sola tabla (ver TablaDia).
  // Aplica búsqueda y método de pago; el estado de pago no aplica aquí.
  const movimientosDia = useMemo<MovimientoDia[] | null>(() => {
    if (!fecha) return null;
    const q = busqueda.toLowerCase();
    const coincide = (folio: string, cliente: string | null, persona: string | null, metodo: string | null) =>
      (folio.toLowerCase().includes(q) ||
        (cliente ?? '').toLowerCase().includes(q) ||
        (persona ?? '').toLowerCase().includes(q)) &&
      (metodos.size === 0 || (metodo != null && metodos.has(metodo)));

    const ventasDia = ventas.filter(v => toLocalDateKey(v.creado_at) === fecha);
    const abonosDia = abonos.filter(a => toLocalDateKey(a.creado_at) === fecha);
    const apartadosDelDia = new Set(ventasDia.filter(v => v.tipo_venta === 'credito').map(v => v.id));
    const conAnticipo = new Set(abonosDia.map(a => a.venta_id));
    const filas: MovimientoDia[] = [];

    for (const v of ventasDia) {
      if (v.tipo_venta !== 'credito') {
        if (!coincide(v.folio, v.cliente_nombre ?? null, v.usuario_nombre ?? null, v.metodo_pago ?? null)) continue;
        filas.push({ key: `v${v.id}`, hora: v.creado_at, concepto: 'Venta', ventaId: v.id, folio: v.folio,
          cliente: v.cliente_nombre ?? null, metodo: v.metodo_pago ?? null, importe: Number(v.total) });
      } else if (!conAnticipo.has(v.id)) {
        // Apartado sin anticipo: se muestra para que se vea, pero no suma.
        if (!coincide(v.folio, v.cliente_nombre ?? null, v.usuario_nombre ?? null, null)) continue;
        filas.push({ key: `v${v.id}`, hora: v.creado_at, concepto: 'Apartado (sin anticipo)', ventaId: v.id,
          folio: v.folio, cliente: v.cliente_nombre ?? null, metodo: null, importe: 0 });
      }
    }

    // El primer abono de un apartado hecho ese mismo día es su anticipo.
    const vistos = new Set<number>();
    const abonosOrdenados = [...abonosDia].sort((x, y) => parseMySQL(x.creado_at).getTime() - parseMySQL(y.creado_at).getTime());
    for (const a of abonosOrdenados) {
      const esAnticipo = apartadosDelDia.has(a.venta_id) && !vistos.has(a.venta_id);
      vistos.add(a.venta_id);
      if (!coincide(a.folio, a.cliente_nombre, a.usuario_nombre, a.metodo_pago)) continue;
      const concepto = esAnticipo
        ? (a.liquidacion ? 'Apartado (liquidado)' : 'Apartado (anticipo)')
        : (a.liquidacion ? 'Liquidación' : 'Abono');
      filas.push({ key: `a${a.id}`, hora: a.creado_at, concepto, ventaId: a.venta_id, folio: a.folio,
        cliente: a.cliente_nombre, metodo: a.metodo_pago, importe: a.monto });
    }

    return filas.sort((x, y) => parseMySQL(x.hora).getTime() - parseMySQL(y.hora).getTime());
  }, [ventas, abonos, fecha, busqueda, metodos]);

  const hayFiltros = busqueda || metodos.size > 0 || estados.size > 0 || fecha;

  function limpiarTodo() {
    setBusqueda('');
    setMetodos(new Set());
    setEstados(new Set());
    setFecha('');
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

        {tab === 'ventas' && !fecha && (
          <FacetedFilter
            title="Estado de pago"
            options={estadosConConteo}
            selected={estados}
            onSelectionChange={setEstados}
          />
        )}

        {/* Acceso rápido al día de hoy (vuelve a tocarlo para quitar el filtro) */}
        <Button
          variant="outline"
          size="sm"
          aria-pressed={fecha === todayLocal()}
          onClick={() => setFecha(fecha === todayLocal() ? '' : todayLocal())}
          className={cn('h-8 text-sm font-normal', fecha === todayLocal() && 'border-primary/40 bg-primary/5 font-medium')}
        >
          Hoy
        </Button>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className={cn('h-8 text-sm font-normal justify-start', !fecha && 'text-muted-foreground')}
              />
            }
          >
            <CalendarIcon size={13} />
            {fecha ? format(fechaSeleccionada!, "d 'de' MMMM, yyyy", { locale: es }) : 'Filtrar por fecha'}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              locale={es}
              selected={fechaSeleccionada}
              onSelect={date => {
                setFecha(date ? format(date, 'yyyy-MM-dd') : '');
                setCalendarOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>

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
          {movimientosDia ? '' : tab === 'ventas'
            ? `${filtradas.length} ${filtradas.length === 1 ? 'venta' : 'ventas'}`
            : `${abonosFiltrados.length} ${abonosFiltrados.length === 1 ? 'abono' : 'abonos'}`}
        </span>
      </div>

      {movimientosDia ? (
        <TablaDia movimientos={movimientosDia} onVerVenta={id => router.push(`/ventas/${id}`)} />
      ) : (
      <>
      <Tabs value={tab} onValueChange={v => setTab(v as 'ventas' | 'abonos')}>
        <TabsList>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="abonos">Abonos cobrados</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'ventas' ? (
        <DataTable
          columns={columns}
          data={filtradas}
          emptyMessage="Sin ventas."
          pageSize={20}
        />
      ) : (
        <DataTable
          columns={abonoColumns}
          data={abonosFiltrados}
          emptyMessage={fecha ? 'No se cobraron abonos este día.' : 'Sin abonos.'}
          pageSize={20}
        />
      )}
      </>
      )}
    </div>
  );
}
