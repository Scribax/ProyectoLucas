import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { initDB, query } from './db-json';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'granja-secret';

// Inicializar base de datos JSON
initDB();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// JWT helpers
const generateToken = (user: any) => jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

const authenticateJWT = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// ========== AUTH ==========
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
  }

  const user = query.findUserByUsername(username);
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Credenciales incorrectas' });
  }

  const token = generateToken({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });

  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
});

app.get('/api/auth/me', authenticateJWT, (req: any, res: Response) => {
  const user = query.findUserById(req.user.id);
  res.json({ user: user ? { id: user.id, username: user.username, name: user.name, role: user.role } : null });
});

// ========== GALLINEROS ==========
app.get('/api/gallineros', authenticateJWT, (req: Request, res: Response) => {
  const hoy = new Date().toISOString().split('T')[0];
  const gallineros = query.getAllGallineros().map((g: any) => {
    const prodHoy = query.getProduccionByDate(hoy).filter((p: any) => p.gallinero_id === g.id);
    const totalHoy = prodHoy.reduce((sum: number, p: any) => sum + p.S + p.M + p.L + p.XL, 0);
    return { ...g, produccion_hoy: totalHoy };
  });
  res.json({ gallineros });
});

app.post('/api/gallineros', authenticateJWT, (req: Request, res: Response) => {
  const { name, description, chicken_count } = req.body;
  const gallinero = query.insertGallinero({
    id: crypto.randomUUID(),
    name,
    description,
    chicken_count: chicken_count || 0,
    status: 'active',
    created_at: new Date().toISOString(),
  });
  res.status(201).json(gallinero);
});

app.put('/api/gallineros/:id', authenticateJWT, (req: Request, res: Response) => {
  const { name, description, chicken_count } = req.body;
  query.updateGallinero(req.params.id, { name, description, chicken_count });
  res.json({ message: 'Actualizado' });
});

app.delete('/api/gallineros/:id', authenticateJWT, (req: Request, res: Response) => {
  query.deleteGallinero(req.params.id);
  res.json({ message: 'Eliminado' });
});

// ========== PRODUCCIÓN ==========
app.get('/api/produccion', authenticateJWT, (req: Request, res: Response) => {
  const { fecha } = req.query;
  const produccion = fecha 
    ? query.getProduccionByDate(fecha as string)
    : query.getProduccionLast7Days();
  res.json({ produccion });
});

app.post('/api/gallineros/:id/produccion', authenticateJWT, (req: Request, res: Response) => {
  const { fecha, produccion: prod } = req.body;
  query.insertProduccion({
    id: crypto.randomUUID(),
    gallinero_id: req.params.id,
    fecha,
    S: prod.S || 0,
    M: prod.M || 0,
    L: prod.L || 0,
    XL: prod.XL || 0,
    created_at: new Date().toISOString(),
  });
  res.status(201).json({ message: 'Producción registrada' });
});

// ========== CLIENTES ==========
app.get('/api/clientes', authenticateJWT, (req: Request, res: Response) => {
  res.json({ clientes: query.getAllClientes() });
});

app.post('/api/clientes', authenticateJWT, (req: Request, res: Response) => {
  const { nombre, telefono, direccion, observaciones } = req.body;
  const cliente = query.insertCliente({
    id: crypto.randomUUID(),
    nombre,
    telefono,
    direccion,
    observaciones,
    saldo: 0,
    created_at: new Date().toISOString(),
  });
  res.status(201).json(cliente);
});

app.put('/api/clientes/:id', authenticateJWT, (req: Request, res: Response) => {
  const { nombre, telefono, direccion, observaciones } = req.body;
  query.updateCliente(req.params.id, { nombre, telefono, direccion, observaciones });
  res.json({ message: 'Actualizado' });
});

app.get('/api/clientes/:id', authenticateJWT, (req: Request, res: Response) => {
  const cliente = query.findClienteById(req.params.id);
  if (!cliente) {
    return res.status(404).json({ message: 'Cliente no encontrado' });
  }
  // Obtener ventas del cliente
  const ventas = query.getAllVentas().filter((v: any) => v.cliente_id === req.params.id);
  res.json({ cliente, ventas });
});

app.post('/api/clientes/:id/pagos', authenticateJWT, (req: Request, res: Response) => {
  const { monto, venta_id } = req.body;
  const cliente = query.findClienteById(req.params.id);

  if (!cliente) {
    return res.status(404).json({ message: 'Cliente no encontrado' });
  }

  if (!monto || monto <= 0) {
    return res.status(400).json({ message: 'Monto inválido' });
  }

  // Registrar pago
  query.insertPago({
    id: crypto.randomUUID(),
    cliente_id: req.params.id,
    venta_id: venta_id || null,
    monto,
    metodo: 'efectivo',
    fecha: new Date().toISOString(),
  });

  // Si hay venta específica, actualizar su saldo
  if (venta_id) {
    const venta = query.findVentaById(venta_id);
    if (venta) {
      const nuevoPagado = venta.pagado + monto;
      const nuevoSaldo = venta.total - nuevoPagado;
      const nuevoEstado = nuevoSaldo <= 0 ? 'pagada' : (nuevoPagado > 0 ? 'parcial' : 'fiada');
      query.updateVenta(venta_id, {
        pagado: nuevoPagado,
        saldo: Math.max(0, nuevoSaldo),
        estado: nuevoEstado,
      });
    }
  }

  // Actualizar saldo del cliente
  const nuevoSaldoCliente = Math.max(0, cliente.saldo - monto);
  query.updateClienteSaldo(req.params.id, nuevoSaldoCliente);

  res.status(201).json({
    message: 'Pago registrado',
    cliente: { ...cliente, saldo: nuevoSaldoCliente },
  });
});

// ========== VENTAS ==========
app.get('/api/ventas', authenticateJWT, (req: Request, res: Response) => {
  const ventas = query.getAllVentas().map((v: any) => ({
    ...v,
    cliente_nombre: query.findClienteById(v.cliente_id)?.nombre,
    items: query.getVentaItems(v.id),
  }));
  res.json({ ventas });
});

app.post('/api/ventas', authenticateJWT, (req: Request, res: Response) => {
  const { cliente_id, items, pagado, es_fiado } = req.body;
  const ventaId = crypto.randomUUID();
  const total = items.reduce((sum: number, item: any) => sum + (item.cantidad * item.precio_unitario), 0);
  const saldo = total - (pagado || 0);
  const estado = saldo <= 0 ? 'pagada' : (pagado > 0 ? 'parcial' : 'fiada');
  
  // Insertar venta
  const venta = query.insertVenta({
    id: ventaId,
    cliente_id,
    fecha: new Date().toISOString(),
    total,
    pagado: pagado || 0,
    saldo,
    estado,
    es_fiado: es_fiado ? 1 : 0,
  });
  
  // Insertar items
  items.forEach((item: any) => {
    query.insertVentaItem({
      id: crypto.randomUUID(),
      venta_id: ventaId,
      size: item.size,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      subtotal: item.cantidad * item.precio_unitario,
    });
  });
  
  // Actualizar saldo del cliente
  if (saldo > 0) {
    const cliente = query.findClienteById(cliente_id);
    if (cliente) {
      query.updateClienteSaldo(cliente_id, cliente.saldo + saldo);
    }
  }
  
  const ventaItems = query.getVentaItems(ventaId);
  const cliente = query.findClienteById(cliente_id);
  
  res.status(201).json({
    venta: {
      ...venta,
      cliente_nombre: cliente?.nombre,
      items: ventaItems,
    }
  });
});

// ========== DASHBOARD ==========
app.get('/api/dashboard/stats', authenticateJWT, (req: Request, res: Response) => {
  const hoy = new Date().toISOString().split('T')[0];
  
  // Producción hoy
  const prodHoy = query.getProduccionByDate(hoy);
  const produccionTotal = prodHoy.reduce((sum: number, p: any) => sum + p.S + p.M + p.L + p.XL, 0);
  
  // Ventas hoy
  const ventasHoy = query.getVentasByDate(hoy);
  const ventasTotal = ventasHoy.reduce((sum: number, v: any) => sum + v.total, 0);
  
  // Clientes con deuda
  const clientesDeuda = query.getAllClientes().filter((c: any) => c.saldo > 0);
  
  // Total gallineros activos
  const gallinerosCount = query.getAllGallineros().length;
  
  res.json({
    produccionHoy: produccionTotal,
    ventasHoy: ventasTotal,
    cantidadVentasHoy: ventasHoy.length,
    clientesConDeuda: clientesDeuda.length,
    gallinerosActivos: gallinerosCount,
    clientesDeudaList: clientesDeuda.slice(0, 5),
  });
});

app.get('/api/dashboard/chart-data', authenticateJWT, (req: Request, res: Response) => {
  // Producción últimos 7 días (simplificado)
  const produccion = query.getProduccionLast7Days().reduce((acc: any, p: any) => {
    const fecha = p.fecha;
    if (!acc[fecha]) acc[fecha] = { fecha, total: 0 };
    acc[fecha].total += p.S + p.M + p.L + p.XL;
    return acc;
  }, {});
  
  // Producción por gallinero
  const porGallinero = query.getAllGallineros().map((g: any) => ({
    name: g.name,
    total: query.getProduccionByDate(new Date().toISOString().split('T')[0])
      .filter((p: any) => p.gallinero_id === g.id)
      .reduce((sum: number, p: any) => sum + p.S + p.M + p.L + p.XL, 0),
  }));
  
  res.json({ 
    produccion: Object.values(produccion), 
    porGallinero 
  });
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error del servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 API listo para usar`);
  console.log(`🔑 Usuario: admin / Contraseña: admin123`);
});
