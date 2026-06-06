import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateJWT, requireWriteAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// Listar todos los artículos activos
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM articulos WHERE is_active = true ORDER BY nombre'
    );
    res.json({ articulos: result.rows });
  } catch (error) {
    console.error('Error en GET /articulos:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Crear un nuevo artículo
router.post('/', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { nombre, precio_unitario } = req.body;

    if (!nombre) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }

    const precio = parseFloat(precio_unitario) || 0;
    if (precio < 0) {
      return res.status(400).json({ message: 'El precio no puede ser negativo' });
    }

    const result = await query(
      `INSERT INTO articulos (nombre, precio_unitario)
       VALUES ($1, $2)
       RETURNING *`,
      [nombre, precio]
    );

    res.status(201).json({ articulo: result.rows[0] });
  } catch (error: any) {
    console.error('Error en POST /articulos:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ message: 'Ya existe un artículo con ese nombre' });
    }
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Actualizar un artículo
router.put('/:id', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, precio_unitario, is_active } = req.body;

    // Verificar si existe
    const checkExist = await query('SELECT * FROM articulos WHERE id = $1', [id]);
    if (checkExist.rows.length === 0) {
      return res.status(404).json({ message: 'Artículo no encontrado' });
    }

    const activeStatus = is_active !== undefined ? is_active : checkExist.rows[0].is_active;
    const currentPrecio = precio_unitario !== undefined ? parseFloat(precio_unitario) : checkExist.rows[0].precio_unitario;

    if (currentPrecio < 0) {
      return res.status(400).json({ message: 'El precio no puede ser negativo' });
    }

    const result = await query(
      `UPDATE articulos 
       SET nombre = COALESCE($1, nombre),
           precio_unitario = $2,
           is_active = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 
       RETURNING *`,
      [nombre || null, currentPrecio, activeStatus, id]
    );

    res.json({ articulo: result.rows[0] });
  } catch (error: any) {
    console.error('Error en PUT /articulos:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ message: 'Ya existe otro artículo con ese nombre' });
    }
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Eliminar un artículo (marcar como inactivo)
router.delete('/:id', requireWriteAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE articulos SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Artículo no encontrado' });
    }

    res.json({ message: 'Artículo eliminado de forma lógica', articulo: result.rows[0] });
  } catch (error) {
    console.error('Error en DELETE /articulos:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;
