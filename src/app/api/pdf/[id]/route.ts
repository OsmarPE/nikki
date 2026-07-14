import { NextRequest, NextResponse } from 'next/server';
import { getVentaDetalle } from '@/actions/ventas';
import { getSession } from '@/lib/auth';
import { PDFDocument, rgb, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── Helpers de color ─────────────────────────────────────────────────────────
const C = {
  black:    rgb(0.07, 0.07, 0.07),   // ~zinc-900
  gray:     rgb(0.45, 0.45, 0.47),   // ~zinc-500
  grayLight:rgb(0.78, 0.78, 0.80),   // ~zinc-300
  rule:     rgb(0.88, 0.88, 0.90),   // ~zinc-200
  white:    rgb(1, 1, 1),
};

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

const METODO: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return new NextResponse('No autorizado', { status: 401 });

  const { id } = await params;
  const ventaId = parseInt(id);
  if (isNaN(ventaId)) return new NextResponse('ID inválido', { status: 400 });

  const venta = await getVentaDetalle(ventaId);
  if (!venta) return new NextResponse('Venta no encontrada', { status: 404 });

  if (session.rol !== 'admin' && String(venta.usuario_id) !== session.sub) {
    return new NextResponse('Sin permiso', { status: 403 });
  }

  // ─── Documento ───────────────────────────────────────────────────────────────
  // Tamaño A4 puntos: 595 × 842
  const W = 595, H = 842;
  const MARGIN = 56;        // margen izq/der
  const RIGHT  = W - MARGIN;

  const doc  = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([W, H]);

  // ─── Fuentes ─────────────────────────────────────────────────────────────────
  const fontsDir = join(process.cwd(), 'src', 'app', 'api', 'pdf', '[id]', 'fonts');
  const [regularBytes, semiBoldBytes, boldBytes] = [
    readFileSync(join(fontsDir, 'Outfit-Regular.ttf')),
    readFileSync(join(fontsDir, 'Outfit-SemiBold.ttf')),
    readFileSync(join(fontsDir, 'Outfit-Bold.ttf')),
  ];

  const fontReg  = await doc.embedFont(regularBytes);
  const fontSemi = await doc.embedFont(semiBoldBytes);
  const fontBold = await doc.embedFont(boldBytes);

  // ─── Primitivos ───────────────────────────────────────────────────────────────
  function t(
    text: string,
    x: number,
    y: number,
    { size = 10, color = C.black, font = fontReg, align = 'left' as 'left' | 'right' | 'center' } = {}
  ) {
    const w = font.widthOfTextAtSize(text, size);
    let dx = x;
    if (align === 'right')  dx = x - w;
    if (align === 'center') dx = x - w / 2;
    page.drawText(text, { x: dx, y, size, font, color });
  }

  function rule(y: number, x1 = MARGIN, x2 = RIGHT, thickness = 0.5, color = C.rule) {
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }

  // ─── Layout ───────────────────────────────────────────────────────────────────
  let y = H - 70;

  // ── Header ──────────────────────────────────────────────────────────────────
  // "Comprobante de venta" grande
  t('Comprobante de venta', MARGIN, y, { size: 22, font: fontBold });

  // Logo / nombre negocio — círculo negro + inicial
  const logoX = RIGHT - 18, logoY = y + 4;
  page.drawCircle({ x: logoX, y: logoY, size: 18, color: C.black });
  t('N', logoX, logoY - 7, { size: 13, font: fontBold, color: C.white, align: 'center' });

  y -= 22;
  t('Nikki', MARGIN, y, { size: 11, color: C.gray, font: fontReg });

  y -= 40;

  // ── Bloque de metadatos: izquierda (emisor) | derecha (destinatario) ─────────
  const col2 = W / 2 + 30;
  const labelW = 58;
  const rowH   = 16;

  // Columna izquierda — vendedor / sistema
  const leftRows: [string, string][] = [
    ['Vendedor:', venta.usuario_nombre ?? '—'],
    ['Folio:', venta.folio],
    ['Método:', METODO[venta.metodo_pago] ?? venta.metodo_pago],
  ];
  leftRows.forEach(([label, value]) => {
    t(label, MARGIN, y, { size: 9, color: C.gray, font: fontSemi });
    t(value, MARGIN + labelW, y, { size: 9 });
    y -= rowH;
  });

  // Reset y para columna derecha — mismo punto de partida
  y += rowH * leftRows.length;

  // Columna derecha — cliente / fechas
  const rightRows: [string, string][] = [
    ['Factura a:',  venta.cliente_nombre ?? 'Público general'],
    ['Fecha:',      fmtDate(venta.creado_at)],
    ['ID venta:',   String(venta.id).padStart(3, '0')],
  ];
  rightRows.forEach(([label, value]) => {
    t(label,  col2,            y, { size: 9, color: C.gray, font: fontSemi, align: 'right' });
    t(value, RIGHT,            y, { size: 9, align: 'right' });
    y -= rowH;
  });

  y -= 28;
  rule(y);
  y -= 30;

  // ── Sección de productos ──────────────────────────────────────────────────────
  t('Descripción de servicios / productos', MARGIN, y, { size: 13, font: fontBold });
  y -= 26;

  // Cabecera de tabla
  const COL = {
    desc:   MARGIN,
    qty:    MARGIN + 240,
    unit:   MARGIN + 330,
    total:  RIGHT,
  };

  t('Descripción', COL.desc,  y, { size: 9, color: C.gray });
  t('Cantidad',    COL.qty,   y, { size: 9, color: C.gray, align: 'center' });
  t('Precio unit.', COL.unit, y, { size: 9, color: C.gray, align: 'center' });
  t('Total',       COL.total, y, { size: 9, color: C.gray, align: 'right' });
  y -= 10;
  rule(y, MARGIN, RIGHT, 0.3, C.grayLight);
  y -= 18;

  // Filas de productos
  const detalles = venta.detalles ?? [];
  let descuentoTotal = 0;

  detalles.forEach(d => {
    const nombre = (d.producto_nombre ?? '—').substring(0, 40);
    const sku    = d.producto_sku ?? '';

    t(nombre, COL.desc, y, { size: 9 });
    if (sku) t(sku, COL.desc, y - 13, { size: 7.5, color: C.gray });

    t(String(d.cantidad), COL.qty, y, { size: 9, align: 'center' });
    t(fmt(Number(d.precio_unitario)), COL.unit, y, { size: 9, align: 'center' });
    t(fmt(Number(d.subtotal)), COL.total, y, { size: 9, align: 'right' });

    descuentoTotal += Number(d.descuento_aplicado ?? 0);

    // Segunda línea si hay SKU
    y -= sku ? 28 : 22;
  });

  y -= 8;
  rule(y, MARGIN, RIGHT, 0.3, C.grayLight);
  y -= 20;

  // ── Totales (alineados a la derecha) ─────────────────────────────────────────
  const totalX  = RIGHT;
  const labelX  = RIGHT - 120;

  if (descuentoTotal > 0) {
    t('Subtotal:',  labelX, y, { size: 9, color: C.gray, align: 'right' });
    t(fmt(Number(venta.total) + descuentoTotal), totalX, y, { size: 9, align: 'right' });
    y -= 16;
    t('Descuento:', labelX, y, { size: 9, color: C.gray, align: 'right' });
    t(`−${fmt(descuentoTotal)}`, totalX, y, { size: 9, color: rgb(0.1, 0.5, 0.1), align: 'right' });
    y -= 20;
  }

  // Total destacado
  t('Total a pagar:', labelX, y, { size: 10, font: fontSemi, align: 'right' });
  y -= 22;
  t(fmt(Number(venta.total)), totalX, y, { size: 20, font: fontBold, align: 'right' });
  y -= 36;

  // ── Línea y pie ───────────────────────────────────────────────────────────────
  rule(y);
  y -= 26;

  // Nota de agradecimiento
  t('¡Gracias por tu compra!', MARGIN, y, { size: 9, color: C.gray });

  // Método de pago como badge gris
  const badgeLabel = `Pagado con ${METODO[venta.metodo_pago] ?? venta.metodo_pago}`;
  const badgeW     = fontReg.widthOfTextAtSize(badgeLabel, 8) + 16;
  page.drawRectangle({
    x: RIGHT - badgeW, y: y - 4,
    width: badgeW, height: 16,
    color: rgb(0.94, 0.94, 0.95),
    borderRadius: 4,
  });
  t(badgeLabel, RIGHT - badgeW / 2, y + 1, { size: 8, color: C.gray, align: 'center' });

  // ─── Bytes y respuesta ───────────────────────────────────────────────────────
  const bytes = await doc.save();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="comprobante-${venta.folio}.pdf"`,
    },
  });
}
