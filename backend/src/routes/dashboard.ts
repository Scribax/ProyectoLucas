import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// Dashboard stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Producción hoy
    const prodHoyResult = await query(
      'SELECT SUM(cantidad) as total FROM produccion WHERE fecha = CURRENT_DATE'
    );

    // Producción semana
    const prodSemanaResult = await query(
      `SELECT SUM(cantidad) as total FROM produccion 
       WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'`
    );

    // Producción mes
    const prodMesResult = await query(
      `SELECT SUM(cantidad) as total FROM produccion 
       WHERE fecha >= DATE_TRUNC('month', CURRENT_DATE)`
    );

    // Ventas hoy
    const ventasHoyResult = await query(
      `SELECT SUM(total) as total FROM ventas 
       WHERE DATE(fecha) = CURRENT_DATE`
    );

    // Ventas mes
    const ventasMesResult = await query(
      `SELECT SUM(total) as total FROM ventas 
       WHERE fecha >= DATE_TRUNC('month', CURRENT_DATE)`
    );

    // Gastos mes
    const gastosMesResult = await query(
      `SELECT SUM(monto) as total FROM gastos 
       WHERE fecha >= DATE_TRUNC('month', CURRENT_DATE)`
    );

    // Clientes con deuda
    const deudaResult = await query(
      'SELECT COUNT(*) as total FROM clientes WHERE saldo > 0'
    );

    // Gallinero más productivo hoy
    const gallineroTopResult = await query(
      `SELECT g.name, SUM(p.cantidad) as total
       FROM produccion p
       JOIN gallineros g ON p.gallinero_id = g.id
       WHERE p.fecha = CURRENT_DATE
       GROUP BY g.id, g.name
       ORDER BY total DESC
       LIMIT 1`
    );

    // Tamaño más producido hoy
    const sizeTopResult = await query(
      `SELECT size, SUM(cantidad) as total
       FROM produccion
       WHERE fecha = CURRENT_DATE
       GROUP BY size
       ORDER BY total DESC
       LIMIT 1`
    );

    const stats = {
      produccionHoy: parseInt(prodHoyResult.rows[0]?.total) || 0,
      produccionSemana: parseInt(prodSemanaResult.rows[0]?.total) || 0,
      produccionMes: parseInt(prodMesResult.rows[0]?.total) || 0,
      ventasHoy: parseFloat(ventasHoyResult.rows[0]?.total) || 0,
      ventasMes: parseFloat(ventasMesResult.rows[0]?.total) || 0,
      gastosMes: parseFloat(gastosMesResult.rows[0]?.total) || 0,
      gananciaEstimada: (parseFloat(ventasMesResult.rows[0]?.total) || 0) - (parseFloat(gastosMesResult.rows[0]?.total) || 0),
      clientesDeuda: parseInt(deudaResult.rows[0]?.total) || 0,
      gallineroTop: gallineroTopResult.rows[0]?.name || 'N/A',
      sizeTop: sizeTopResult.rows[0]?.size || 'N/A'
    };

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Datos para gráficos - producción por día (últimos 30 días)
router.get('/produccion-chart', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT 
        fecha,
        SUM(CASE WHEN size = 'S' THEN cantidad ELSE 0 END) as s,
        SUM(CASE WHEN size = 'M' THEN cantidad ELSE 0 END) as m,
        SUM(CASE WHEN size = 'L' THEN cantidad ELSE 0 END) as l,
        SUM(CASE WHEN size = 'XL' THEN cantidad ELSE 0 END) as xl,
        SUM(cantidad) as total
      FROM produccion
      WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY fecha
      ORDER BY fecha`
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Datos para gráficos - producción por gallinero
router.get('/gallineros-chart', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT 
        g.name,
        SUM(CASE WHEN p.size = 'S' THEN p.cantidad ELSE 0 END) as s,
        SUM(CASE WHEN p.size = 'M' THEN p.cantidad ELSE 0 END) as m,
        SUM(CASE WHEN p.size = 'L' THEN p.cantidad ELSE 0 END) as l,
        SUM(CASE WHEN p.size = 'XL' THEN p.cantidad ELSE 0 END) as xl,
        SUM(p.cantidad) as total
      FROM gallineros g
      LEFT JOIN produccion p ON g.id = p.gallinero_id 
        AND p.fecha >= DATE_TRUNC('month', CURRENT_DATE)
      WHERE g.status = 'activo'
      GROUP BY g.id, g.name
      ORDER BY total DESC`
    );

    res.json({ data: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;
