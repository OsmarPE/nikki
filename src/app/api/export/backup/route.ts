import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

// Orden que respeta las llaves foráneas: padres antes que hijos, para que el
// archivo se pueda restaurar con `mysql < backup.sql` sin errores de FK.
const TABLAS = [
  'usuarios', 'clientes', 'categorias', 'marcas', 'colecciones',
  'productos', 'movimientos_inventario', 'sesiones_caja', 'ventas', 'detalles_ventas',
];

export async function GET() {
  const session = await getSession();
  if (!session || session.rol !== 'admin') {
    return new NextResponse('No autorizado', { status: 401 });
  }

  const conn = await pool.getConnection();
  try {
    const partes: string[] = [
      `-- Respaldo de la base de datos — Sistema POS`,
      `-- Generado el ${new Date().toISOString()}`,
      '',
      'SET FOREIGN_KEY_CHECKS = 0;',
      '',
    ];

    for (const tabla of TABLAS) {
      const [createRows] = await conn.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${tabla}\``);
      const createStmt = (createRows[0] as Record<string, string>)['Create Table'];

      partes.push(`-- ------------------------------------------------------------`);
      partes.push(`-- Tabla: ${tabla}`);
      partes.push(`-- ------------------------------------------------------------`);
      partes.push(`DROP TABLE IF EXISTS \`${tabla}\`;`);
      partes.push(`${createStmt};`);
      partes.push('');

      const [rows] = await conn.query<RowDataPacket[]>(`SELECT * FROM \`${tabla}\``);
      if (rows.length > 0) {
        const columnas = Object.keys(rows[0]);
        const columnasSql = columnas.map(c => `\`${c}\``).join(', ');
        for (const row of rows as Record<string, unknown>[]) {
          const valores = columnas.map(c => conn.escape(row[c])).join(', ');
          partes.push(`INSERT INTO \`${tabla}\` (${columnasSql}) VALUES (${valores});`);
        }
        partes.push('');
      }
    }

    partes.push('SET FOREIGN_KEY_CHECKS = 1;');

    const sql   = partes.join('\n');
    const fecha = new Date().toISOString().slice(0, 10);

    return new NextResponse(sql, {
      status: 200,
      headers: {
        'Content-Type':        'application/sql; charset=utf-8',
        'Content-Disposition': `attachment; filename="backup-nikki-${fecha}.sql"`,
      },
    });
  } catch (e) {
    console.error(e);
    return new NextResponse('Error al generar el respaldo.', { status: 500 });
  } finally {
    conn.release();
  }
}
