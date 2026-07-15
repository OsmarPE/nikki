'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

// Todo lo que NO sea usuarios / permisos_usuario. Orden: hijos antes que
// padres por prolijidad (FOREIGN_KEY_CHECKS va desactivado de todos modos).
const TABLAS_NEGOCIO = [
  'detalles_ventas', 'movimientos_inventario', 'ventas', 'sesiones_caja',
  'productos', 'colecciones', 'marcas', 'categorias', 'clientes',
];

/**
 * Borra TODO el dato de negocio (productos, ventas, clientes, inventario,
 * caja...) pero deja intactas las tablas usuarios y permisos_usuario, para
 * que nadie pierda su cuenta ni sus permisos. TRUNCATE reinicia los
 * autoincrementales — después de esto los IDs vuelven a empezar en 1.
 */
export async function borrarDatosNegocio() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };

  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const tabla of TABLAS_NEGOCIO) {
      await conn.query(`TRUNCATE TABLE \`${tabla}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e) {
    console.error(e);
    return { error: 'Error al borrar los datos. Nada se modificó de forma parcial si esto ocurrió antes de completar el borrado.' };
  } finally {
    conn.release();
  }
}

/**
 * Inserta un set de datos de ejemplo (clientes, catálogo, productos, una
 * caja, ventas de muestra) SIN tocar usuarios. Las ventas/caja/movimientos
 * de muestra quedan asociadas al primer usuario admin real que exista —
 * nunca a un ID inventado — para que las llaves foráneas siempre apunten a
 * alguien que de verdad existe.
 */
export async function cargarDatosMuestra() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return { error: 'Sin permiso.' };

  const conn = await pool.getConnection();
  try {
    const [adminRows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM usuarios WHERE rol = 'admin' ORDER BY id LIMIT 1`
    );
    const usuarioId = adminRows[0]?.id as number | undefined;
    if (!usuarioId) return { error: 'No hay ningún usuario admin para asociar los datos de muestra.' };

    async function insertarYObtenerIds(tabla: string, sql: string, params: unknown[], n: number): Promise<number[]> {
      await conn.query(sql, params);
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM \`${tabla}\` ORDER BY id DESC LIMIT ?`, [n]
      );
      return (rows as RowDataPacket[]).map(r => r.id as number).reverse();
    }

    await conn.beginTransaction();

    const clienteIds = await insertarYObtenerIds('clientes',
      `INSERT INTO clientes (nombre, telefono, email) VALUES (?,?,?),(?,?,?),(?,?,?),(?,?,?)`,
      [
        'María González', '555-123-4567', 'maria.gonzalez@ejemplo.com',
        'Juan Pérez', '555-987-6543', 'juan.perez@ejemplo.com',
        'Cliente Mostrador', null, null,
        'Ana López', '555-555-5555', 'ana.lopez@ejemplo.com',
      ], 4);

    const categoriaIds = await insertarYObtenerIds('categorias',
      `INSERT INTO categorias (nombre) VALUES (?),(?),(?),(?)`,
      ['Electrónica', 'Ropa', 'Hogar', 'Accesorios'], 4);

    const marcaIds = await insertarYObtenerIds('marcas',
      `INSERT INTO marcas (nombre) VALUES (?),(?),(?),(?)`,
      ['Samsung', 'Nike', 'Sony', 'Genérica'], 4);

    const coleccionIds = await insertarYObtenerIds('colecciones',
      `INSERT INTO colecciones (nombre, deleted_at) VALUES (?,NULL),(?,NULL),(?,?)`,
      ['Verano 2026', 'Outlet', 'Invierno 2025', '2026-01-01 00:00:00'], 3);

    // stock ya incluye el neto de los movimientos que se insertan más abajo
    // (10/25/15/50/30 de entrada, menos 1 de salida por la venta de muestra).
    const productoIds = await insertarYObtenerIds('productos',
      `INSERT INTO productos (sku, nombre, precio, precio_descuento, descripcion, categoria_id, marca_id, coleccion_id, stock) VALUES
       (?,?,?,?,?,?,?,NULL,9),
       (?,?,?,?,?,?,?,?,24),
       (?,?,?,?,?,?,?,?,14),
       (?,?,?,?,?,?,?,?,49),
       (?,?,?,?,?,?,?,?,30)`,
      [
        'SKU-1001', 'Smart TV 55"', 8500.00, 7999.00, 'Televisión 4K con Android TV', categoriaIds[0], marcaIds[0],
        'SKU-1002', 'Tenis Running Pro', 1500.00, null, 'Tenis deportivos para correr', categoriaIds[1], marcaIds[1], coleccionIds[0],
        'SKU-1003', 'Audífonos Inalámbricos', 2000.00, 1500.00, 'Audífonos con cancelación de ruido activa', categoriaIds[0], marcaIds[2], coleccionIds[1],
        'SKU-1004', 'Playera Básica Algodón', 250.00, null, 'Playera 100% algodón colores surtidos', categoriaIds[1], marcaIds[3], coleccionIds[0],
        'SKU-1005', 'Mochila Urbana Resistente', 800.00, 650.00, 'Mochila con compartimento para laptop', categoriaIds[3], marcaIds[3], coleccionIds[1],
      ], 5);

    await conn.query(
      `INSERT INTO movimientos_inventario (producto_id, tipo, motivo, cantidad, usuario_id, referencia, notas) VALUES
       (?, 'entrada', 'compra', 10, ?, 'FAC-COMPRA-001', 'Inventario inicial de muestra'),
       (?, 'entrada', 'compra', 25, ?, 'FAC-COMPRA-001', 'Inventario inicial de muestra'),
       (?, 'entrada', 'compra', 15, ?, 'FAC-COMPRA-002', 'Inventario inicial de muestra'),
       (?, 'entrada', 'compra', 50, ?, 'FAC-COMPRA-003', 'Inventario inicial de muestra'),
       (?, 'entrada', 'compra', 30, ?, 'FAC-COMPRA-003', 'Inventario inicial de muestra')`,
      [
        productoIds[0], usuarioId, productoIds[1], usuarioId, productoIds[2], usuarioId,
        productoIds[3], usuarioId, productoIds[4], usuarioId,
      ]
    );

    const sesionIds = await insertarYObtenerIds('sesiones_caja',
      `INSERT INTO sesiones_caja (usuario_id, fecha_apertura, fecha_cierre, saldo_inicial, saldo_final_esperado, saldo_final_declarado, diferencia, estado) VALUES
       (?, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 20 HOUR), 500.00, 8499.00, 8499.00, 0.00, 'cerrada'),
       (?, NOW(), NULL, 500.00, NULL, NULL, NULL, 'abierta')`,
      [usuarioId, usuarioId], 2);

    const sufijo = Date.now();
    const folios = [`VTA-MUESTRA-${sufijo}-1`, `VTA-MUESTRA-${sufijo}-2`, `VTA-MUESTRA-${sufijo}-3`];

    const ventaIds = await insertarYObtenerIds('ventas',
      `INSERT INTO ventas (folio, cliente_id, usuario_id, sesion_caja_id, total, metodo_pago) VALUES
       (?,?,?,?,7999.00,'tarjeta'),
       (?,?,?,?,1750.00,'efectivo'),
       (?,?,?,?,1500.00,'transferencia')`,
      [
        folios[0], clienteIds[0], usuarioId, sesionIds[0],
        folios[1], clienteIds[1], usuarioId, sesionIds[1],
        folios[2], clienteIds[2], usuarioId, sesionIds[1],
      ], 3);

    await conn.query(
      `INSERT INTO detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, descuento_aplicado, subtotal) VALUES
       (?,?,1,8500.00,501.00,7999.00),
       (?,?,1,1500.00,0.00,1500.00),
       (?,?,1,250.00,0.00,250.00),
       (?,?,1,2000.00,500.00,1500.00)`,
      [
        ventaIds[0], productoIds[0],
        ventaIds[1], productoIds[1],
        ventaIds[1], productoIds[3],
        ventaIds[2], productoIds[2],
      ]
    );

    await conn.query(
      `INSERT INTO movimientos_inventario (producto_id, tipo, motivo, cantidad, usuario_id, referencia, notas) VALUES
       (?, 'salida', 'venta', 1, ?, ?, 'Venta de muestra'),
       (?, 'salida', 'venta', 1, ?, ?, 'Venta de muestra'),
       (?, 'salida', 'venta', 1, ?, ?, 'Venta de muestra'),
       (?, 'salida', 'venta', 1, ?, ?, 'Venta de muestra')`,
      [
        productoIds[0], usuarioId, folios[0],
        productoIds[1], usuarioId, folios[1],
        productoIds[3], usuarioId, folios[1],
        productoIds[2], usuarioId, folios[2],
      ]
    );

    await conn.commit();
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e: unknown) {
    await conn.rollback();
    const err = e as { code?: string };
    if (err.code === 'ER_DUP_ENTRY') {
      return { error: 'Ya hay datos con esos mismos nombres/SKU. Borra los datos de negocio primero si quieres recargar la muestra desde cero.' };
    }
    console.error(e);
    return { error: 'Error al cargar los datos de muestra.' };
  } finally {
    conn.release();
  }
}
