import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVentasParaExport } from '@/actions/ventas';
import { opcionesDesdeQuery, METODO_LABEL } from '@/lib/export-ventas';
import ExcelJS from 'exceljs';

// Colores corporativos — tema Notion
const COLOR_HEADER_BG   = 'FF18181B'; // zinc-900
const COLOR_HEADER_FONT = 'FFFAFAFA'; // zinc-50
const COLOR_ACCENT      = 'FF3F3F46'; // zinc-700
const COLOR_ALT_ROW     = 'FFF4F4F5'; // zinc-100
const COLOR_POSITIVE    = 'FF16A34A'; // green-600
const COLOR_BORDER      = 'FFE4E4E7'; // zinc-200
const COLOR_PENDING     = 'FFDC2626'; // red-600 (saldo pendiente)

const moneyFmt    = '"$"#,##0.00';
const dateFmt     = 'dd/mm/yyyy';
const dateTimeFmt = 'dd/mm/yyyy hh:mm';
const numFmt      = '#,##0';

const METODOS: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', 'sin especificar': 'Sin especificar',
};

// Las fechas ya vienen en hora de México; se escriben como UTC para que Excel
// muestre exactamente esa hora, sin volver a convertir de zona.
const aFechaHora = (s: string) => new Date(s.replace(' ', 'T') + 'Z');
const aFecha     = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00Z');
const fmtDia     = (s: string) => s.split('-').reverse().join('/');

type Formato = 'text' | 'money' | 'num' | 'date' | 'datetime';
type Valor = string | number | Date | null;

interface Columna {
  label: string;
  width: number;
  fmt?: Formato;
  /** Montos > 0 en negrita y verde. */
  positivo?: boolean;
  /** Montos > 0 en negrita y rojo. */
  pendiente?: boolean;
  /** Se suma en la fila de totales. */
  sumar?: boolean;
}

// ─── Título + subtítulo de una hoja (filas 1 y 2) ─────────────────────────────
function encabezadoHoja(ws: ExcelJS.Worksheet, lastCol: number, titulo: string, subtitulo: string) {
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell('A1');
  titleCell.value = titulo;
  titleCell.font  = { name: 'Arial', size: 14, bold: true, color: { argb: COLOR_HEADER_FONT } };
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, lastCol);
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = subtitulo;
  subtitleCell.font  = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF71717A' } };
  subtitleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFF0' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;
}

// ─── Tabla con cabecera, filas alternadas, totales y borde exterior ──────────
// Devuelve la fila siguiente a la de totales.
function escribirTabla(ws: ExcelJS.Worksheet, opts: {
  filaInicio: number;
  columnas: Columna[];
  filas: Valor[][];
  totalLabel: string;
  autoFilter?: boolean;
  dataBarCol?: number;
}): number {
  const { filaInicio, columnas, filas, totalLabel } = opts;
  const lastCol = columnas.length;

  // Cabecera
  const headerRow = ws.getRow(filaInicio);
  headerRow.height = 24;
  columnas.forEach((c, i) => {
    const col  = i + 1;
    const cell = headerRow.getCell(col);
    const izq  = !c.fmt || c.fmt === 'text';
    cell.value     = c.label;
    cell.font      = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLOR_HEADER_FONT } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ACCENT } };
    cell.alignment = { vertical: 'middle', horizontal: izq ? 'left' : 'center', indent: izq ? 1 : 0 };
    cell.border    = {
      bottom: { style: 'thin', color: { argb: COLOR_HEADER_BG } },
      right:  { style: 'thin', color: { argb: COLOR_HEADER_BG } },
    };
  });
  if (opts.autoFilter) {
    ws.autoFilter = { from: { row: filaInicio, column: 1 }, to: { row: filaInicio, column: lastCol } };
  }

  // Datos
  const primeraDato = filaInicio + 1;
  filas.forEach((fila, idx) => {
    const rowNum  = primeraDato + idx;
    const bgColor = idx % 2 === 1 ? COLOR_ALT_ROW : 'FFFFFFFF';
    fila.forEach((val, ci) => {
      const c    = columnas[ci];
      const cell = ws.getCell(rowNum, ci + 1);
      cell.value  = val ?? '—';
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.font   = { name: 'Arial', size: 9.5 };
      cell.border = {
        bottom: { style: 'hair', color: { argb: COLOR_BORDER } },
        right:  { style: 'hair', color: { argb: COLOR_BORDER } },
      };
      switch (c.fmt) {
        case 'money': {
          cell.numFmt    = moneyFmt;
          cell.alignment = { horizontal: 'right' };
          const n = Number(val ?? 0);
          if (c.positivo  && n > 0) cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLOR_POSITIVE } };
          if (c.pendiente && n > 0) cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLOR_PENDING } };
          break;
        }
        case 'num':      cell.numFmt = numFmt;      cell.alignment = { horizontal: 'center' }; break;
        case 'date':     cell.numFmt = dateFmt;     cell.alignment = { horizontal: 'center' }; break;
        case 'datetime': cell.numFmt = dateTimeFmt; cell.alignment = { horizontal: 'center' }; break;
        default:         cell.alignment = { horizontal: 'left', indent: 1 };
      }
    });
    ws.getRow(rowNum).height = 18;
  });

  const ultimaDato = primeraDato + filas.length - 1;
  if (opts.dataBarCol && filas.length > 0) {
    const letra = ws.getColumn(opts.dataBarCol).letter;
    ws.addConditionalFormatting({
      ref: `${letra}${primeraDato}:${letra}${ultimaDato}`,
      rules: [{
        type: 'dataBar',
        priority: 1,
        gradient: true,
        border: false,
        color: { argb: 'FFBBF7D0' },
        cfvo: [{ type: 'min' }, { type: 'max' }],
      } as ExcelJS.DataBarRuleType],
    });
  }

  // Fila de totales
  const totalRowNum = ultimaDato + 1;
  ws.getRow(totalRowNum).height = 22;
  columnas.forEach((c, i) => {
    const col  = i + 1;
    const cell = ws.getCell(totalRowNum, col);
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
    cell.font   = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLOR_HEADER_FONT } };
    cell.border = { top: { style: 'medium', color: { argb: COLOR_ACCENT } } };
    if (col === 1) {
      cell.value     = totalLabel;
      cell.alignment = { horizontal: 'left', indent: 1, vertical: 'middle' };
    } else if (c.sumar) {
      const letra = ws.getColumn(col).letter;
      cell.value     = filas.length > 0 ? { formula: `SUM(${letra}${primeraDato}:${letra}${ultimaDato})` } : 0;
      cell.numFmt    = c.fmt === 'money' ? moneyFmt : numFmt;
      cell.alignment = { horizontal: c.fmt === 'money' ? 'right' : 'center', vertical: 'middle' };
    }
  });

  // Borde exterior alrededor de toda la tabla
  for (let col = 1; col <= lastCol; col++) {
    const top = ws.getCell(filaInicio, col);
    top.border = { ...top.border, top: { style: 'medium', color: { argb: COLOR_HEADER_BG } } };
    const bottom = ws.getCell(totalRowNum, col);
    bottom.border = { ...bottom.border, bottom: { style: 'medium', color: { argb: COLOR_HEADER_BG } } };
  }
  for (let row = filaInicio; row <= totalRowNum; row++) {
    const left = ws.getCell(row, 1);
    left.border = { ...left.border, left: { style: 'medium', color: { argb: COLOR_HEADER_BG } } };
    const right = ws.getCell(row, lastCol);
    right.border = { ...right.border, right: { style: 'medium', color: { argb: COLOR_HEADER_BG } } };
  }

  return totalRowNum + 1;
}

function tituloSeccion(ws: ExcelJS.Worksheet, row: number, lastCol: number, texto: string) {
  ws.mergeCells(row, 1, row, lastCol);
  const cell = ws.getCell(row, 1);
  cell.value = texto;
  cell.font  = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR_HEADER_BG } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(row).height = 22;
}

// Agrega una hoja con título, subtítulo y una sola tabla (cabecera congelada en fila 3).
function hojaTabla(wb: ExcelJS.Workbook, opts: {
  nombre: string;
  titulo: string;
  subtitulo: string;
  columnas: Columna[];
  filas: Valor[][];
  totalLabel: string;
  dataBarCol?: number;
}) {
  const ws = wb.addWorksheet(opts.nombre, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', ySplit: 3 }],
  });
  opts.columnas.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });
  encabezadoHoja(ws, opts.columnas.length, opts.titulo, opts.subtitulo);
  escribirTabla(ws, {
    filaInicio: 3,
    columnas:   opts.columnas,
    filas:      opts.filas,
    totalLabel: opts.totalLabel,
    autoFilter: true,
    dataBarCol: opts.dataBarCol,
  });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') {
    return new NextResponse('No autorizado', { status: 401 });
  }

  const opciones = opcionesDesdeQuery(req.nextUrl.searchParams);
  if (!opciones)              return new NextResponse('Rango de fechas inválido', { status: 400 });
  if (!opciones.hojas.length) return new NextResponse('Selecciona al menos una hoja', { status: 400 });
  const data = await getVentasParaExport(opciones);
  if (!data) return new NextResponse('Rango de fechas inválido', { status: 400 });

  const { desde, hasta, hojas } = opciones;
  const { ventas, detalles, abonos } = data;
  const periodo = desde === hasta ? fmtDia(desde) : `${fmtDia(desde)} al ${fmtDia(hasta)}`;

  // Subtítulo común: fecha de generación + filtros aplicados.
  const filtros = [
    opciones.tipo !== 'todos' && (opciones.tipo === 'credito' ? 'Solo crédito' : 'Solo contado'),
    opciones.metodos.length > 0 && `Método: ${opciones.metodos.map(m => METODO_LABEL[m]).join(', ')}`,
    data.vendedoresNombres.length > 0 && `Vendedor: ${data.vendedoresNombres.join(', ')}`,
  ].filter(Boolean).join(' · ');
  const generado = `Generado el ${new Date().toLocaleDateString('es-MX', { dateStyle: 'full', timeZone: 'America/Mexico_City' })}`
    + (filtros ? ` · ${filtros}` : '');

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Sistema POS';
  wb.created  = new Date();
  wb.modified = new Date();

  // ─── Hoja: Resumen (primera, para abrir directo en los totales) ─────────────
  if (hojas.includes('resumen')) {
    const wsRes = wb.addWorksheet('Resumen', {
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
    });
    const colsDia: Columna[] = [
      { label: 'Fecha',           width: 16, fmt: 'date' },
      { label: 'N° ventas',       width: 16, fmt: 'num',   sumar: true },
      { label: 'Piezas',          width: 12, fmt: 'num',   sumar: true },
      { label: 'Vendido',         width: 17, fmt: 'money', sumar: true },
      { label: 'Cobrado',         width: 17, fmt: 'money', sumar: true, positivo: true },
      { label: 'Saldo pendiente', width: 17, fmt: 'money', sumar: true, pendiente: true },
    ];
    colsDia.forEach((c, i) => { wsRes.getColumn(i + 1).width = c.width; });
    encabezadoHoja(wsRes, colsDia.length, `Resumen de ventas · ${periodo}`, `${generado} · ${ventas.length} ventas`);

    // Por día: ventas del día (vendido / pendiente) + dinero cobrado ese día.
    // Cobrado = ventas de contado + abonos (mismo criterio que "Ingresos" del Dashboard).
    const piezasPorFolio = new Map<string, number>();
    for (const d of detalles) piezasPorFolio.set(d.folio, (piezasPorFolio.get(d.folio) ?? 0) + d.cantidad);

    const dias = new Map<string, { ventas: number; piezas: number; vendido: number; cobrado: number; pendiente: number }>();
    const dia = (f: string) => {
      if (!dias.has(f)) dias.set(f, { ventas: 0, piezas: 0, vendido: 0, cobrado: 0, pendiente: 0 });
      return dias.get(f)!;
    };
    const porMetodo = new Map<string, number>();
    const cobro = (fecha: string, metodo: string | null, monto: number) => {
      dia(fecha.slice(0, 10)).cobrado += monto;
      const m = metodo ?? 'sin especificar';
      porMetodo.set(m, (porMetodo.get(m) ?? 0) + monto);
    };
    for (const v of ventas) {
      const d = dia(v.fecha.slice(0, 10));
      d.ventas    += 1;
      d.piezas    += piezasPorFolio.get(v.folio) ?? 0;
      d.vendido   += v.total;
      d.pendiente += v.saldo_pendiente;
      if (v.tipo_venta === 'contado') cobro(v.fecha, v.metodo_pago, v.total);
    }
    for (const a of abonos) cobro(a.fecha, a.metodo_pago, a.monto);

    let fila = 4;
    tituloSeccion(wsRes, fila, colsDia.length, 'Por día');
    fila = escribirTabla(wsRes, {
      filaInicio: fila + 1,
      columnas:   colsDia,
      filas: [...dias].sort(([a], [b]) => a.localeCompare(b))
        .map(([f, d]) => [aFecha(f), d.ventas, d.piezas, d.vendido, d.cobrado, d.pendiente]),
      totalLabel: 'TOTAL DEL PERIODO',
    });

    fila += 1;
    tituloSeccion(wsRes, fila, colsDia.length, 'Cobrado por método de pago');
    fila = escribirTabla(wsRes, {
      filaInicio: fila + 1,
      columnas: [
        { label: 'Método de pago', width: 16 },
        { label: 'Monto cobrado',  width: 16, fmt: 'money', sumar: true, positivo: true },
      ],
      filas: [...porMetodo].sort(([, a], [, b]) => b - a).map(([m, monto]) => [METODOS[m] ?? m, monto]),
      totalLabel: 'TOTAL',
    });

    const nota = wsRes.getCell(fila + 1, 1);
    nota.value = '"Vendido" = valor de las ventas hechas en el periodo. "Cobrado" = dinero recibido en el periodo '
      + '(ventas de contado + abonos), igual que "Ingresos" en el Dashboard.';
    nota.font  = { name: 'Arial', size: 8.5, italic: true, color: { argb: 'FF71717A' } };
    wsRes.mergeCells(fila + 1, 1, fila + 1, colsDia.length);
    nota.alignment = { wrapText: true, vertical: 'top' };
    wsRes.getRow(fila + 1).height = 28;
  }

  // ─── Hoja: Ventas ─────────────────────────────────────────────────────────
  if (hojas.includes('ventas')) {
    hojaTabla(wb, {
      nombre: 'Ventas',
      titulo: `Ventas · ${periodo}`,
      subtitulo: `${generado} · ${ventas.length} ventas`,
      columnas: [
        { label: 'Folio',           width: 18 },
        { label: 'Fecha',           width: 17, fmt: 'datetime' },
        { label: 'Cliente',         width: 26 },
        { label: 'Vendedor',        width: 20 },
        { label: 'Tipo',            width: 11 },
        { label: 'Método de pago',  width: 16 },
        { label: 'Subtotal',        width: 14, fmt: 'money', sumar: true },
        { label: 'Descuento',       width: 13, fmt: 'money', sumar: true },
        { label: 'Total',           width: 15, fmt: 'money', sumar: true, positivo: true },
        { label: 'Saldo pendiente', width: 16, fmt: 'money', sumar: true, pendiente: true },
      ],
      filas: ventas.map(v => [
        v.folio,
        aFechaHora(v.fecha),
        v.cliente_nombre ?? 'Público general',
        v.usuario_nombre,
        v.tipo_venta === 'credito' ? 'Crédito' : 'Contado',
        v.metodo_pago ? (METODOS[v.metodo_pago] ?? v.metodo_pago) : (v.tipo_venta === 'credito' ? 'Abonos' : '—'),
        v.subtotal,
        v.descuento,
        v.total,
        v.saldo_pendiente,
      ]),
      totalLabel: `TOTAL  (${ventas.length} ventas)`,
      dataBarCol: 9,
    });
  }

  // ─── Hoja: Detalle ────────────────────────────────────────────────────────
  if (hojas.includes('detalle')) {
    hojaTabla(wb, {
      nombre: 'Detalle',
      titulo: `Detalle de productos vendidos · ${periodo}`,
      subtitulo: `${generado} · ${detalles.length} renglones · Importe antes del descuento adicional de la venta`,
      columnas: [
        { label: 'Folio',           width: 18 },
        { label: 'Fecha',           width: 17, fmt: 'datetime' },
        { label: 'Producto',        width: 32 },
        { label: 'SKU',             width: 16 },
        { label: 'Categoría',       width: 18 },
        { label: 'Cantidad',        width: 11, fmt: 'num',   sumar: true },
        { label: 'Precio unitario', width: 15, fmt: 'money' },
        { label: 'Descuento',       width: 13, fmt: 'money', sumar: true },
        { label: 'Importe',         width: 15, fmt: 'money', sumar: true, positivo: true },
      ],
      filas: detalles.map(d => [
        d.folio,
        aFechaHora(d.fecha),
        d.producto_nombre,
        d.producto_sku,
        d.categoria_nombre ?? '—',
        d.cantidad,
        d.precio_unitario,
        d.descuento,
        d.importe,
      ]),
      totalLabel: `TOTAL  (${detalles.length} renglones)`,
    });
  }

  // ─── Hoja: Por producto (ranking por importe) ─────────────────────────────
  if (hojas.includes('productos')) {
    const porProducto = new Map<number, {
      nombre: string; sku: string; categoria: string | null; marca: string | null;
      folios: Set<string>; piezas: number; importe: number;
    }>();
    for (const d of detalles) {
      let p = porProducto.get(d.producto_id);
      if (!p) {
        p = { nombre: d.producto_nombre, sku: d.producto_sku, categoria: d.categoria_nombre, marca: d.marca_nombre,
              folios: new Set(), piezas: 0, importe: 0 };
        porProducto.set(d.producto_id, p);
      }
      p.folios.add(d.folio);
      p.piezas  += d.cantidad;
      p.importe += d.importe;
    }
    const ranking = [...porProducto.values()].sort((a, b) => b.importe - a.importe || b.piezas - a.piezas);

    hojaTabla(wb, {
      nombre: 'Por producto',
      titulo: `Productos más vendidos · ${periodo}`,
      subtitulo: `${generado} · ${ranking.length} productos · Importe antes del descuento adicional de la venta`,
      columnas: [
        { label: '#',          width: 6,  fmt: 'num' },
        { label: 'Producto',   width: 32 },
        { label: 'SKU',        width: 16 },
        { label: 'Categoría',  width: 18 },
        { label: 'Marca',      width: 18 },
        { label: 'N° ventas',  width: 12, fmt: 'num',   sumar: true },
        { label: 'Piezas',     width: 11, fmt: 'num',   sumar: true },
        { label: 'Importe',    width: 16, fmt: 'money', sumar: true, positivo: true },
      ],
      filas: ranking.map((p, i) => [
        i + 1, p.nombre, p.sku, p.categoria ?? '—', p.marca ?? '—', p.folios.size, p.piezas, p.importe,
      ]),
      totalLabel: `TOTAL  (${ranking.length} productos)`,
      dataBarCol: 8,
    });
  }

  // ─── Hoja: Abonos recibidos ───────────────────────────────────────────────
  if (hojas.includes('abonos')) {
    hojaTabla(wb, {
      nombre: 'Abonos',
      titulo: `Abonos recibidos · ${periodo}`,
      subtitulo: `${generado} · ${abonos.length} abonos`,
      columnas: [
        { label: 'Fecha del abono', width: 17, fmt: 'datetime' },
        { label: 'Folio',           width: 18 },
        { label: 'Fecha de venta',  width: 17, fmt: 'datetime' },
        { label: 'Cliente',         width: 26 },
        { label: 'Método de pago',  width: 16 },
        { label: 'Cobrado por',     width: 20 },
        { label: 'Monto',           width: 15, fmt: 'money', sumar: true, positivo: true },
      ],
      filas: abonos.map(a => [
        aFechaHora(a.fecha),
        a.folio,
        aFechaHora(a.fecha_venta),
        a.cliente_nombre ?? '—',
        METODOS[a.metodo_pago] ?? a.metodo_pago,
        a.usuario_nombre,
        a.monto,
      ]),
      totalLabel: `TOTAL  (${abonos.length} abonos)`,
    });
  }

  // ─── Generar buffer y responder ───────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ventas-${desde}_${hasta}.xlsx"`,
    },
  });
}
