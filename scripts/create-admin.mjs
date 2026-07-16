/**
 * Uso: node scripts/create-admin.mjs
 * Crea el usuario admin inicial en la base de datos.
 * Configura .env.local o .env antes de ejecutar.
 */

import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { config } from 'dotenv';

// .env.local tiene prioridad si existe; .env sirve de respaldo.
config({ path: ['.env.local', '.env'] });

const conn = await mysql.createConnection({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'pos_inventario',
});

const password = 'Admin1234';
const hash = await bcrypt.hash(password, 10);

try {
  await conn.execute(
    'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)',
    ['Administrador', 'admin@pos.local', hash, 'admin']
  );
  console.log('✅ Usuario admin creado:');
  console.log('   Email:    admin@pos.local');
  console.log('   Password: Admin1234');
  console.log('   ⚠️  Cambia la contraseña después del primer acceso.');
} catch (e) {
  if (e.code === 'ER_DUP_ENTRY') {
    console.log('ℹ️  El usuario admin ya existe.');
  } else {
    console.error('Error:', e.message);
  }
}

await conn.end();
