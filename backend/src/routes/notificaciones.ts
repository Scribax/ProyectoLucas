import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateJWT, requireWriteAccess } from '../middleware/auth';
import { mapVentaVencidaToCobroPendiente } from '../services/cobrosService';

const router = Router();
router.use(authenticateJWT);

const getDiasVencido = (value: unknown): number => {
  const parsed = Number(value || process.env.COBRO_DIAS_VENCIDO || 5);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 5;
};

// Lista facturas con saldo pendiente y 5+ días vencidas para abrir WhatsApp manualmente.
router.get('/cobros-pendientes', async (req: Request, res: Response) => {
  try {
    const diasVencido = getDiasVencido(req.query.dias);

    const result = await query(
      `SELECT v.id,
              v.cliente_id,
              c.nombre AS cliente_nombre,
              c.telefono AS cliente_telefono,
              v.fecha,
              v.total,
              v.pagado,
              v.saldo,
              v.estado,
              FLOOR(EXTRACT(EPOCH FROM (NOW() - v.fecha)) / 86400)::int AS dias_vencida,
              MAX(n.enviado_at) AS ultima_notificacion_at
       FROM ventas v
       JOIN clientes c ON c.id = v.cliente_id
       LEFT JOIN notificaciones_cobro n ON n.venta_id = v.id AND n.estado = 'enviada'
       WHERE v.is_void = false
         AND c.is_active = true
         AND c.saldo > 0
         AND v.saldo > 0
         AND v.estado IN ('pendiente', 'parcial')
         AND v.fecha <= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY v.id, c.nombre, c.telefono
       ORDER BY dias_vencida DESC, v.fecha ASC`,
      [diasVencido]
    );

    const cobros = result.rows
      .map(mapVentaVencidaToCobroPendiente)
      .filter(Boolean);

    const sinTelefono = result.rows.filter((row: any) => !row.cliente_telefono).length;

    res.json({
      dias_vencido: diasVencido,
      total: cobros.length,
      sin_telefono: sinTelefono,
      cobros,
    });
  } catch (error) {
    console.error('Error en GET /notificaciones/cobros-pendientes:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Registra que el usuario abrió/envió un recordatorio manual por WhatsApp.
router.post('/cobros-pendientes/:ventaId/registrar', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { ventaId } = req.params;
    const { mensaje, telefono } = req.body;

    const ventaResult = await query(
      `SELECT v.id,
              v.cliente_id,
              c.nombre AS cliente_nombre,
              c.telefono AS cliente_telefono,
              v.fecha,
              v.total,
              v.pagado,
              v.saldo,
              v.estado,
              FLOOR(EXTRACT(EPOCH FROM (NOW() - v.fecha)) / 86400)::int AS dias_vencida
       FROM ventas v
       JOIN clientes c ON c.id = v.cliente_id
       WHERE v.id = $1 AND v.is_void = false`,
      [ventaId]
    );

    if (ventaResult.rows.length === 0) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    const cobro = mapVentaVencidaToCobroPendiente(ventaResult.rows[0]);
    if (!cobro) {
      return res.status(400).json({ message: 'El cliente no tiene teléfono válido para WhatsApp' });
    }

    const mensajeFinal = typeof mensaje === 'string' && mensaje.trim() ? mensaje.trim() : cobro.mensaje;
    const telefonoFinal = typeof telefono === 'string' && telefono.trim() ? telefono.trim() : cobro.telefono;

    const result = await query(
      `INSERT INTO notificaciones_cobro
        (cliente_id, venta_id, telefono, mensaje, estado, proveedor, proveedor_message_id, enviado_at)
       VALUES ($1, $2, $3, $4, 'enviada', 'wa.me', $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [cobro.cliente_id, cobro.venta_id, telefonoFinal, mensajeFinal, `manual-${Date.now()}`]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user!.id, 'SEND_PAYMENT_REMINDER', 'venta', ventaId, JSON.stringify({ cliente_id: cobro.cliente_id, telefono: telefonoFinal })]
    );

    res.status(201).json({ notificacion: result.rows[0] });
  } catch (error) {
    console.error('Error en POST /notificaciones/cobros-pendientes/:ventaId/registrar:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;
