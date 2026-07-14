import mysql from 'mysql2/promise';

// In development, Next.js hot-reloads modules on every save, which would create
// a brand-new pool (and 10 new connections) each time, exhausting MySQL's
// max_connections limit.  Storing the pool on `global` makes it survive HMR
// while still being created fresh in production (where the module is cached
// normally by Node and `global` is never written to).

declare global {
  // eslint-disable-next-line no-var
  var _mysqlPool: mysql.Pool | undefined;
}

function createPool() {
  return mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               Number(process.env.DB_PORT) || 3306,
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'pos_inventario',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    timezone:           '+00:00',
  });
}

const pool: mysql.Pool =
  process.env.NODE_ENV === 'production'
    ? createPool()
    : (global._mysqlPool ??= createPool());

export default pool;
