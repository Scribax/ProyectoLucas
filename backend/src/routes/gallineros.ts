import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateJWT, requireRole, requireWriteAccess } from '../middleware/auth';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateJWT);

// Obtener todos los gallineros
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT g.*, 
        COALESCE(SUM(p.cantidad), 0) as produccion_hoy
      FROM gallineros g
      LEFT JOIN produccion p ON g.id = p.gallinero_id AND p.fecha = CURRENT_DATE
      WHERE g.status = 'activo'
      GROUP BY g.id
      ORDER BY g.name`,
      []
    );
    res.json({ gallineros: result.rows });
  } catch (error) {
    console.error('Error al obtener gallineros:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener un gallinero específico con su historial de producción
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Datos del gallinero
    const gallineroResult = await query('SELECT * FROM gallineros WHERE id = $1', [id]);
    
    if (gallineroResult.rows.length === 0) {
      return res.status(404).json({ message: 'Gallinero no encontrado' });
    }

    // Producción de los últimos 30 días
    const produccionResult = await query(
      `SELECT 
        fecha,
        SUM(CASE WHEN size = 'S' THEN cantidad ELSE 0 END) as huevos_s,
        SUM(CASE WHEN size = 'M' THEN cantidad ELSE 0 END) as huevos_m,
        SUM(CASE WHEN size = 'L' THEN cantidad ELSE 0 END) as huevos_l,
        SUM(CASE WHEN size = 'XL' THEN cantidad ELSE 0 END) as huevos_xl,
        SUM(cantidad) as total
      FROM produccion
      WHERE gallinero_id = $1 AND fecha >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY fecha
      ORDER BY fecha DESC`,
      [id]
    );

    res.json({
      gallinero: gallineroResult.rows[0],
      produccion: produccionResult.rows
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Crear nuevo gallinero (solo admin)
router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, description, chicken_count } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }

    const result = await query(
      'INSERT INTO gallineros (name, description, chicken_count) VALUES ($1, $2, $3) RETURNING *',
      [name, description || '', chicken_count || 0]
    );

    // Registrar en auditoría
    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user!.id, 'CREATE', 'gallinero', result.rows[0].id, JSON.stringify({ name })]
    );

    res.status(201).json({ gallinero: result.rows[0] });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Actualizar gallinero (solo admin)
router.put('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, chicken_count, status } = req.body;

    const result = await query(
      `UPDATE gallineros 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           chicken_count = COALESCE($3, chicken_count),
           status = COALESCE($4, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [name, description, chicken_count, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Gallinero no encontrado' });
    }

    // Registrar en auditoría
    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user!.id, 'UPDATE', 'gallinero', id, JSON.stringify({ name, status })]
    );

    res.json({ gallinero: result.rows[0] });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Eliminar gallinero (solo admin) - En realidad lo desactiva
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE gallineros SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['inactivo', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Gallinero no encontrado' });
    }

    // Registrar en auditoría
    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user!.id, 'DELETE', 'gallinero', id, JSON.stringify({ name: result.rows[0].name })]
    );

    res.json({ message: 'Gallinero eliminado' });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Registrar producción diaria (admin o empleado)
router.post('/:id/produccion', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fecha, produccion } = req.body; // produccion: { S: 10, M: 20, L: 30, XL: 5 }

    if (!produccion || typeof produccion !== 'object') {
      return res.status(400).json({ message: 'Datos de producción inválidos' });
    }

    // Verificar que el gallinero existe
    const gallineroResult = await query('SELECT * FROM gallineros WHERE id = $1', [id]);
    if (gallineroResult.rows.length === 0) {
      return res.status(404).json({ message: 'Gallinero no encontrado' });
    }

    const fechaProduccion = fecha || new Date().toISOString().split('T')[0];
    const items = [];

    // Insertar cada tamaño usando UPSERT (INSERT ... ON CONFLICT DO UPDATE)
    for (const [size, cantidad] of Object.entries(produccion)) {
      const cantNum = parseInt(String(cantidad)) || 0;
      if (cantNum < 0) continue; // ignorar negativos

      if (cantNum === 0) {
        // Si pone 0, eliminar el registro si existe (no guardar ceros)
        await query(
          `DELETE FROM produccion WHERE gallinero_id = $1 AND fecha = $2 AND size = $3`,
          [id, fechaProduccion, size]
        );
      } else {
        const result = await query(
          `INSERT INTO produccion (gallinero_id, fecha, size, cantidad, created_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (gallinero_id, fecha, size)
           DO UPDATE SET cantidad = EXCLUDED.cantidad, updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [id, fechaProduccion, size, cantNum, req.user!.id]
        );
        items.push(result.rows[0]);
      }
    }

    res.status(201).json({
      message: 'Producción registrada',
      produccion: items
    });

  } catch (error: any) {
    console.error('Error en POST /gallineros/:id/produccion:', error?.message || error);
    res.status(500).json({ message: error?.message || 'Error del servidor' });
  }
});


export default router;
