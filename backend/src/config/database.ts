import { Pool } from 'pg';

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

// Cerrar conexión
export const close = (): Promise<void> => {
  return pool.end();
};

export default pool;
