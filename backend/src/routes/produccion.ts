import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

/**
 * GET /api/produccion?fecha=YYYY-MM-DD
 * Devuelve la producción de todos los gallineros para una fecha dada,
 * agrupada por gallinero con totales por tamaño.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { fecha } = req.query;
    const fechaParam = (fecha as string) || new Date().toISOString().split('T')[0];

    const result = await query(
      `SELECT
        p.gallinero_id,
        g.name as gallinero_nombre,
        SUM(CASE WHEN p.size = 'S'  THEN p.cantidad ELSE 0 END) as "S",
        SUM(CASE WHEN p.size = 'M'  THEN p.cantidad ELSE 0 END) as "M",
        SUM(CASE WHEN p.size = 'L'  THEN p.cantidad ELSE 0 END) as "L",
        SUM(CASE WHEN p.size = 'XL' THEN p.cantidad ELSE 0 END) as "XL",
        SUM(p.cantidad) as total
      FROM produccion p
      JOIN gallineros g ON p.gallinero_id = g.id
      WHERE p.fecha = $1
      GROUP BY p.gallinero_id, g.name`,
      [fechaParam]
    );

    res.json({ produccion: result.rows });
  } catch (error) {
    console.error('Error en GET /produccion:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;
