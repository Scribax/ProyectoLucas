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

/**
 * Recalcula y persiste clientes.saldo a partir de la ÚNICA fuente de verdad:
 *
 *   saldo = SUM(ventas.total de facturas NO anuladas)
 *         - SUM(pagos que NO pertenecen a una factura anulada)
 *
 * Esto respeta tanto los pagos asociados a una factura puntual como los pagos
 * "a cuenta" (venta_id NULL), nunca cuenta doble, y al anular una factura deja
 * de contar tanto su total como los pagos que se le habían hecho (la plata se
 * da por devuelta, no queda saldo a favor fantasma).
 *
 * DEBE llamarse al final de cualquier operación que toque ventas o pagos,
 * pasando el mismo `tx` de la transacción en curso para mantener atomicidad.
 *
 * Devuelve el nuevo saldo del cliente.
 */
export const recalcularSaldoCliente = async (
  tx: (sql: string, params?: any[]) => Promise<any>,
  clienteId: string
): Promise<number> => {
  const result = await tx(
    `UPDATE clientes c
     SET saldo = GREATEST(
           COALESCE((
             SELECT SUM(v.total) FROM ventas v
             WHERE v.cliente_id = c.id AND v.is_void = false
           ), 0)
           - COALESCE((
             SELECT SUM(p.monto) FROM pagos p
             LEFT JOIN ventas v ON p.venta_id = v.id
             WHERE p.cliente_id = c.id
               AND (p.venta_id IS NULL OR v.is_void = false)
           ), 0),
           0
         ),
         updated_at = CURRENT_TIMESTAMP
     WHERE c.id = $1
     RETURNING saldo`,
    [clienteId]
  );
  return result.rows[0] ? parseFloat(result.rows[0].saldo) : 0;
};

// Cerrar conexión
export const close = (): Promise<void> => {
  return pool.end();
};

export default pool;
