'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { calcularCarrito } from '@/lib/promocion';
import { todayLocal, monthStartLocal } from '@/lib/utils';
import { tienePermiso } from '@/lib/permisos';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { Venta, Producto, Abono } from '@/types';
import { validarOpciones, type ExportVentasOpciones } from '@/lib/export-ventas';
import { randomBytes } from 'crypto';

// FIX: usa crypto.randomBytes en vez de Math.random para evitar colisiones de folio
function generarFolio(): string {
  // Usar zona local (México) para que el folio refleje el día correcto del vendedor
  const date = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
    .replace(/-/g, '');
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `VTA-${date}-${rand}`;
}

export async function procesarVenta(input: {
  lineas: { producto: Producto; cantidad: number }[];
  metodo_pago?: 'efectivo' | 'transferencia' | 'tarjeta';
  tipo_venta?: 'contado' | 'credito';
  cliente_id?: number | null;
  sesion_caja_id: number;
  productosConDescuento?: number[];
  descuentoGlobalPorcentaje?: number | null;
  abonoInicial?: { monto: number; metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta' } | null;
}) {
  const session = await getSession();
  if (!session) return { error: 'Sin sesión.' };

  const tipoVenta = input.tipo_venta ?? 'contado';
  if (tipoVenta === 'credito' && !input.cliente_id) {
    return { error: 'Una venta a crédito requiere seleccionar un cliente.' };
  }
  if (tipoVenta === 'contado' && !input.metodo_pago) {
    return { error: 'Selecciona un método de pago.' };
  }
  const pctGlobal = input.descuentoGlobalPorcentaje;
  if (pctGlobal != null && (!Number.isInteger(pctGlobal) || pctGlobal < 1 || pctGlobal > 100)) {
    return { error: 'El descuento adicional debe ser un número entero entre 1 y 100.' };
  }

  const { items, total, descuento_global_porcentaje, descuento_global_monto } = calcularCarrito(
    input.lineas,
    input.productosConDescuento ?? [],
    input.descuentoGlobalPorcentaje ?? null,
  );
  if (items.length === 0) return { error: 'El carrito está vacío.' };

  if (input.abonoInicial && input.abonoInicial.monto > total) {
    return { error: 'El abono inicial no puede ser mayor al total de la venta.' };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // FIX: validar que la sesión de caja pertenece al usuario que hace la venta
    const [cajaRows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM sesiones_caja WHERE id = ? AND usuario_id = ? AND estado = 'abierta'`,
      [input.sesion_caja_id, session.sub]
    );
    if (!cajaRows[0]) {
      await conn.rollback();
      return { error: 'Sesión de caja inválida.' };
    }

    // Validar stock con FOR UPDATE sobre la fila del producto para evitar race conditions
    for (const item of items) {
      const [sRows] = await conn.query<RowDataPacket[]>(
        `SELECT stock FROM productos WHERE id = ? FOR UPDATE`,
        [item.producto.id]
      );
      const stock = Number(sRows[0]?.stock ?? 0);
      if (stock < item.cantidad) {
        await conn.rollback();
        return { error: `Stock insuficiente para "${item.producto.nombre}". Disponible: ${stock}` };
      }
    }

    const folio = generarFolio();
    const metodoPago = tipoVenta === 'credito' ? null : (input.metodo_pago ?? null);

    // Insertar venta
    const [ventaResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO ventas (folio, cliente_id, usuario_id, sesion_caja_id, tipo_venta, total, descuento_porcentaje, descuento_monto, metodo_pago)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        folio, input.cliente_id ?? null, session.sub, input.sesion_caja_id, tipoVenta,
        total, descuento_global_porcentaje, descuento_global_monto, metodoPago,
      ]
    );
    const ventaId = ventaResult.insertId;

    // Insertar detalles y movimientos de inventario
    for (const item of items) {
      await conn.query(
        `INSERT INTO detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, descuento_aplicado, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ventaId, item.producto.id, item.cantidad, item.precio_unitario, item.descuento_aplicado, item.subtotal]
      );
      await conn.query(
        `INSERT INTO movimientos_inventario (producto_id, tipo, motivo, cantidad, usuario_id, referencia)
         VALUES (?, 'salida', 'venta', ?, ?, ?)`,
        [item.producto.id, item.cantidad, session.sub, folio]
      );
      await conn.query(
        `UPDATE productos SET stock = stock - ? WHERE id = ?`,
        [item.cantidad, item.producto.id]
      );
    }

    // Actualizar saldo esperado en sesión de caja (solo contado en efectivo:
    // una venta a crédito no mete a caja el total, solo lo que realmente se
    // cobre vía abonos).
    if (tipoVenta === 'contado' && metodoPago === 'efectivo') {
      await conn.query(
        `UPDATE sesiones_caja
         SET saldo_final_esperado = saldo_final_esperado + ?
         WHERE id = ?`,
        [total, input.sesion_caja_id]
      );
    }

    // Abono inicial opcional en una venta a crédito (no hay enganche mínimo,
    // pero el vendedor puede cobrar algo al momento de la venta).
    if (tipoVenta === 'credito' && input.abonoInicial && input.abonoInicial.monto > 0) {
      await conn.query(
        `INSERT INTO abonos (venta_id, monto, metodo_pago, usuario_id, sesion_caja_id)
         VALUES (?, ?, ?, ?, ?)`,
        [ventaId, input.abonoInicial.monto, input.abonoInicial.metodo_pago, session.sub, input.sesion_caja_id]
      );
      if (input.abonoInicial.metodo_pago === 'efectivo') {
        await conn.query(
          `UPDATE sesiones_caja SET saldo_final_esperado = saldo_final_esperado + ? WHERE id = ?`,
          [input.abonoInicial.monto, input.sesion_caja_id]
        );
      }
    }

    await conn.commit();
    revalidatePath('/ventas');
    revalidatePath('/dashboard');
    return { success: true, ventaId, folio };
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return { error: 'Error al procesar la venta.' };
  } finally {
    conn.release();
  }
}

export async function registrarAbono(input: {
  venta_id: number;
  monto: number;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta';
  sesion_caja_id: number;
}) {
  const session = await getSession();
  if (!session) return { error: 'Sin sesión.' };
  if (!tienePermiso(session, 'ventas', 'crear')) return { error: 'Sin permiso para registrar abonos.' };
  if (input.monto <= 0) return { error: 'El monto debe ser mayor a 0.' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [cajaRows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM sesiones_caja WHERE id = ? AND usuario_id = ? AND estado = 'abierta'`,
      [input.sesion_caja_id, session.sub]
    );
    if (!cajaRows[0]) {
      await conn.rollback();
      return { error: 'Sesión de caja inválida.' };
    }

    // Bloquea la fila de la venta para serializar abonos concurrentes sobre
    // la misma venta (evita que dos abonos simultáneos rebasen el saldo).
    const [ventaRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, tipo_venta, total FROM ventas WHERE id = ? FOR UPDATE`,
      [input.venta_id]
    );
    const venta = ventaRows[0];
    if (!venta || venta.tipo_venta !== 'credito') {
      await conn.rollback();
      return { error: 'La venta no existe o no es a crédito.' };
    }

    const [abonadoRows] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(monto), 0) AS abonado FROM abonos WHERE venta_id = ?`,
      [input.venta_id]
    );
    const saldoPendiente = Number(venta.total) - Number(abonadoRows[0]?.abonado ?? 0);
    if (input.monto > saldoPendiente) {
      await conn.rollback();
      return { error: `El abono no puede exceder el saldo pendiente ($${saldoPendiente.toFixed(2)}).` };
    }

    await conn.query(
      `INSERT INTO abonos (venta_id, monto, metodo_pago, usuario_id, sesion_caja_id)
       VALUES (?, ?, ?, ?, ?)`,
      [input.venta_id, input.monto, input.metodo_pago, session.sub, input.sesion_caja_id]
    );

    if (input.metodo_pago === 'efectivo') {
      await conn.query(
        `UPDATE sesiones_caja SET saldo_final_esperado = saldo_final_esperado + ? WHERE id = ?`,
        [input.monto, input.sesion_caja_id]
      );
    }

    await conn.commit();
    revalidatePath('/ventas');
    revalidatePath(`/ventas/${input.venta_id}`);
    revalidatePath('/dashboard');
    revalidatePath('/caja');
    revalidatePath('/cuentas-por-cobrar');
    return { success: true, saldo_pendiente: parseFloat((saldoPendiente - input.monto).toFixed(2)) };
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return { error: 'Error al registrar el abono.' };
  } finally {
    conn.release();
  }
}

export async function getVentas(filtro?: { desde?: string; hasta?: string }): Promise<Venta[]> {
  const session = await getSession();
  if (!tienePermiso(session, 'ventas', 'ver')) return [];

  // FIX: sin interpolación — condiciones como parámetros, estructura fija
  const conditions: string[] = [];
  const params: string[] = [];

  if (filtro?.desde) { conditions.push('DATE(v.creado_at) >= ?'); params.push(filtro.desde); }
  if (filtro?.hasta) { conditions.push('DATE(v.creado_at) <= ?'); params.push(filtro.hasta); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT v.*, c.nombre AS cliente_nombre, u.nombre AS usuario_nombre,
           v.total - COALESCE((SELECT SUM(a.monto) FROM abonos a WHERE a.venta_id = v.id), 0) AS saldo_pendiente
    FROM ventas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    JOIN usuarios u ON u.id = v.usuario_id
    ${where}
    ORDER BY v.creado_at DESC
    LIMIT 500
  `, params);
  return rows as Venta[];
}

// ─── Abonos cobrados (lista de Ventas) ────────────────────────────────────────
// Un abono se muestra en el día en que se cobró, no en el de la venta original.
export interface AbonoListado {
  id: number;
  venta_id: number;
  folio: string;
  cliente_nombre: string | null;
  monto: number;
  metodo_pago: 'efectivo' | 'transferencia' | 'tarjeta';
  usuario_nombre: string | null;   // quién lo cobró
  creado_at: string;
  venta_creado_at: string;
  /** Este abono dejó el saldo de la venta en 0. */
  liquidacion: boolean;
}

export async function getAbonosRecientes(): Promise<AbonoListado[]> {
  const session = await getSession();
  if (!tienePermiso(session, 'ventas', 'ver')) return [];

  // `liquidacion`: el acumulado de abonos de la venta hasta este abono ya cubre el total.
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      a.id, a.venta_id, v.folio, c.nombre AS cliente_nombre,
      a.monto, a.metodo_pago, u.nombre AS usuario_nombre,
      a.creado_at, v.creado_at AS venta_creado_at,
      SUM(a.monto) OVER (PARTITION BY a.venta_id ORDER BY a.creado_at, a.id) >= v.total AS liquidacion
    FROM abonos a
    JOIN ventas v        ON v.id = a.venta_id
    LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    ORDER BY a.creado_at DESC, a.id DESC
    LIMIT 500
  `);
  return rows.map(r => ({ ...r, monto: Number(r.monto), liquidacion: Boolean(Number(r.liquidacion)) })) as AbonoListado[];
}

export async function getVentaDetalle(ventaId: number): Promise<Venta | null> {
  const [ventaRows] = await pool.query<RowDataPacket[]>(`
    SELECT v.*, c.nombre AS cliente_nombre, u.nombre AS usuario_nombre,
           COALESCE((SELECT SUM(a.monto) FROM abonos a WHERE a.venta_id = v.id), 0) AS abonado
    FROM ventas v
    LEFT JOIN clientes c  ON c.id  = v.cliente_id
    LEFT JOIN usuarios u  ON u.id  = v.usuario_id
    WHERE v.id = ?
  `, [ventaId]);

  if (!ventaRows[0]) return null;
  const row = ventaRows[0];
  const venta = row as Venta;
  venta.saldo_pendiente = parseFloat((Number(row.total) - Number(row.abonado)).toFixed(2));

  const [detallesRows] = await pool.query<RowDataPacket[]>(`
    SELECT dv.*,
           COALESCE(p.nombre, '[Producto eliminado]') AS producto_nombre,
           COALESCE(p.sku, '—')                       AS producto_sku
    FROM detalles_ventas dv
    LEFT JOIN productos p ON p.id = dv.producto_id
    WHERE dv.venta_id = ?
  `, [ventaId]);
  venta.detalles = detallesRows as Venta['detalles'];

  if (venta.tipo_venta === 'credito') {
    const [abonosRows] = await pool.query<RowDataPacket[]>(`
      SELECT a.*, u.nombre AS usuario_nombre
      FROM abonos a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.venta_id = ?
      ORDER BY a.creado_at ASC
    `, [ventaId]);
    venta.abonos = abonosRows as Abono[];
  }

  return venta;
}

export async function getDashboardStats() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return null;

  // FIX: CURDATE() se evalúa en la zona horaria del servidor de MySQL (UTC en
  // Hostinger), que ya lleva ~6h de adelanto sobre America/Mexico_City. Cada
  // tarde, entre las 18:00 y medianoche hora de México, CURDATE() ya marcaba el
  // día siguiente y estas consultas dejaban de contar las ventas del día en
  // curso. Se compara contra el día calculado en la zona horaria de la app, y
  // `creado_at` (guardado en UTC) se recorre -6h antes de extraer la fecha para
  // que coincida con el día calendario en México.
  const hoy        = todayLocal();
  const inicioMes  = monthStartLocal();

  // "Ingresos" = dinero realmente cobrado: una venta de contado cuenta
  // completa el día en que se hace; una venta a crédito solo cuenta lo que
  // se ha abonado (en la fecha del abono, no en la de la venta original).
  const [ventasHoy] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total_ventas,
            COALESCE(SUM(CASE WHEN tipo_venta = 'contado' THEN total ELSE 0 END), 0) AS ingresos_contado
     FROM ventas WHERE DATE(creado_at - INTERVAL 6 HOUR) = ?`,
    [hoy]
  );
  const [abonosHoy] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(monto), 0) AS monto FROM abonos WHERE DATE(creado_at - INTERVAL 6 HOUR) = ?`,
    [hoy]
  );
  const [ventasMes] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total_ventas,
            COALESCE(SUM(CASE WHEN tipo_venta = 'contado' THEN total ELSE 0 END), 0) AS ingresos_contado
     FROM ventas WHERE DATE(creado_at - INTERVAL 6 HOUR) >= ?`,
    [inicioMes]
  );
  const [abonosMes] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(monto), 0) AS monto FROM abonos WHERE DATE(creado_at - INTERVAL 6 HOUR) >= ?`,
    [inicioMes]
  );
  const [totalStock] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(stock), 0) AS stock_total FROM productos`
  );

  return {
    hoy: {
      total_ventas: Number(ventasHoy[0]?.total_ventas ?? 0),
      ingresos:     Number(ventasHoy[0]?.ingresos_contado ?? 0) + Number(abonosHoy[0]?.monto ?? 0),
    },
    mes: {
      total_ventas: Number(ventasMes[0]?.total_ventas ?? 0),
      ingresos:     Number(ventasMes[0]?.ingresos_contado ?? 0) + Number(abonosMes[0]?.monto ?? 0),
    },
    stock_total: Number(totalStock[0]?.stock_total ?? 0),
  };
}

// ─── Dashboard por rango ──────────────────────────────────────────────────────
export interface DashboardRangeData {
  ventas_por_dia: { fecha: string; ventas: number; ingresos: number }[];
  total_ventas: number;
  total_ingresos: number;
  ticket_promedio: number;
  productos_vendidos: number;
}

export async function getDashboardByRange(
  desde: string,
  hasta: string,
): Promise<DashboardRangeData | null> {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return null;
  // Validar que sean fechas YYYY-MM-DD válidas para evitar inyección
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(desde) || !dateRegex.test(hasta)) return null;

  // FIX: creado_at se guarda en UTC; se recorre -6h antes de extraer la fecha
  // para comparar contra el día calendario de America/Mexico_City (ver nota en
  // getDashboardStats).
  //
  // "Ingresos" = dinero realmente cobrado, no valor vendido: una venta de
  // contado cuenta completa el día en que se hizo; una venta a crédito solo
  // cuenta lo que se ha abonado, en la fecha de cada abono (que puede caer
  // en un día distinto al de la venta original) — por eso se combinan dos
  // consultas por fecha en vez de una sola sobre `ventas`.
  const [ventasPorDiaContado] = await pool.query<RowDataPacket[]>(
    `SELECT
       DATE_FORMAT(DATE(creado_at - INTERVAL 6 HOUR), '%Y-%m-%d') AS fecha,
       COUNT(*)                                                                    AS ventas,
       COALESCE(SUM(CASE WHEN tipo_venta = 'contado' THEN total ELSE 0 END), 0)    AS ingresos
     FROM ventas
     WHERE DATE(creado_at - INTERVAL 6 HOUR) BETWEEN ? AND ?
     GROUP BY fecha`,
    [desde, hasta]
  );
  const [abonosPorDia] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(DATE(creado_at - INTERVAL 6 HOUR), '%Y-%m-%d') AS fecha,
            COALESCE(SUM(monto), 0) AS monto
     FROM abonos
     WHERE DATE(creado_at - INTERVAL 6 HOUR) BETWEEN ? AND ?
     GROUP BY fecha`,
    [desde, hasta]
  );

  // Un día puede tener abonos sin ninguna venta nueva ese día — se combinan
  // por fecha en vez de asumir que ambas consultas cubren los mismos días.
  const porDia = new Map<string, { fecha: string; ventas: number; ingresos: number }>();
  for (const row of ventasPorDiaContado) {
    porDia.set(row.fecha, { fecha: row.fecha, ventas: Number(row.ventas), ingresos: Number(row.ingresos) });
  }
  for (const row of abonosPorDia) {
    const existente = porDia.get(row.fecha);
    if (existente) existente.ingresos += Number(row.monto);
    else porDia.set(row.fecha, { fecha: row.fecha, ventas: 0, ingresos: Number(row.monto) });
  }
  const ventasPorDia = Array.from(porDia.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const [resumen] = await pool.query<RowDataPacket[]>(
    `SELECT
       COUNT(*)                                        AS total_ventas,
       COALESCE(AVG(total), 0)                         AS ticket_promedio,
       COALESCE(SUM(dv.cantidad_total), 0)             AS productos_vendidos
     FROM ventas v
     LEFT JOIN (
       SELECT venta_id, SUM(cantidad) AS cantidad_total
       FROM detalles_ventas GROUP BY venta_id
     ) dv ON dv.venta_id = v.id
     WHERE DATE(v.creado_at - INTERVAL 6 HOUR) BETWEEN ? AND ?`,
    [desde, hasta]
  );

  const r = resumen[0] ?? {};
  return {
    ventas_por_dia:     ventasPorDia,
    total_ventas:       Number(r.total_ventas ?? 0),
    total_ingresos:     parseFloat(ventasPorDia.reduce((s, d) => s + d.ingresos, 0).toFixed(2)),
    ticket_promedio:    Number(r.ticket_promedio ?? 0),
    productos_vendidos: Number(r.productos_vendidos ?? 0),
  };
}

// ─── Cuentas por cobrar ───────────────────────────────────────────────────────
export interface CuentaPorCobrar {
  venta_id: number;
  folio: string;
  cliente_id: number;
  cliente_nombre: string;
  usuario_nombre: string;
  total: number;
  abonado: number;
  saldo_pendiente: number;
  creado_at: string;
  /** Fecha del abono más reciente; null si nunca ha abonado. */
  ultimo_abono: string | null;
  /** Días desde el último abono (o desde la venta, si no hay abonos). */
  dias_sin_abonar: number;
}

export async function getCuentasPorCobrar(): Promise<CuentaPorCobrar[]> {
  const session = await getSession();
  if (!tienePermiso(session, 'ventas', 'ver')) return [];

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      v.id AS venta_id, v.folio, v.cliente_id, c.nombre AS cliente_nombre,
      u.nombre AS usuario_nombre, v.total, v.creado_at,
      COALESCE(SUM(a.monto), 0)              AS abonado,
      v.total - COALESCE(SUM(a.monto), 0)    AS saldo_pendiente,
      MAX(a.creado_at)                       AS ultimo_abono,
      -- -6h en ambos lados: días calendario de America/Mexico_City (ver getDashboardStats).
      DATEDIFF(NOW() - INTERVAL 6 HOUR, COALESCE(MAX(a.creado_at), v.creado_at) - INTERVAL 6 HOUR) AS dias_sin_abonar
    FROM ventas v
    JOIN clientes c      ON c.id = v.cliente_id
    JOIN usuarios u      ON u.id = v.usuario_id
    LEFT JOIN abonos a   ON a.venta_id = v.id
    WHERE v.tipo_venta = 'credito'
    GROUP BY v.id
    HAVING saldo_pendiente > 0
    ORDER BY v.creado_at ASC
  `);
  return rows.map(r => ({ ...r, dias_sin_abonar: Number(r.dias_sin_abonar) })) as CuentaPorCobrar[];
}

// ─── Export de ventas a Excel (/dashboard/exportar) ───────────────────────────
export interface VentaExportRow {
  folio: string;
  fecha: string;            // 'YYYY-MM-DD HH:MM:SS', hora de México
  cliente_nombre: string | null;
  usuario_id: number;
  usuario_nombre: string;
  tipo_venta: 'contado' | 'credito';
  metodo_pago: string | null;
  subtotal: number;         // antes de cualquier descuento
  descuento: number;        // promoción + descuento adicional
  total: number;
  saldo_pendiente: number;
}

export interface DetalleVentaExportRow {
  folio: string;
  fecha: string;
  producto_id: number;
  producto_nombre: string;
  producto_sku: string;
  categoria_nombre: string | null;
  marca_nombre: string | null;
  cantidad: number;
  precio_unitario: number;
  descuento: number;        // promoción de la línea
  importe: number;          // subtotal de la línea, antes del descuento adicional de la venta
}

export interface AbonoExportRow {
  fecha: string;            // fecha del abono, hora de México
  folio: string;
  fecha_venta: string;
  cliente_nombre: string | null;
  monto: number;
  metodo_pago: string;
  usuario_nombre: string;   // quién cobró
}

export interface VentasExportData {
  ventas: VentaExportRow[];
  detalles: DetalleVentaExportRow[];
  abonos: AbonoExportRow[];
  /** Nombres de los vendedores filtrados, para el subtítulo del reporte. */
  vendedoresNombres: string[];
}

export interface VentasExportPreview {
  ventas: number;
  piezas: number;
  vendido: number;
  cobrado: number;
  saldo: number;
  abonos: number;
}

export async function getVentasParaExport(opciones: ExportVentasOpciones): Promise<VentasExportData | null> {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return null;
  const o = validarOpciones(opciones);
  if (!o) return null;

  // creado_at está en UTC; -6h para el día/hora de America/Mexico_City (ver getDashboardStats).
  // Filtros de ventas: periodo, tipo, vendedor (quien hizo la venta) y método de
  // pago — en contado es el de la venta; en crédito, que tenga algún abono con ese método.
  const condV: string[] = ['DATE(v.creado_at - INTERVAL 6 HOUR) BETWEEN ? AND ?'];
  const paramsV: unknown[] = [o.desde, o.hasta];
  if (o.tipo !== 'todos')  { condV.push('v.tipo_venta = ?'); paramsV.push(o.tipo); }
  if (o.vendedores.length) { condV.push('v.usuario_id IN (?)'); paramsV.push(o.vendedores); }
  if (o.metodos.length) {
    condV.push(`((v.tipo_venta = 'contado' AND v.metodo_pago IN (?))
      OR (v.tipo_venta = 'credito' AND EXISTS (
        SELECT 1 FROM abonos ab WHERE ab.venta_id = v.id AND ab.metodo_pago IN (?))))`);
    paramsV.push(o.metodos, o.metodos);
  }
  const whereV = condV.join(' AND ');

  // Filtros de abonos: fecha del abono, método del abono y quién lo cobró.
  // Los abonos solo existen en ventas a crédito.
  const condA: string[] = ['DATE(a.creado_at - INTERVAL 6 HOUR) BETWEEN ? AND ?'];
  const paramsA: unknown[] = [o.desde, o.hasta];
  if (o.vendedores.length) { condA.push('a.usuario_id IN (?)'); paramsA.push(o.vendedores); }
  if (o.metodos.length)    { condA.push('a.metodo_pago IN (?)'); paramsA.push(o.metodos); }

  const [ventas] = await pool.query<RowDataPacket[]>(`
    SELECT
      v.folio,
      DATE_FORMAT(v.creado_at - INTERVAL 6 HOUR, '%Y-%m-%d %H:%i:%s') AS fecha,
      c.nombre AS cliente_nombre,
      v.usuario_id,
      u.nombre AS usuario_nombre,
      v.tipo_venta, v.metodo_pago, v.total,
      COALESCE(d.bruto, 0)                     AS subtotal,
      COALESCE(d.promo, 0) + v.descuento_monto AS descuento,
      -- Contado se cobra completo al momento; solo crédito puede tener saldo.
      CASE WHEN v.tipo_venta = 'credito' THEN v.total - COALESCE(a.abonado, 0) ELSE 0 END AS saldo_pendiente
    FROM ventas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    LEFT JOIN (
      SELECT venta_id, SUM(cantidad * precio_unitario) AS bruto, SUM(descuento_aplicado) AS promo
      FROM detalles_ventas GROUP BY venta_id
    ) d ON d.venta_id = v.id
    LEFT JOIN (
      SELECT venta_id, SUM(monto) AS abonado FROM abonos GROUP BY venta_id
    ) a ON a.venta_id = v.id
    WHERE ${whereV}
    ORDER BY v.creado_at ASC
  `, paramsV);

  const [detalles] = await pool.query<RowDataPacket[]>(`
    SELECT
      v.folio,
      DATE_FORMAT(v.creado_at - INTERVAL 6 HOUR, '%Y-%m-%d %H:%i:%s') AS fecha,
      dv.producto_id,
      COALESCE(p.nombre, '[Producto eliminado]') AS producto_nombre,
      COALESCE(p.sku, '—')                       AS producto_sku,
      cat.nombre AS categoria_nombre,
      m.nombre   AS marca_nombre,
      dv.cantidad, dv.precio_unitario,
      dv.descuento_aplicado AS descuento,
      dv.subtotal           AS importe
    FROM detalles_ventas dv
    JOIN ventas v            ON v.id   = dv.venta_id
    LEFT JOIN productos p    ON p.id   = dv.producto_id
    LEFT JOIN categorias cat ON cat.id = p.categoria_id
    LEFT JOIN marcas m       ON m.id   = p.marca_id
    WHERE ${whereV}
    ORDER BY v.creado_at ASC, dv.id ASC
  `, paramsV);

  let abonos: RowDataPacket[] = [];
  if (o.tipo !== 'contado') {
    [abonos] = await pool.query<RowDataPacket[]>(`
      SELECT
        DATE_FORMAT(a.creado_at - INTERVAL 6 HOUR, '%Y-%m-%d %H:%i:%s') AS fecha,
        v.folio,
        DATE_FORMAT(v.creado_at - INTERVAL 6 HOUR, '%Y-%m-%d %H:%i:%s') AS fecha_venta,
        c.nombre AS cliente_nombre,
        a.monto, a.metodo_pago,
        u.nombre AS usuario_nombre
      FROM abonos a
      JOIN ventas v        ON v.id = a.venta_id
      LEFT JOIN clientes c ON c.id = v.cliente_id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE ${condA.join(' AND ')}
      ORDER BY a.creado_at ASC
    `, paramsA);
  }

  let vendedoresNombres: string[] = [];
  if (o.vendedores.length) {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT nombre FROM usuarios WHERE id IN (?) ORDER BY nombre ASC', [o.vendedores]);
    vendedoresNombres = rows.map(r => r.nombre);
  }

  return {
    ventas: ventas.map(r => ({
      folio: r.folio, fecha: r.fecha, cliente_nombre: r.cliente_nombre,
      usuario_id: Number(r.usuario_id), usuario_nombre: r.usuario_nombre ?? '—',
      tipo_venta: r.tipo_venta, metodo_pago: r.metodo_pago,
      subtotal: Number(r.subtotal), descuento: Number(r.descuento), total: Number(r.total),
      saldo_pendiente: Math.max(0, Number(r.saldo_pendiente)),
    })),
    detalles: detalles.map(r => ({
      folio: r.folio, fecha: r.fecha, producto_id: Number(r.producto_id),
      producto_nombre: r.producto_nombre, producto_sku: r.producto_sku,
      categoria_nombre: r.categoria_nombre, marca_nombre: r.marca_nombre, cantidad: Number(r.cantidad),
      precio_unitario: Number(r.precio_unitario), descuento: Number(r.descuento), importe: Number(r.importe),
    })),
    abonos: abonos.map(r => ({
      fecha: r.fecha, folio: r.folio, fecha_venta: r.fecha_venta, cliente_nombre: r.cliente_nombre,
      monto: Number(r.monto), metodo_pago: r.metodo_pago, usuario_nombre: r.usuario_nombre ?? '—',
    })),
    vendedoresNombres,
  };
}

export async function getVentasExportPreview(opciones: ExportVentasOpciones): Promise<VentasExportPreview | null> {
  const data = await getVentasParaExport(opciones);
  if (!data) return null;
  const r2 = (n: number) => parseFloat(n.toFixed(2));
  // "Cobrado" = ventas de contado + abonos del periodo (mismo criterio que "Ingresos" del Dashboard).
  const cobrado = data.ventas.filter(v => v.tipo_venta === 'contado').reduce((s, v) => s + v.total, 0)
    + data.abonos.reduce((s, a) => s + a.monto, 0);
  return {
    ventas:  data.ventas.length,
    piezas:  data.detalles.reduce((s, d) => s + d.cantidad, 0),
    vendido: r2(data.ventas.reduce((s, v) => s + v.total, 0)),
    cobrado: r2(cobrado),
    saldo:   r2(data.ventas.reduce((s, v) => s + v.saldo_pendiente, 0)),
    abonos:  data.abonos.length,
  };
}
