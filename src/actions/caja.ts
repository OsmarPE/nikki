'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { SesionCaja } from '@/types';

// ─── Tipos extendidos ─────────────────────────────────────────────────────────
export interface SesionCajaDetalle extends SesionCaja {
  usuario_nombre: string;
  total_ventas: number;
  monto_efectivo: number;
  monto_transferencia: number;
  monto_tarjeta: number;
  num_transacciones: number;
}

// ─── Sesión activa del usuario actual ────────────────────────────────────────
export async function getSesionAbierta(): Promise<SesionCaja | null> {
  const session = await getSession();
  if (!session) return null;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM sesiones_caja WHERE usuario_id = ? AND estado = 'abierta' LIMIT 1`,
    [session.sub]
  );
  return (rows[0] as SesionCaja) ?? null;
}

// ─── Sesión activa con métricas completas ────────────────────────────────────
export async function getSesionAbiertaDetalle(): Promise<SesionCajaDetalle | null> {
  const session = await getSession();
  if (!session) return null;

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      sc.*,
      u.nombre                                                            AS usuario_nombre,
      COALESCE(SUM(v.total), 0)                                          AS total_ventas,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'efectivo'      THEN v.total ELSE 0 END), 0) AS monto_efectivo,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'transferencia' THEN v.total ELSE 0 END), 0) AS monto_transferencia,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'tarjeta'       THEN v.total ELSE 0 END), 0) AS monto_tarjeta,
      COUNT(v.id)                                                        AS num_transacciones
    FROM sesiones_caja sc
    JOIN usuarios u ON u.id = sc.usuario_id
    LEFT JOIN ventas v ON v.sesion_caja_id = sc.id
    WHERE sc.usuario_id = ? AND sc.estado = 'abierta'
    GROUP BY sc.id
    LIMIT 1
  `, [session.sub]);

  if (rows.length > 0){
    const fecha = rows[0].fecha_apertura; // Asumiendo que es un objeto Date
    const fechaFormateada = fecha.toISOString().slice(0, 19).replace('T', ' ');

    if (rows[0].fecha_cierre) {
      const fechaCierre = rows[0].fecha_cierre;
      const fechaCierreFormateada = fechaCierre.toISOString().slice(0, 19).replace('T', ' ');
      rows[0].fecha_cierre = fechaCierreFormateada;
    }
    
    rows[0].fecha_apertura = fechaFormateada;
    
  }

  return (rows[0] as SesionCajaDetalle) ?? null;
}

// ─── Abrir caja ───────────────────────────────────────────────────────────────
export async function abrirCaja(saldoInicial: number) {
  const session = await getSession();
  if (!session) return { error: 'Sin sesión.' };
  if (saldoInicial < 0) return { error: 'El saldo inicial no puede ser negativo.' };

  const existente = await getSesionAbierta();
  if (existente) return { error: 'Ya tienes una caja abierta.' };

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO sesiones_caja (usuario_id, saldo_inicial, saldo_final_esperado, estado)
     VALUES (?, ?, ?, 'abierta')`,
    [session.sub, saldoInicial, saldoInicial]
  );
  revalidatePath('/caja');
  revalidatePath('/ventas/nueva');
  return { success: true, id: result.insertId };
}

// ─── Cerrar caja ──────────────────────────────────────────────────────────────
export async function cerrarCaja(sesionId: number, saldoDeclarado: number) {
  const session = await getSession();
  if (!session) return { error: 'Sin sesión.' };

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM sesiones_caja WHERE id = ? AND usuario_id = ? AND estado = 'abierta'`,
    [sesionId, session.sub]
  );
  const sesion = rows[0] as SesionCaja;
  if (!sesion) return { error: 'Sesión no encontrada.' };

  const [ventasRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(total), 0) AS total_efectivo
     FROM ventas WHERE sesion_caja_id = ? AND metodo_pago = 'efectivo'`,
    [sesionId]
  );
  const totalEfectivo = Number(ventasRows[0]?.total_efectivo ?? 0);
  const esperado   = Number(sesion.saldo_inicial) + totalEfectivo;
  const diferencia = saldoDeclarado - esperado;

  await pool.query(
    `UPDATE sesiones_caja
     SET estado = 'cerrada', fecha_cierre = NOW(),
         saldo_final_esperado = ?, saldo_final_declarado = ?, diferencia = ?
     WHERE id = ?`,
    [esperado, saldoDeclarado, diferencia, sesionId]
  );
  revalidatePath('/caja');
  revalidatePath('/ventas');
  return { success: true, esperado, diferencia };
}

// ─── Todas las sesiones (admin) ───────────────────────────────────────────────
export async function getSesionesCaja(filtro?: {
  solo_hoy?: boolean;
}): Promise<SesionCajaDetalle[]> {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return [];

  const where = filtro?.solo_hoy
    ? `WHERE DATE(sc.fecha_apertura) = CURDATE()`
    : `WHERE sc.fecha_apertura >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      sc.*,
      u.nombre                                                            AS usuario_nombre,
      COALESCE(SUM(v.total), 0)                                          AS total_ventas,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'efectivo'      THEN v.total ELSE 0 END), 0) AS monto_efectivo,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'transferencia' THEN v.total ELSE 0 END), 0) AS monto_transferencia,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'tarjeta'       THEN v.total ELSE 0 END), 0) AS monto_tarjeta,
      COUNT(v.id)                                                        AS num_transacciones
    FROM sesiones_caja sc
    JOIN usuarios u ON u.id = sc.usuario_id
    LEFT JOIN ventas v ON v.sesion_caja_id = sc.id
    ${where}
    GROUP BY sc.id
    ORDER BY sc.fecha_apertura DESC
  `);

  if (rows.length > 0){
    const fecha = rows[0].fecha_apertura; // Asumiendo que es un objeto Date
    const fechaFormateada = fecha.toISOString().slice(0, 19).replace('T', ' ');
    
    rows[0].fecha_apertura = fechaFormateada;
    
    if (rows[0].fecha_cierre) {
      const fechaCierre = rows[0].fecha_cierre;
      const fechaCierreFormateada = fechaCierre.toISOString().slice(0, 19).replace('T', ' ');
      rows[0].fecha_cierre = fechaCierreFormateada;
    }
  }

  return rows as SesionCajaDetalle[];
}

// ─── Resumen del día para el dashboard de caja ───────────────────────────────
export async function getResumenCajaHoy() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return null;

  const [resumen] = await pool.query<RowDataPacket[]>(`
    SELECT
      COUNT(DISTINCT sc.id)                                              AS total_cajas,
      SUM(CASE WHEN sc.estado = 'abierta'  THEN 1 ELSE 0 END)          AS cajas_abiertas,
      SUM(CASE WHEN sc.estado = 'cerrada'  THEN 1 ELSE 0 END)          AS cajas_cerradas,
      COALESCE(SUM(v.total), 0)                                          AS ingresos_totales,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'efectivo'      THEN v.total ELSE 0 END), 0) AS total_efectivo,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'transferencia' THEN v.total ELSE 0 END), 0) AS total_transferencia,
      COALESCE(SUM(CASE WHEN v.metodo_pago = 'tarjeta'       THEN v.total ELSE 0 END), 0) AS total_tarjeta,
      COUNT(v.id)                                                        AS num_ventas
    FROM sesiones_caja sc
    LEFT JOIN ventas v ON v.sesion_caja_id = sc.id
    WHERE DATE(sc.fecha_apertura) = CURDATE()
  `);

  return resumen[0] ?? null;
}
