import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../config/database';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Login
router.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
    }

    // Buscar usuario
    const user = queryOne('SELECT * FROM users WHERE username = ? AND active = 1', [username]);

    if (!user) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    // Verificar contraseña
    const isValidPassword = bcrypt.compareSync(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    // Generar token
    const token = generateToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });

    // Registrar en auditoría
    query('INSERT INTO auditoria (id, tabla, accion, registro_id, user_id) VALUES (?, ?, ?, ?, ?)', [
      crypto.randomUUID(), 'users', 'LOGIN', user.id, user.id
    ]);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener usuario actual
router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const user = queryOne('SELECT id, username, name, role, created_at FROM users WHERE id = ?', [req.user!.id]);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;
