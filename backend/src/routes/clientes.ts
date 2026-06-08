import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateJWT, requireRole, requireWriteAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// Listar todos los clientes
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, deuda } = req.query;
    let sql = 'SELECT * FROM clientes WHERE is_active = true';
    const params: any[] = [];

    if (search) {
      sql += ' AND (nombre ILIKE $1 OR telefono ILIKE $1)';
      params.push(`%${search}%`);
    }

    if (deuda === 'true') {
      sql += ' AND saldo > 0';
    }

    sql += ' ORDER BY nombre';

    const result = await query(sql, params);
    res.json({ clientes: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener cliente con historial completo
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Datos del cliente
    const clienteResult = await query('SELECT * FROM clientes WHERE id = $1', [id]);
    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    // Historial de ventas activas
    const ventasResult = await query(
      `SELECT v.*,
        json_agg(json_build_object(
          'id', vi.id,
          'size', vi.size,
          'cantidad', vi.cantidad,
          'precio_unitario', vi.precio_unitario,
          'subtotal', vi.subtotal,
          'articulo_id', vi.articulo_id,
          'descripcion', vi.descripcion
        ) ORDER BY vi.id) as items
      FROM ventas v
      LEFT JOIN venta_items vi ON v.id = vi.venta_id
      WHERE v.cliente_id = $1
        AND v.is_void = false
      GROUP BY v.id
      ORDER BY v.fecha DESC
      LIMIT 50`,
      [id]
    );

    // Historial de ventas anuladas
    const ventasAnuladasResult = await query(
      `SELECT v.*,
        json_agg(json_build_object(
          'id', vi.id,
          'size', vi.size,
          'cantidad', vi.cantidad,
          'precio_unitario', vi.precio_unitario,
          'subtotal', vi.subtotal,
          'articulo_id', vi.articulo_id,
          'descripcion', vi.descripcion
        ) ORDER BY vi.id) as items
      FROM ventas v
      LEFT JOIN venta_items vi ON v.id = vi.venta_id
      WHERE v.cliente_id = $1
        AND v.is_void = true
      GROUP BY v.id
      ORDER BY v.fecha DESC
      LIMIT 50`,
      [id]
    );

    // Historial de pagos
    const pagosResult = await query(
      'SELECT * FROM pagos WHERE cliente_id = $1 ORDER BY fecha DESC LIMIT 50',
      [id]
    );

    // Calcular estadísticas (solo ventas activas)
    const statsResult = await query(
      `SELECT
        COUNT(*) as total_ventas,
        SUM(total) as total_comprado,
        SUM(pagado) as total_pagado,
        SUM(saldo) as saldo_pendiente
      FROM ventas WHERE cliente_id = $1 AND is_void = false`,
      [id]
    );

    res.json({
      cliente: clienteResult.rows[0],
      ventas: ventasResult.rows,
      ventas_anuladas: ventasAnuladasResult.rows,
      pagos: pagosResult.rows,
      estadisticas: statsResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Crear cliente
router.post('/', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { nombre, telefono, direccion, observaciones } = req.body;

    if (!nombre) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }

    const result = await query(
      'INSERT INTO clientes (nombre, telefono, direccion, observaciones) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre, telefono, direccion, observaciones]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user!.id, 'CREATE', 'cliente', result.rows[0].id, JSON.stringify({ nombre })]
    );

    res.status(201).json({ cliente: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Actualizar cliente
router.put('/:id', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, direccion, observaciones } = req.body;

    const result = await query(
      `UPDATE clientes 
       SET nombre = COALESCE($1, nombre),
           telefono = COALESCE($2, telefono),
           direccion = COALESCE($3, direccion),
           observaciones = COALESCE($4, observaciones),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [nombre, telefono, direccion, observaciones, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json({ cliente: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Registrar pago
router.post('/:id/pagos', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { monto, metodo, observaciones, venta_id } = req.body;

    if (!monto || monto <= 0) {
      return res.status(400).json({ message: 'Monto inválido' });
    }

    // Verificar saldo del cliente
    const clienteResult = await query('SELECT saldo FROM clientes WHERE id = $1', [id]);
    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    if (clienteResult.rows[0].saldo < monto) {
      return res.status(400).json({ message: 'El pago excede el saldo del cliente' });
    }

    const result = await query(
      'INSERT INTO pagos (cliente_id, venta_id, monto, metodo, observaciones, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, venta_id || null, monto, metodo || 'efectivo', observaciones, req.user!.id]
    );

    res.status(201).json({ pago: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Eliminar cliente (soft delete)
router.delete('/:id', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const clienteResult = await query('SELECT id, nombre, saldo FROM clientes WHERE id = $1', [id]);
    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    const cliente = clienteResult.rows[0];
    const saldo = parseFloat(cliente.saldo) || 0;
    if (saldo > 0) {
      return res.status(400).json({ message: 'No se puede eliminar un cliente con saldo pendiente' });
    }

    const result = await query(
      `UPDATE clientes
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user!.id, 'DELETE', 'cliente', id, JSON.stringify({ nombre: result.rows[0]?.nombre })]
    );

    res.json({ message: 'Cliente eliminado', cliente: result.rows[0] });
  } catch (error) {
    console.error('Error en DELETE /clientes:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;
