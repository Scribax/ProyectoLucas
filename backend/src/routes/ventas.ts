import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateJWT, requireWriteAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// Listar ventas
router.get('/', async (req: Request, res: Response) => {
  try {
    const { cliente_id, desde, hasta, estado } = req.query;
    let sql = `
      SELECT v.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono
      FROM ventas v
      JOIN clientes c ON v.cliente_id = c.id
      WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (cliente_id) {
      paramCount++;
      sql += ` AND v.cliente_id = $${paramCount}`;
      params.push(cliente_id);
    }

    if (desde) {
      paramCount++;
      sql += ` AND v.fecha >= $${paramCount}`;
      params.push(desde);
    }

    if (hasta) {
      paramCount++;
      sql += ` AND v.fecha <= $${paramCount}`;
      params.push(hasta);
    }

    if (estado) {
      paramCount++;
      sql += ` AND v.estado = $${paramCount}`;
      params.push(estado);
    }

    sql += ' ORDER BY v.fecha DESC LIMIT 100';

    const result = await query(sql, params);
    res.json({ ventas: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener venta específica con items
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ventaResult = await query(
      `SELECT v.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, c.direccion as cliente_direccion
       FROM ventas v
       JOIN clientes c ON v.cliente_id = c.id
       WHERE v.id = $1`,
      [id]
    );

    if (ventaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    const itemsResult = await query(
      `SELECT vi.*, a.nombre as articulo_nombre
       FROM venta_items vi
       LEFT JOIN articulos a ON vi.articulo_id = a.id
       WHERE vi.venta_id = $1`,
      [id]
    );

    res.json({
      venta: { ...ventaResult.rows[0], items: itemsResult.rows }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Crear venta
router.post('/', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { cliente_id, items, observaciones, pagado, es_fiado } = req.body;

    if (!cliente_id || !items || items.length === 0) {
      return res.status(400).json({ message: 'Cliente e items requeridos' });
    }

    // Obtener saldo anterior del cliente
    const clienteResult = await query('SELECT saldo FROM clientes WHERE id = $1', [cliente_id]);
    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    const saldoAnterior = parseFloat(clienteResult.rows[0].saldo) || 0;

    // Calcular totales
    let total = 0;
    const itemsConSubtotal = items.map((item: any) => {
      const subtotal = item.cantidad * item.precio_unitario;
      total += subtotal;
      return { ...item, subtotal };
    });

    const montoPagado = pagado !== undefined ? parseFloat(pagado) : (es_fiado ? 0 : total);
    const saldo = Math.max(total - montoPagado, 0);
    const estado = saldo <= 0 ? 'pagada' : (montoPagado > 0 ? 'parcial' : 'pendiente');
    const saldoAcumulado = saldoAnterior + saldo;

    // Crear venta — detectar si las columnas saldo_anterior/saldo_acumulado existen
    let ventaResult;
    try {
      ventaResult = await query(
        `INSERT INTO ventas (cliente_id, total, pagado, saldo, estado, observaciones, created_by, saldo_anterior, saldo_acumulado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [cliente_id, total, montoPagado, saldo, estado, observaciones, req.user!.id, saldoAnterior, saldoAcumulado]
      );
    } catch (colError: any) {
      // Si las columnas no existen aún (migration pendiente), insertar sin ellas
      if (colError.code === '42703') {
        ventaResult = await query(
          `INSERT INTO ventas (cliente_id, total, pagado, saldo, estado, observaciones, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [cliente_id, total, montoPagado, saldo, estado, observaciones, req.user!.id]
        );
        // Agregar manualmente los campos al resultado
        ventaResult.rows[0].saldo_anterior = saldoAnterior;
        ventaResult.rows[0].saldo_acumulado = saldoAcumulado;
      } else {
        throw colError;
      }
    }

    const ventaId = ventaResult.rows[0].id;

    // Crear items — size puede ser null para artículos
    for (const item of itemsConSubtotal) {
      await query(
        `INSERT INTO venta_items (venta_id, size, cantidad, precio_unitario, subtotal, articulo_id, descripcion)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          ventaId,
          item.size || null,
          item.cantidad,
          item.precio_unitario,
          item.subtotal,
          item.articulo_id || null,
          item.descripcion || null
        ]
      );
    }

    res.status(201).json({
      venta: { ...ventaResult.rows[0], items: itemsConSubtotal }
    });
  } catch (error) {
    console.error('Error en POST /ventas:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Eliminar venta (equivale a eliminar "factura" en el listado)
router.delete('/:id', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ventaResult = await query(
      'SELECT id, cliente_id, total, pagado, saldo, estado FROM ventas WHERE id = $1',
      [id]
    );
    if (ventaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    const result = await query('DELETE FROM ventas WHERE id = $1 RETURNING *', [id]);

    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user!.id, 'DELETE', 'venta', id, JSON.stringify({ total: result.rows[0]?.total, saldo: result.rows[0]?.saldo })]
    );

    res.json({ message: 'Venta eliminada', venta: result.rows[0] });
  } catch (error) {
    console.error('Error en DELETE /ventas:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;
