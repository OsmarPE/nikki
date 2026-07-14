import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClientesParaExport } from '@/actions/clientes';
import ExcelJS from 'exceljs';

// Colores corporativos — tema Notion
const COLOR_HEADER_BG   = 'FF18181B'; // zinc-900
const COLOR_HEADER_FONT = 'FFFAFAFA'; // zinc-50
const COLOR_ACCENT      = 'FF3F3F46'; // zinc-700
const COLOR_ALT_ROW     = 'FFF4F4F5'; // zinc-100
const COLOR_POSITIVE    = 'FF16A34A'; // green-600
const COLOR_BORDER      = 'FFE4E4E7'; // zinc-200

export async function GET() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') {
    return new NextResponse('No autorizado', { status: 401 });
  }

  const clientes = await getClientesParaExport();

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Sistema POS';
  wb.created  = new Date();
  wb.modified = new Date();

  // ─── Hoja 1: Resumen de clientes ─────────────────────────────────────────
  const ws = wb.addWorksheet('Clientes', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  // Título principal
  ws.mergeCells('A1:K1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Reporte de Clientes — Historial de Compras';
  titleCell.font  = { name: 'Arial', size: 13, bold: true, color: { argb: COLOR_HEADER_FONT } };
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 28;

  // Subtítulo con fecha de generación
  ws.mergeCells('A2:K2');
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = `Generado el ${new Date().toLocaleDateString('es-MX', { dateStyle: 'full' })} · ${clientes.length} clientes`;
  subtitleCell.font  = { name: 'Arial', size: 9, color: { argb: 'FF71717A' } };
  subtitleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFF0' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 18;

  // Cabecera de columnas
  const headers = [
    { key: 'nombre',         label: 'Cliente',             width: 28 },
    { key: 'telefono',       label: 'Teléfono',            width: 16 },
    { key: 'email',          label: 'Correo electrónico',  width: 28 },
    { key: 'creado_at',      label: 'Registrado',          width: 14 },
    { key: 'total_ventas',   label: 'N° Compras',          width: 11 },
    { key: 'primera_compra', label: 'Primera compra',      width: 14 },
    { key: 'ultima_compra',  label: 'Última compra',       width: 14 },
    { key: 'monto_total',    label: 'Total comprado',      width: 15 },
    { key: 'ticket_prom',    label: 'Ticket promedio',     width: 15 },
    { key: 'metodos_usados', label: 'Métodos de pago',     width: 22 },
    { key: 'segmento',       label: 'Segmento',            width: 13 },
  ];

  const headerRow = ws.getRow(3);
  headerRow.height = 22;

  headers.forEach((h, i) => {
    const col = i + 1;
    ws.getColumn(col).width = h.width;

    const cell = headerRow.getCell(col);
    cell.value     = h.label;
    cell.font      = { name: 'Arial', size: 9, bold: true, color: { argb: COLOR_HEADER_FONT } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ACCENT } };
    cell.alignment = { vertical: 'middle', horizontal: i >= 4 ? 'center' : 'left', indent: i < 4 ? 1 : 0 };
    cell.border    = {
      bottom: { style: 'thin', color: { argb: COLOR_HEADER_BG } },
      right:  { style: 'thin', color: { argb: COLOR_HEADER_BG } },
    };
  });

  // ─── Datos ────────────────────────────────────────────────────────────────
  const moneyFmt  = '"$"#,##0.00';
  const dateFmt   = 'dd/mm/yyyy';
  const numFmt    = '#,##0';

  clientes.forEach((c, idx) => {
    const row     = ws.addRow([]);
    const rowNum  = idx + 4;
    const isAlt   = idx % 2 === 1;
    const bgColor = isAlt ? COLOR_ALT_ROW : 'FFFFFFFF';
    const monto   = Number(c.monto_total ?? 0);
    const nVentas = Number(c.total_ventas ?? 0);
    const ticket  = nVentas > 0 ? monto / nVentas : 0;

    // Segmento por monto
    const segmento = monto >= 5000 ? 'VIP' : monto >= 1000 ? 'Frecuente' : monto > 0 ? 'Ocasional' : 'Sin compras';
    const segColor  = monto >= 5000 ? 'FFCA8A04' : monto >= 1000 ? 'FF2563EB' : monto > 0 ? 'FF16A34A' : 'FF71717A';

    const rowData = [
      c.nombre,
      c.telefono ?? '—',
      c.email    ?? '—',
      c.creado_at ? new Date(c.creado_at) : null,
      nVentas,
      c.primera_compra ? new Date(c.primera_compra) : null,
      c.ultima_compra  ? new Date(c.ultima_compra)  : null,
      monto,
      ticket,
      c.metodos_usados ?? '—',
      segmento,
    ];

    rowData.forEach((val, ci) => {
      const cell = ws.getCell(rowNum, ci + 1);
      cell.value = val;
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.font  = { name: 'Arial', size: 9 };
      cell.border = {
        bottom: { style: 'hair', color: { argb: COLOR_BORDER } },
        right:  { style: 'hair', color: { argb: COLOR_BORDER } },
      };

      // Formatos especiales
      if (ci === 3 || ci === 5 || ci === 6) {
        cell.numFmt    = dateFmt;
        cell.alignment = { horizontal: 'center' };
      } else if (ci === 4) {
        cell.numFmt    = numFmt;
        cell.alignment = { horizontal: 'center' };
        if (nVentas > 0) cell.font = { name: 'Arial', size: 9, bold: true };
      } else if (ci === 7 || ci === 8) {
        cell.numFmt    = moneyFmt;
        cell.alignment = { horizontal: 'right' };
        if (ci === 7 && monto > 0) cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLOR_POSITIVE } };
      } else if (ci === 9) {
        cell.alignment = { horizontal: 'center' };
        cell.font      = { name: 'Arial', size: 8, color: { argb: '5571717A' } };
      } else if (ci === 10) {
        cell.alignment = { horizontal: 'center' };
        cell.font      = { name: 'Arial', size: 8, bold: true, color: { argb: segColor } };
      } else {
        cell.alignment = { horizontal: 'left', indent: 1 };
      }
    });

    ws.getRow(rowNum).height = 17;
  });

  // ─── Fila de totales ──────────────────────────────────────────────────────
  const totalRow    = ws.addRow([]);
  const totalRowNum = clientes.length + 4;
  ws.getRow(totalRowNum).height = 20;

  const totalCells = [
    { col: 1, value: `TOTAL  (${clientes.length} clientes)`, align: 'left' as const },
    { col: 5, value: `=SUM(E4:E${totalRowNum - 1})`, fmt: numFmt,   align: 'center' as const },
    { col: 8, value: `=SUM(H4:H${totalRowNum - 1})`, fmt: moneyFmt, align: 'right' as const },
    { col: 9, value: `=IF(E${totalRowNum}>0,H${totalRowNum}/E${totalRowNum},0)`, fmt: moneyFmt, align: 'right' as const },
  ];

  for (let col = 1; col <= 11; col++) {
    const cell   = ws.getCell(totalRowNum, col);
    const config = totalCells.find(t => t.col === col);
    cell.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
    cell.font    = { name: 'Arial', size: 9, bold: true, color: { argb: COLOR_HEADER_FONT } };
    cell.border  = { top: { style: 'thin', color: { argb: COLOR_ACCENT } } };

    if (config) {
      cell.value     = config.value.toString().startsWith('=') ? { formula: config.value.slice(1) } : config.value;
      if (config.fmt) cell.numFmt = config.fmt;
      cell.alignment = { horizontal: config.align, indent: config.align === 'left' ? 1 : 0, vertical: 'middle' };
    }
  }

  // ─── Hoja 2: Detalle de ventas por cliente ───────────────────────────────
  const ws2 = wb.addWorksheet('Ventas por cliente', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  // Importar aquí para no hacer queries duplicadas — usamos los datos ya tenidos
  // Solo mostramos resumen por cliente (la hoja 1 ya tiene el detalle)
  const ws2Title = ws2.getRow(1);
  ws2.mergeCells('A1:F1');
  ws2.getCell('A1').value = 'Detalle de compras por segmento';
  ws2.getCell('A1').font  = { name: 'Arial', size: 11, bold: true };
  ws2.getCell('A1').fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  ws2.getCell('A1').font  = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR_HEADER_FONT } };
  ws2.getRow(1).height    = 24;

  const ws2Headers = ['Segmento', 'N° Clientes', 'Total compras', 'Monto total', '% del total', 'Ticket prom.'];
  const ws2Row2    = ws2.getRow(2);
  ws2Row2.height   = 20;
  [30, 14, 14, 16, 12, 14].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

  ws2Headers.forEach((h, i) => {
    const cell     = ws2Row2.getCell(i + 1);
    cell.value     = h;
    cell.font      = { name: 'Arial', size: 9, bold: true, color: { argb: COLOR_HEADER_FONT } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ACCENT } };
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0, vertical: 'middle' };
  });

  const segmentos = [
    { nombre: '⭐ VIP (≥ $5,000)',         filter: (c: typeof clientes[0]) => Number(c.monto_total) >= 5000 },
    { nombre: '🔵 Frecuente ($1,000–$4,999)', filter: (c: typeof clientes[0]) => Number(c.monto_total) >= 1000 && Number(c.monto_total) < 5000 },
    { nombre: '🟢 Ocasional ($1–$999)',    filter: (c: typeof clientes[0]) => Number(c.monto_total) > 0 && Number(c.monto_total) < 1000 },
    { nombre: '⚪ Sin compras',             filter: (c: typeof clientes[0]) => Number(c.monto_total) === 0 },
  ];

  const montoTotalGlobal = clientes.reduce((s, c) => s + Number(c.monto_total ?? 0), 0);

  segmentos.forEach((seg, si) => {
    const grupo  = clientes.filter(seg.filter);
    const monto  = grupo.reduce((s, c) => s + Number(c.monto_total ?? 0), 0);
    const compras= grupo.reduce((s, c) => s + Number(c.total_ventas ?? 0), 0);
    const ticket = compras > 0 ? monto / compras : 0;
    const pct    = montoTotalGlobal > 0 ? monto / montoTotalGlobal : 0;

    const row    = ws2.addRow([seg.nombre, grupo.length, compras, monto, pct, ticket]);
    const isAlt  = si % 2 === 1;
    row.height   = 18;

    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? COLOR_ALT_ROW : 'FFFFFFFF' } };
      cell.font  = { name: 'Arial', size: 9 };
      cell.alignment = { horizontal: col === 1 ? 'left' : 'center', indent: col === 1 ? 1 : 0 };
      if (col === 4 || col === 6) { cell.numFmt = moneyFmt; cell.alignment = { horizontal: 'right' }; }
      if (col === 5) { cell.numFmt = '0.0%'; }
    });
  });

  // ─── Generar buffer y responder ───────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const fecha  = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer as Buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="clientes-${fecha}.xlsx"`,
    },
  });
}
