import { Router, Request, Response } from 'express';
import { query, withTransaction, recalcularSaldoCliente } from '../config/database';
import { authenticateJWT, requireRole, requireWriteAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

const MONEY_EPSILON = 0.009;

const resyncVentas = async (
  tx: (sql: string, params?: any[]) => Promise<any>,
  ventaIds: string[]
) => {
  const uniqueVentaIds = [...new Set(ventaIds)].filter(Boolean);
  if (uniqueVentaIds.length === 0) return;

  await tx(
    `UPDATE ventas v
     SET pagado = COALESCE(pr.total_pagado, 0),
         saldo  = GREATEST(v.total - COALESCE(pr.total_pagado, 0), 0),
         estado = CASE
           WHEN GREATEST(v.total - COALESCE(pr.total_pagado, 0), 0) <= 0 THEN 'pagada'
           WHEN COALESCE(pr.total_pagado, 0) > 0 THEN 'parcial'
           ELSE 'pendiente'
         END,
         updated_at = CURRENT_TIMESTAMP
     FROM (
       SELECT venta_id, SUM(monto) AS total_pagado
       FROM pagos
       WHERE venta_id = ANY($1::uuid[])
       GROUP BY venta_id
     ) pr
     WHERE v.id = pr.venta_id`,
    [uniqueVentaIds]
  );
};

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

// Diagnóstico: clientes cuyo saldo guardado NO coincide con el saldo canónico.
// Útil para verificar tras un deploy que todo cuadra. Solo admin.
// NOTA: va ANTES de GET /:id para que la ruta no sea capturada como un id.
router.get('/diagnostico/saldos', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT c.id, c.nombre,
             c.saldo AS saldo_guardado,
             GREATEST(
               COALESCE((SELECT SUM(v.total) FROM ventas v
                         WHERE v.cliente_id = c.id AND v.is_void = false), 0)
               - COALESCE((SELECT SUM(p.monto) FROM pagos p
                           LEFT JOIN ventas v ON p.venta_id = v.id
                           WHERE p.cliente_id = c.id
                             AND (p.venta_id IS NULL OR v.is_void = false)), 0),
               0
             ) AS saldo_calculado
      FROM clientes c
      WHERE c.is_active = true
    `);
    const descuadrados = result.rows.filter(
      (r: any) => Math.abs(parseFloat(r.saldo_guardado) - parseFloat(r.saldo_calculado)) > 0.01
    );
    res.json({
      total_clientes: result.rows.length,
      descuadrados: descuadrados.length,
      detalle: descuadrados,
    });
  } catch (error) {
    console.error('Error en GET /clientes/diagnostico/saldos:', error);
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
    const montoPago = Number(monto);

    if (!Number.isFinite(montoPago) || montoPago <= 0) {
      return res.status(400).json({ message: 'Monto inválido' });
    }

    // Verificar saldo del cliente
    const clienteResult = await query('SELECT saldo FROM clientes WHERE id = $1', [id]);
    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    if (parseFloat(clienteResult.rows[0].saldo) + MONEY_EPSILON < montoPago) {
      return res.status(400).json({ message: 'El pago excede el saldo del cliente' });
    }

    // Si viene con venta_id, verificar que el monto no supere el saldo real de esa venta
    // (evita acumular sobre ventas.pagado cuando ya tenía un pago parcial al crearse)
    if (venta_id) {
      const ventaCheck = await query('SELECT saldo FROM ventas WHERE id = $1 AND is_void = false', [venta_id]);
      if (ventaCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Factura no encontrada' });
      }
      const saldoVenta = parseFloat(ventaCheck.rows[0].saldo);
      if (montoPago > saldoVenta + MONEY_EPSILON) {
        return res.status(400).json({ message: `El pago ($${montoPago}) supera el saldo de la factura ($${saldoVenta})` });
      }
    } else {
      const ventasSaldo = await query(
        `SELECT COALESCE(SUM(saldo), 0) AS saldo_facturas
         FROM ventas
         WHERE cliente_id = $1 AND is_void = false AND saldo > 0`,
        [id]
      );
      const saldoFacturas = parseFloat(ventasSaldo.rows[0]?.saldo_facturas || 0);
      if (montoPago > saldoFacturas + MONEY_EPSILON) {
        return res.status(400).json({
          message: 'No hay facturas pendientes suficientes para imputar este pago. Reiniciá el backend para aplicar la reparación automática y volvé a intentar.',
        });
      }
    }

    // Todo en una transacción para mantener consistencia (un único cliente del pool)
    const pagos = await withTransaction(async (tx) => {
      const pagosCreados: any[] = [];
      const ventasAfectadas: string[] = [];

      if (venta_id) {
        const result = await tx(
          'INSERT INTO pagos (cliente_id, venta_id, monto, metodo, observaciones, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [id, venta_id, montoPago, metodo || 'efectivo', observaciones, req.user!.id]
        );
        pagosCreados.push(result.rows[0]);
        ventasAfectadas.push(venta_id);
      } else {
        let restante = montoPago;
        const ventasPendientes = await tx(
          `SELECT id, saldo
           FROM ventas
           WHERE cliente_id = $1 AND is_void = false AND saldo > 0
           ORDER BY fecha ASC, id ASC
           FOR UPDATE`,
          [id]
        );

        for (const venta of ventasPendientes.rows) {
          if (restante <= MONEY_EPSILON) break;

          const saldoVenta = parseFloat(venta.saldo) || 0;
          const aplicado = Math.min(restante, saldoVenta);
          if (aplicado <= MONEY_EPSILON) continue;

          const result = await tx(
            'INSERT INTO pagos (cliente_id, venta_id, monto, metodo, observaciones, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [
              id,
              venta.id,
              Number(aplicado.toFixed(2)),
              metodo || 'efectivo',
              observaciones || 'Pago imputado automaticamente al saldo del cliente',
              req.user!.id
            ]
          );
          pagosCreados.push(result.rows[0]);
          ventasAfectadas.push(venta.id);
          restante = Number((restante - aplicado).toFixed(2));
        }

        if (restante > MONEY_EPSILON) {
          throw new Error('No hay facturas pendientes suficientes para imputar este pago');
        }
      }

      // Recalcular facturas afectadas desde la suma real de pagos. Esto evita
      // que un pago general deje boletas vencidas pendientes en Cobros.
      await resyncVentas(tx, ventasAfectadas);

      // Recalcular el saldo del cliente desde la única fuente de verdad.
      //    (Reemplaza tanto los triggers de Postgres como los updates manuales
      //     que causaban el saldo duplicado / desactualizado.)
      await recalcularSaldoCliente(tx, id);

      return pagosCreados;
    });

    res.status(201).json({ pago: pagos[0], pagos });
  } catch (error) {
    console.error('Error en POST /clientes/:id/pagos:', error);
    if (error instanceof Error && error.message === 'No hay facturas pendientes suficientes para imputar este pago') {
      return res.status(400).json({ message: error.message });
    }
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
