/**
 * Ejecuta las migraciones y el seed de la base de datos.
 * Uso:  node scripts/db-seed.mjs [--schema] [--seed] [--all]
 *
 * Sin flags → --all  (schema + seed)
 */

import mysql from 'mysql2/promise';
import fs    from 'node:fs/promises';
import path  from 'node:path';
import url   from 'node:url';

// ---------- leer .env.local manualmente (sin dotenv) ----------
const __dir   = path.dirname(url.fileURLToPath(import.meta.url));
const envPath = path.resolve(__dir, '..', '.env.local');

try {
  const raw = await fs.readFile(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    process.env[key.trim()] = rest.join('=').trim();
  }
} catch {
  console.warn('⚠  No se encontró .env.local — usando variables de entorno del sistema.');
}

// ---------- configuración ----------
const config = {
  host    : process.env.DB_HOST     ?? 'localhost',
  port    : Number(process.env.DB_PORT ?? 3306),
  user    : process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME     ?? 'pos_inventario',
  multipleStatements: true,          // necesario para ejecutar el SQL completo
};

const MIGRATIONS_DIR = path.resolve(__dir, '..', 'database', 'migrations');
const SEED           = path.resolve(__dir, '..', 'database', 'seed.sql');

// ---------- args ----------
const args      = process.argv.slice(2);
const runAll    = args.length === 0 || args.includes('--all');
const runSchema = runAll || args.includes('--schema');
const runSeed   = runAll || args.includes('--seed');

// ---------- helpers ----------
async function run(conn, filePath) {
  const label = path.basename(filePath);
  process.stdout.write(`  ▶ ${label} … `);
  const sql = await fs.readFile(filePath, 'utf-8');
  await conn.query(sql);
  console.log('✓');
}

// ---------- main ----------
const conn = await mysql.createConnection(config);
console.log(`\n🔌 Conectado a ${config.host}:${config.port}/${config.database}\n`);

try {
  if (runSchema) {
    const archivos = (await fs.readdir(MIGRATIONS_DIR))
      .filter(f => f.endsWith('.sql'))
      .sort(); // 001_, 002_, … en orden
    for (const archivo of archivos) {
      await run(conn, path.join(MIGRATIONS_DIR, archivo));
    }
  }
  if (runSeed) await run(conn, SEED);
  console.log('\n✅ Listo.\n');
} catch (err) {
  console.error('\n❌ Error:\n', err.message);
  process.exit(1);
} finally {
  await conn.end();
}
