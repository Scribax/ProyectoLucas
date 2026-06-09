import { Pool, PoolClient } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgres://granja:granja123@postgres:5432/granja_avicola';

const pool = new Pool({
  connectionString,
});

// Helper promisificado para queries (PG Pool)
export const query = (sql: string, params?: any[]) => {
  return pool.query(sql, params);
};

// Helper para obtener un solo registro
export const queryOne = async (sql: string, params?: any[]) => {
  const result = await pool.query(sql, params);
  return result.rows[0];
};

// Helper para ejecutar (INSERT, UPDATE, DELETE)
export const run = async (sql: string, params?: any[]): Promise<{ lastID: number; changes: number }> => {
  const result = await pool.query(sql, params);
  return { lastID: 0, changes: result.rowCount || 0 };
};

/**
 * Ejecuta una serie de operaciones dentro de una transacción usando un único
 * cliente del pool. Hace COMMIT si el callback termina bien, o ROLLBACK si
 * lanza un error. Es la forma correcta de garantizar atomicidad: usar el
 * `query` global suelto NO sirve para transacciones porque cada llamada puede
 * tomar una conexión distinta del pool.
 *
 * Uso:
 *   await withTransaction(async (tx) => {
 *     await tx('INSERT ...', [...]);
 *     await tx('UPDATE ...', [...]);
 *   });
 */
export const withTransaction = async <T>(
  fn: (tx: (sql: string, params?: any[]) => Promise<any>) => Promise<T>
): Promise<T> => {
  const client: PoolClient = await pool.connect();
  const tx = (sql: string, params?: any[]) => client.query(sql, params);
  try {
    await client.query('BEGIN');
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Cerrar conexión
export const close = (): Promise<void> => {
  return pool.end();
};

export default pool;
