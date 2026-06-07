import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config();

// Importar rutas
import authRoutes from './routes/auth';
import gallinerosRoutes from './routes/gallineros';
import clientesRoutes from './routes/clientes';
import ventasRoutes from './routes/ventas';
import dashboardRoutes from './routes/dashboard';
import gastosRoutes from './routes/gastos';
import articulosRoutes from './routes/articulos';
import produccionRoutes from './routes/produccion';

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  message: 'Demasiadas peticiones, intente más tarde'
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['http://localhost', 'https://localhost', 'https://donlucasproyect.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(limiter);

// Directorios estáticos
app.use('/invoices', express.static(path.join(__dirname, '../invoices')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/gallineros', gallinerosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/articulos', articulosRoutes);
app.use('/api/produccion', produccionRoutes);

// Error 404
app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: process.env.NODE_ENV === 'production' 
      ? 'Error del servidor' 
      : err.message 
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 API corriendo en puerto ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
