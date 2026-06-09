import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../config/database';
import { authenticateJWT, requireRole, requireWriteAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// Listar ventas
router.get('/', async (req: Request, res: Response) => {
  try {
    const { cliente_id, desde, hasta, estado, incluir_anuladas } = req.query;
    const incluirAnuladas = incluir_anuladas === 'true';
    let sql = `
      SELECT v.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono
      FROM ventas v
      JOIN clientes c ON v.cliente_id = c.id
      WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (!incluirAnuladas) {
      sql += ` AND v.is_void = false`;
    }

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

    // Validar items antes de tocar la base de datos
    for (const item of items) {
      const cantidad = Number(item.cantidad);
      const precio = Number(item.precio_unitario);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        return res.status(400).json({ message: 'Cantidad inválida en uno de los items' });
      }
      if (!Number.isFinite(precio) || precio < 0) {
        return res.status(400).json({ message: 'Precio inválido en uno de los items' });
      }
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
      const subtotal = Number(item.cantidad) * Number(item.precio_unitario);
      total += subtotal;
      return { ...item, subtotal };
    });

    const montoPagado = pagado !== undefined ? parseFloat(pagado) : (es_fiado ? 0 : total);
    const saldo = Math.max(total - montoPagado, 0);
    const estado = saldo <= 0 ? 'pagada' : (montoPagado > 0 ? 'parcial' : 'pendiente');
    const saldoAcumulado = saldoAnterior + saldo;

    // Todo en una transacción: venta + items + saldo del cliente
    const ventaConItems = await withTransaction(async (tx) => {
      // Crear venta — detectar si las columnas saldo_anterior/saldo_acumulado existen
      let ventaResult;
      try {
        ventaResult = await tx(
          `INSERT INTO ventas (cliente_id, total, pagado, saldo, estado, observaciones, created_by, saldo_anterior, saldo_acumulado)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [cliente_id, total, montoPagado, saldo, estado, observaciones, req.user!.id, saldoAnterior, saldoAcumulado]
        );
      } catch (colError: any) {
        // Si las columnas no existen aún (migration pendiente), insertar sin ellas
        if (colError.code === '42703') {
          ventaResult = await tx(
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
        await tx(
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

      // Actualizar saldo del cliente sumando el saldo pendiente de esta venta
      if (saldo > 0) {
        await tx(
          `UPDATE clientes
           SET saldo = saldo + $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [saldo, cliente_id]
        );
      }

      return ventaResult.rows[0];
    });

    res.status(201).json({
      venta: { ...ventaConItems, items: itemsConSubtotal }
    });
  } catch (error) {
    console.error('Error en POST /ventas:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Anular venta/factura (soft): mantiene el registro pero lo excluye de reportes y deja saldo en 0
router.patch('/:id/anular', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const ventaResult = await query(
      'SELECT id, cliente_id, total, pagado, saldo, estado, is_void FROM ventas WHERE id = $1',
      [id]
    );
    if (ventaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    const venta = ventaResult.rows[0];
    if (venta.is_void) {
      return res.status(400).json({ message: 'La venta ya está anulada' });
    }

    const pagosResult = await query('SELECT COUNT(*)::int as count FROM pagos WHERE venta_id = $1', [id]);
    const pagosCount = pagosResult.rows[0]?.count || 0;
    const pagado = parseFloat(String(venta.pagado)) || 0;

    if (pagosCount > 0 || pagado > 0) {
      return res.status(400).json({ message: 'No se puede anular una venta con pagos registrados' });
    }

    // El saldo pendiente de esta venta que hay que devolver al cliente
    const saldoVenta = parseFloat(String(venta.saldo)) || 0;

    const updatedVenta = await withTransaction(async (tx) => {
      const updated = await tx(
        `UPDATE ventas
         SET is_void = true,
             voided_at = CURRENT_TIMESTAMP,
             voided_by = $2,
             void_reason = $3,
             saldo = 0,
             estado = 'pagada',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id, req.user!.id, motivo || null]
      );

      // Restar del saldo del cliente el saldo que tenía esta venta
      if (saldoVenta > 0) {
        await tx(
          `UPDATE clientes
           SET saldo = GREATEST(saldo - $1, 0), updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [saldoVenta, venta.cliente_id]
        );
      }

      await tx(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
        [req.user!.id, 'VOID', 'venta', id, JSON.stringify({ total: updated.rows[0]?.total, motivo: motivo || null })]
      );

      return updated.rows[0];
    });

    res.json({ message: 'Venta anulada', venta: updatedVenta });
  } catch (error) {
    console.error('Error en PATCH /ventas/:id/anular:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Eliminar venta (equivale a eliminar "factura" en el listado)
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ventaResult = await query(
      'SELECT id, cliente_id, total, pagado, saldo, estado, is_void FROM ventas WHERE id = $1',
      [id]
    );
    if (ventaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    const venta = ventaResult.rows[0];
    const pagosResult = await query('SELECT COUNT(*)::int as count FROM pagos WHERE venta_id = $1', [id]);
    const pagosCount = pagosResult.rows[0]?.count || 0;
    const pagado = parseFloat(String(venta.pagado)) || 0;

    if (pagosCount > 0 || pagado > 0) {
      return res.status(400).json({ message: 'No se puede eliminar una venta con pagos registrados' });
    }

    // Saldo que esta venta aportaba al cliente (0 si ya estaba anulada)
    const saldoVenta = venta.is_void ? 0 : (parseFloat(String(venta.saldo)) || 0);

    const deletedVenta = await withTransaction(async (tx) => {
      const result = await tx('DELETE FROM ventas WHERE id = $1 RETURNING *', [id]);

      // Devolver al cliente el saldo que esta venta tenía pendiente
      if (saldoVenta > 0) {
        await tx(
          `UPDATE clientes
           SET saldo = GREATEST(saldo - $1, 0), updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [saldoVenta, venta.cliente_id]
        );
      }

      await tx(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
        [req.user!.id, 'DELETE', 'venta', id, JSON.stringify({ total: result.rows[0]?.total, saldo: result.rows[0]?.saldo })]
      );

      return result.rows[0];
    });

    res.json({ message: 'Venta eliminada', venta: deletedVenta });
  } catch (error) {
    console.error('Error en DELETE /ventas:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;
