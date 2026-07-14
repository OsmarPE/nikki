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

// El host remoto de Hostinger falla de forma intermitente al abrir conexiones
// nuevas (ETIMEDOUT / ENETUNREACH), incluso con la red del servidor en buen
// estado. Estos códigos son transitorios: reintentar una vez basta.
const RETRYABLE_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENETUNREACH',
  'PROTOCOL_CONNECTION_LOST',
]);

function isRetryable(err: unknown): boolean {
  const e = err as { code?: string; errors?: Array<{ code?: string }> };
  const code = e?.code ?? e?.errors?.[0]?.code;
  return code != null && RETRYABLE_CODES.has(code);
}

function withConnectionRetry(rawPool: mysql.Pool): mysql.Pool {
  return new Proxy(rawPool, {
    get(target, prop, receiver) {
      if (prop === 'query' || prop === 'execute') {
        const original = (Reflect.get(target, prop, target) as (...a: unknown[]) => Promise<unknown>).bind(target);
        return async (...args: unknown[]) => {
          try {
            return await original(...args);
          } catch (err) {
            if (!isRetryable(err)) throw err;
            return await original(...args);
          }
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as mysql.Pool;
}

function createPool() {
  return withConnectionRetry(mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               Number(process.env.DB_PORT) || 3306,
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'pos_inventario',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    timezone:           '+00:00',
    connectTimeout:     20000, // el host remoto de Hostinger a veces tarda en responder
  }));
}

const pool: mysql.Pool =
  process.env.NODE_ENV === 'production'
    ? createPool()
    : (global._mysqlPool ??= createPool());

export default pool;
