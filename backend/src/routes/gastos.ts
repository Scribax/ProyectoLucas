import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateJWT, requireWriteAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// Listar gastos (con filtro por mes)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { mes } = req.query; // formato: YYYY-MM

    let sql = `
      SELECT g.*, u.name as created_by_name
      FROM gastos g
      LEFT JOIN users u ON g.created_by = u.id
      WHERE 1=1`;
    const params: any[] = [];

    if (mes) {
      params.push(`${mes}-01`);
      params.push(`${mes}-31`);
      sql += ` AND g.fecha BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    sql += ' ORDER BY g.fecha DESC, g.created_at DESC';

    const result = await query(sql, params);

    // Calcular totales por categoría
    const totalesPorCategoria = result.rows.reduce((acc: any, g: any) => {
      if (!acc[g.categoria]) acc[g.categoria] = 0;
      acc[g.categoria] += parseFloat(g.monto);
      return acc;
    }, {});

    const totalMes = result.rows.reduce((sum: number, g: any) => sum + parseFloat(g.monto), 0);

    res.json({
      gastos: result.rows,
      totalesPorCategoria,
      totalMes
    });
  } catch (error) {
    console.error('Error en GET /gastos:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Crear gasto
router.post('/', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { categoria, descripcion, monto, fecha } = req.body;

    if (!categoria || !descripcion || !monto) {
      return res.status(400).json({ message: 'Categoría, descripción y monto son requeridos' });
    }

    if (monto <= 0) {
      return res.status(400).json({ message: 'El monto debe ser mayor a 0' });
    }

    const fechaGasto = fecha || new Date().toISOString().split('T')[0];

    const result = await query(
      `INSERT INTO gastos (categoria, descripcion, monto, fecha, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [categoria, descripcion, monto, fechaGasto, req.user!.id]
    );

    res.status(201).json({ gasto: result.rows[0] });
  } catch (error) {
    console.error('Error en POST /gastos:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Eliminar gasto
router.delete('/:id', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM gastos WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Gasto no encontrado' });
    }

    res.json({ message: 'Gasto eliminado', gasto: result.rows[0] });
  } catch (error) {
    console.error('Error en DELETE /gastos:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;
