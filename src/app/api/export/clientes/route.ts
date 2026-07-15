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

  // ─── Hoja: Clientes ───────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Clientes', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  const headers = [
    { key: 'nombre',       label: 'Cliente',            width: 30 },
    { key: 'telefono',     label: 'Teléfono',           width: 16 },
    { key: 'email',        label: 'Correo electrónico', width: 30 },
    { key: 'creado_at',    label: 'Registrado',         width: 14 },
    { key: 'total_ventas', label: 'N° Compras',         width: 13 },
    { key: 'monto_total',  label: 'Total comprado',     width: 17 },
  ];
  const lastCol = headers.length;
  const lastColLetter = ws.getColumn(lastCol).letter;

  // Título principal
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Reporte de Clientes';
  titleCell.font  = { name: 'Arial', size: 14, bold: true, color: { argb: COLOR_HEADER_FONT } };
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  // Subtítulo con fecha de generación
  ws.mergeCells(2, 1, 2, lastCol);
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = `Generado el ${new Date().toLocaleDateString('es-MX', { dateStyle: 'full' })} · ${clientes.length} clientes`;
  subtitleCell.font  = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF71717A' } };
  subtitleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFF0' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;

  // Cabecera de columnas
  const headerRow = ws.getRow(3);
  headerRow.height = 24;

  headers.forEach((h, i) => {
    const col = i + 1;
    ws.getColumn(col).width = h.width;

    const cell = headerRow.getCell(col);
    cell.value     = h.label;
    cell.font      = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLOR_HEADER_FONT } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ACCENT } };
    cell.alignment = { vertical: 'middle', horizontal: col >= 5 ? 'center' : 'left', indent: col < 5 ? 1 : 0 };
    cell.border    = {
      bottom: { style: 'thin', color: { argb: COLOR_HEADER_BG } },
      right:  { style: 'thin', color: { argb: COLOR_HEADER_BG } },
    };
  });

  ws.autoFilter = { from: 'A3', to: `${lastColLetter}3` };

  // ─── Datos ────────────────────────────────────────────────────────────────
  const moneyFmt = '"$"#,##0.00';
  const dateFmt  = 'dd/mm/yyyy';
  const numFmt   = '#,##0';

  clientes.forEach((c, idx) => {
    const rowNum  = idx + 4;
    const isAlt   = idx % 2 === 1;
    const bgColor = isAlt ? COLOR_ALT_ROW : 'FFFFFFFF';
    const monto   = Number(c.monto_total ?? 0);
    const nVentas = Number(c.total_ventas ?? 0);

    const rowData = [
      c.nombre,
      c.telefono ?? '—',
      c.email    ?? '—',
      c.creado_at ? new Date(c.creado_at) : null,
      nVentas,
      monto,
    ];

    rowData.forEach((val, ci) => {
      const col  = ci + 1;
      const cell = ws.getCell(rowNum, col);
      cell.value = val;
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.font  = { name: 'Arial', size: 9.5 };
      cell.border = {
        bottom: { style: 'hair', color: { argb: COLOR_BORDER } },
        right:  { style: 'hair', color: { argb: COLOR_BORDER } },
      };

      if (col === 4) {
        cell.numFmt    = dateFmt;
        cell.alignment = { horizontal: 'center' };
      } else if (col === 5) {
        cell.numFmt    = numFmt;
        cell.alignment = { horizontal: 'center' };
        if (nVentas > 0) cell.font = { name: 'Arial', size: 9.5, bold: true };
      } else if (col === 6) {
        cell.numFmt    = moneyFmt;
        cell.alignment = { horizontal: 'right' };
        if (monto > 0) cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLOR_POSITIVE } };
      } else {
        cell.alignment = { horizontal: 'left', indent: 1 };
      }
    });

    ws.getRow(rowNum).height = 18;
  });

  // Barras de datos sobre "Total comprado" para lectura rápida
  if (clientes.length > 0) {
    ws.addConditionalFormatting({
      ref: `F4:F${clientes.length + 3}`,
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

  // ─── Fila de totales ──────────────────────────────────────────────────────
  const totalRowNum = clientes.length + 4;
  const totalCells = [
    { col: 1, value: `TOTAL  (${clientes.length} clientes)`, align: 'left' as const },
    { col: 5, value: `=SUM(E4:E${totalRowNum - 1})`, fmt: numFmt,   align: 'center' as const },
    { col: 6, value: `=SUM(F4:F${totalRowNum - 1})`, fmt: moneyFmt, align: 'right' as const },
  ];

  ws.getRow(totalRowNum).height = 22;
  for (let col = 1; col <= lastCol; col++) {
    const cell   = ws.getCell(totalRowNum, col);
    const config = totalCells.find(t => t.col === col);
    cell.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
    cell.font    = { name: 'Arial', size: 9.5, bold: true, color: { argb: COLOR_HEADER_FONT } };
    cell.border  = { top: { style: 'medium', color: { argb: COLOR_ACCENT } } };

    if (config) {
      cell.value     = config.value.toString().startsWith('=') ? { formula: config.value.slice(1) } : config.value;
      if (config.fmt) cell.numFmt = config.fmt;
      cell.alignment = { horizontal: config.align, indent: config.align === 'left' ? 1 : 0, vertical: 'middle' };
    }
  }

  // Borde exterior alrededor de toda la tabla
  for (let col = 1; col <= lastCol; col++) {
    const top = ws.getCell(3, col);
    top.border = { ...top.border, top: { style: 'medium', color: { argb: COLOR_HEADER_BG } } };
    const bottom = ws.getCell(totalRowNum, col);
    bottom.border = { ...bottom.border, bottom: { style: 'medium', color: { argb: COLOR_HEADER_BG } } };
  }
  for (let row = 3; row <= totalRowNum; row++) {
    const left = ws.getCell(row, 1);
    left.border = { ...left.border, left: { style: 'medium', color: { argb: COLOR_HEADER_BG } } };
    const right = ws.getCell(row, lastCol);
    right.border = { ...right.border, right: { style: 'medium', color: { argb: COLOR_HEADER_BG } } };
  }

  // ─── Generar buffer y responder ───────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const fecha  = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer , {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="clientes-${fecha}.xlsx"`,
    },
  });
}
