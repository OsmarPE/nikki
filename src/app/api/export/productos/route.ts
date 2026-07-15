import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProductos } from '@/actions/productos';
import ExcelJS from 'exceljs';

const COLOR_HEADER_BG   = 'FF18181B'; // zinc-900
const COLOR_HEADER_FONT = 'FFFAFAFA'; // zinc-50
const COLOR_ACCENT      = 'FF3F3F46'; // zinc-700
const COLOR_ALT_ROW     = 'FFF4F4F5'; // zinc-100
const COLOR_BORDER      = 'FFE4E4E7'; // zinc-200
const COLOR_POSITIVE    = 'FF16A34A'; // green-600
const COLOR_DANGER      = 'FFDC2626'; // red-600

export async function GET() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') {
    return new NextResponse('No autorizado', { status: 401 });
  }

  const productos = await getProductos();

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Sistema POS';
  wb.created  = new Date();
  wb.modified = new Date();

  // ─── Hoja 1: Catálogo de productos ───────────────────────────────────────
  const ws = wb.addWorksheet('Productos', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  // Título
  ws.mergeCells('A1:K1');
  const title = ws.getCell('A1');
  title.value = 'Catálogo de Productos';
  title.font  = { name: 'Arial', size: 13, bold: true, color: { argb: COLOR_HEADER_FONT } };
  title.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 28;

  // Subtítulo
  ws.mergeCells('A2:K2');
  const sub = ws.getCell('A2');
  sub.value = `Generado el ${new Date().toLocaleDateString('es-MX', { dateStyle: 'full' })} · ${productos.length} productos`;
  sub.font  = { name: 'Arial', size: 9, color: { argb: '71717A' } };
  sub.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFF0' } };
  sub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 18;

  // Columnas
  const headers = [
    { key: 'sku',          label: 'SKU',              width: 16 },
    { key: 'nombre',       label: 'Nombre',            width: 32 },
    { key: 'categoria',    label: 'Categoría',         width: 16 },
    { key: 'marca',        label: 'Marca',             width: 16 },
    { key: 'coleccion',    label: 'Colección',         width: 16 },
    { key: 'precio',       label: 'Precio base',       width: 14 },
    { key: 'descuento',    label: 'Precio especial',   width: 14 },
    { key: 'stock',        label: 'Stock actual',      width: 13 },
    { key: 'estado_stock', label: 'Estado stock',      width: 14 },
    { key: 'descripcion',  label: 'Descripción',       width: 36 },
  ];

  const headerRow = ws.getRow(3);
  headerRow.height = 22;
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = h.width;
    const cell = headerRow.getCell(i + 1);
    cell.value     = h.label;
    cell.font      = { name: 'Arial', size: 9, bold: true, color: { argb: COLOR_HEADER_FONT } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ACCENT } };
    cell.alignment = { vertical: 'middle', horizontal: i >= 5 ? 'center' : 'left', indent: i < 5 ? 1 : 0 };
    cell.border    = {
      bottom: { style: 'thin', color: { argb: COLOR_HEADER_BG } },
      right:  { style: 'thin', color: { argb: COLOR_HEADER_BG } },
    };
  });

  // Datos
  const moneyFmt = '"$"#,##0.00';

  productos.forEach((p, idx) => {
    const stock        = Number(p.stock ?? 0);
    const isAlt        = idx % 2 === 1;
    const bgColor      = isAlt ? COLOR_ALT_ROW : 'FFFFFFFF';
    const rowNum       = idx + 4;

    // Estado del stock
    const estadoStock  = stock <= 0 ? 'Agotado' : 'Ok';
    const estadoColor  = stock <= 0 ? COLOR_DANGER : COLOR_POSITIVE;

    const rowData = [
      p.sku,
      p.nombre,
      p.categoria_nombre ?? '—',
      p.marca_nombre     ?? '—',
      p.coleccion_nombre ?? '—',
      Number(p.precio),
      p.precio_descuento ? Number(p.precio_descuento) : null,
      stock,
      estadoStock,
      p.descripcion ?? '',
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

      if (ci === 0) {
        // SKU monospace
        cell.font      = { name: 'Courier New', size: 8, color: { argb: '3F3F46' } };
        cell.alignment = { horizontal: 'left', indent: 1 };
      } else if (ci === 1) {
        cell.font      = { name: 'Arial', size: 9, bold: true };
        cell.alignment = { horizontal: 'left', indent: 1 };
      } else if (ci === 5) {
        // Precio base
        cell.numFmt    = moneyFmt;
        cell.alignment = { horizontal: 'right' };
      } else if (ci === 6) {
        // Precio especial
        cell.numFmt    = moneyFmt;
        cell.alignment = { horizontal: 'right' };
        if (val !== null) cell.font = { name: 'Arial', size: 9, color: { argb: COLOR_POSITIVE } };
      } else if (ci === 7) {
        // Stock
        cell.numFmt    = '#,##0';
        cell.alignment = { horizontal: 'center' };
        if (stock <= 0) cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLOR_DANGER } };
      } else if (ci === 8) {
        // Estado stock
        cell.alignment = { horizontal: 'center' };
        cell.font      = { name: 'Arial', size: 8, bold: true, color: { argb: estadoColor } };
      } else {
        cell.alignment = { horizontal: 'left', indent: ci < 5 ? 1 : 0 };
      }
    });

    ws.getRow(rowNum).height = 17;
  });

  // Fila de totales
  const totalRowNum = productos.length + 4;
  ws.getRow(totalRowNum).height = 20;

  for (let col = 1; col <= 10; col++) {
    const cell = ws.getCell(totalRowNum, col);
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
    cell.font  = { name: 'Arial', size: 9, bold: true, color: { argb: COLOR_HEADER_FONT } };
    cell.border = { top: { style: 'thin', color: { argb: COLOR_ACCENT } } };
  }
  const tc1 = ws.getCell(totalRowNum, 1);
  tc1.value     = `TOTAL  (${productos.length} productos)`;
  tc1.alignment = { horizontal: 'left', indent: 1, vertical: 'middle' };

  const tc8 = ws.getCell(totalRowNum, 8);
  tc8.value     = { formula: `SUM(H4:H${totalRowNum - 1})` };
  tc8.numFmt    = '#,##0';
  tc8.alignment = { horizontal: 'center', vertical: 'middle' };

  // ─── Hoja 2: Resumen por categoría ─────────────────────────────────────────
  const ws2 = wb.addWorksheet('Por categoría', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  ws2.mergeCells('A1:F1');
  const ws2t = ws2.getCell('A1');
  ws2t.value = 'Resumen por categoría';
  ws2t.font  = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR_HEADER_FONT } };
  ws2t.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
  ws2.getRow(1).height = 24;

  const ws2Headers = ['Categoría', 'Productos', 'Stock total', 'Precio prom.', 'Agotados'];
  const ws2Widths  = [24, 12, 13, 14, 11];
  const ws2Row2    = ws2.getRow(2);
  ws2Row2.height   = 20;
  ws2Headers.forEach((h, i) => {
    ws2.getColumn(i + 1).width = ws2Widths[i];
    const cell     = ws2Row2.getCell(i + 1);
    cell.value     = h;
    cell.font      = { name: 'Arial', size: 9, bold: true, color: { argb: COLOR_HEADER_FONT } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ACCENT } };
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0, vertical: 'middle' };
  });

  // Agrupar por categoría
  const catMap = new Map<string, typeof productos>();
  for (const p of productos) {
    const cat = p.categoria_nombre ?? 'Sin categoría';
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push(p);
  }

  let ri = 0;
  catMap.forEach((prods, cat) => {
    const isAlt      = ri % 2 === 1;
    const stockTotal = prods.reduce((s, p) => s + Number(p.stock ?? 0), 0);
    const precioProm = prods.reduce((s, p) => s + Number(p.precio), 0) / prods.length;
    const agotados   = prods.filter(p => Number(p.stock ?? 0) <= 0).length;

    const row = ws2.addRow([cat, prods.length, stockTotal, precioProm, agotados]);
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? COLOR_ALT_ROW : 'FFFFFFFF' } };
      cell.font  = { name: 'Arial', size: 9 };
      cell.alignment = { horizontal: col === 1 ? 'left' : 'center', indent: col === 1 ? 1 : 0 };
      if (col === 4) { cell.numFmt = '"$"#,##0.00'; cell.alignment = { horizontal: 'right' }; }
      if (col === 5 && agotados > 0) cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: COLOR_DANGER } };
    });
    ri++;
  });

  // Generar
  const buffer = await wb.xlsx.writeBuffer();
  const fecha  = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="productos-${fecha}.xlsx"`,
    },
  });
}
