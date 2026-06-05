import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// Dashboard stats — compatible con el frontend
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const prodHoyResult = await query(
      'SELECT SUM(cantidad) as total FROM produccion WHERE fecha = CURRENT_DATE'
    );

    const ventasHoyResult = await query(
      `SELECT SUM(total) as total, COUNT(*) as cantidad FROM ventas WHERE DATE(fecha) = CURRENT_DATE`
    );

    const gallinerosResult = await query(
      `SELECT COUNT(*) as total FROM gallineros WHERE status = 'activo'`
    );

    const deudaResult = await query(
      `SELECT COUNT(*) as total, json_agg(json_build_object('id', id, 'nombre', nombre, 'telefono', telefono, 'saldo', saldo)) as lista
       FROM clientes WHERE saldo > 0 AND is_active = true`
    );

    res.json({
      produccionHoy: parseInt(prodHoyResult.rows[0]?.total) || 0,
      ventasHoy: parseFloat(ventasHoyResult.rows[0]?.total) || 0,
      cantidadVentasHoy: parseInt(ventasHoyResult.rows[0]?.cantidad) || 0,
      gallinerosActivos: parseInt(gallinerosResult.rows[0]?.total) || 0,
      clientesConDeuda: parseInt(deudaResult.rows[0]?.total) || 0,
      clientesDeudaList: deudaResult.rows[0]?.lista || []
    });
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

// Datos para gráficos - compatibilidad con el frontend del dashboard
// El frontend espera GET /dashboard/chart-data → { produccion: [], porGallinero: [] }
router.get('/chart-data', async (req: Request, res: Response) => {
  try {
    const produccionResult = await query(
      `SELECT 
        fecha::text,
        SUM(cantidad) as total
      FROM produccion
      WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY fecha
      ORDER BY fecha`
    );

    const gallinerosResult = await query(
      `SELECT 
        g.name,
        SUM(p.cantidad) as total
      FROM gallineros g
      LEFT JOIN produccion p ON g.id = p.gallinero_id
        AND p.fecha >= DATE_TRUNC('month', CURRENT_DATE)
      WHERE g.status = 'activo'
      GROUP BY g.id, g.name
      ORDER BY total DESC`
    );

    res.json({
      produccion: produccionResult.rows,
      porGallinero: gallinerosResult.rows
    });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// (duplicado eliminado — el endpoint /stats ya está definido arriba)

// Reporte mensual completo
router.get('/monthly', async (req: Request, res: Response) => {
  try {
    const { mes } = req.query; // formato: YYYY-MM
    const mesStr = mes as string || new Date().toISOString().substring(0, 7);
    const [year, month] = mesStr.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    // Producción del mes por tamaño
    const produccionResult = await query(
      `SELECT 
        SUM(CASE WHEN size = 'S' THEN cantidad ELSE 0 END) as s,
        SUM(CASE WHEN size = 'M' THEN cantidad ELSE 0 END) as m,
        SUM(CASE WHEN size = 'L' THEN cantidad ELSE 0 END) as l,
        SUM(CASE WHEN size = 'XL' THEN cantidad ELSE 0 END) as xl,
        SUM(cantidad) as total
      FROM produccion
      WHERE fecha BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    // Ingresos del mes
    const ingresosResult = await query(
      `SELECT SUM(total) as ingresos, SUM(pagado) as cobrado, SUM(saldo) as pendiente
       FROM ventas WHERE DATE(fecha) BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    // Gastos del mes por categoría
    const gastosResult = await query(
      `SELECT categoria, SUM(monto) as total
       FROM gastos WHERE fecha BETWEEN $1 AND $2
       GROUP BY categoria ORDER BY total DESC`,
      [startDate, endDate]
    );

    const totalGastos = gastosResult.rows.reduce((sum: number, g: any) => sum + parseFloat(g.total), 0);

    // Top 5 clientes del mes
    const topClientesResult = await query(
      `SELECT c.nombre, c.telefono, SUM(v.total) as total_comprado, COUNT(v.id) as cant_ventas
       FROM ventas v
       JOIN clientes c ON v.cliente_id = c.id
       WHERE DATE(v.fecha) BETWEEN $1 AND $2
       GROUP BY c.id, c.nombre, c.telefono
       ORDER BY total_comprado DESC
       LIMIT 5`,
      [startDate, endDate]
    );

    // Producción diaria del mes (para gráfico)
    const produccionDiariaResult = await query(
      `SELECT fecha::text, SUM(cantidad) as total
       FROM produccion
       WHERE fecha BETWEEN $1 AND $2
       GROUP BY fecha ORDER BY fecha`,
      [startDate, endDate]
    );

    const ingresos = parseFloat(ingresosResult.rows[0]?.ingresos) || 0;
    const utilidadNeta = ingresos - totalGastos;

    res.json({
      mes: mesStr,
      produccion: produccionResult.rows[0],
      ingresos: parseFloat(ingresosResult.rows[0]?.ingresos) || 0,
      cobrado: parseFloat(ingresosResult.rows[0]?.cobrado) || 0,
      pendiente: parseFloat(ingresosResult.rows[0]?.pendiente) || 0,
      gastos: gastosResult.rows,
      totalGastos,
      utilidadNeta,
      topClientes: topClientesResult.rows,
      produccionDiaria: produccionDiariaResult.rows
    });
  } catch (error) {
    console.error('Error en /dashboard/monthly:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;
