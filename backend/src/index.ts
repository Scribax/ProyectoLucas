import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { query } from './config/database';

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
import notificacionesRoutes from './routes/notificaciones';

const app = express();
const PORT = process.env.PORT || 3001;

// Estamos detrás de nginx (1 proxy). Sin esto, express-rate-limit ve la IP del
// proxy para TODOS los usuarios y comparten el mismo cupo → "Demasiadas
// peticiones" apenas se usa la app. Con trust proxy usa X-Forwarded-For real.
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requests por IP (un dashboard dispara varias llamadas a la vez)
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas peticiones, intente más tarde' },
  // No limitar el health check (lo consulta el monitoreo / docker)
  skip: (req) => req.path === '/health',
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['http://localhost', 'https://localhost', 'https://donlucasproyect.com', 'https://www.donlucasproyect.com']
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
app.use('/api/notificaciones', notificacionesRoutes);

/**
 * Aplica de forma idempotente todas las migraciones de esquema y la corrección
 * de datos en cada arranque. Esto reemplaza tener que correr los fix_*.sql a
 * mano en el VPS: el estado de la base queda determinista después de cada deploy.
 *
 * IMPORTANTE: el saldo de los clientes es responsabilidad EXCLUSIVA del backend
 * (ver recalcularSaldoCliente). Por eso aquí se eliminan los triggers de Postgres
 * que históricamente actualizaban clientes.saldo y ventas.pagado en paralelo y
 * causaban el "saldo x2" y los descuadres.
 */
const ensureSchema = async () => {
  // --- Columnas para anulación de ventas (soft void) ---
  await query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS is_void BOOLEAN NOT NULL DEFAULT false`);
  await query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE`);
  await query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS voided_by UUID`);
  await query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS void_reason TEXT`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ventas_is_void ON ventas(is_void)`);

  // --- Columnas de saldo acumulado por venta (migrate_v2) ---
  await query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS saldo_anterior DECIMAL(12,2) DEFAULT 0`);
  await query(`ALTER TABLE ventas ADD COLUMN IF NOT EXISTS saldo_acumulado DECIMAL(12,2) DEFAULT 0`);

  // --- Historial de recordatorios de cobro por WhatsApp/manual ---
  await query(`CREATE TABLE IF NOT EXISTS notificaciones_cobro (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    venta_id UUID NOT NULL REFERENCES ventas(id),
    telefono VARCHAR(30) NOT NULL,
    mensaje TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    proveedor VARCHAR(30),
    proveedor_message_id TEXT,
    error TEXT,
    enviado_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notificaciones_cobro_venta ON notificaciones_cobro(venta_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notificaciones_cobro_cliente ON notificaciones_cobro(cliente_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notificaciones_cobro_estado ON notificaciones_cobro(estado)`);

  // --- Tabla articulos (puede no existir en bases viejas) ---
  await query(`CREATE TABLE IF NOT EXISTS articulos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`);

  // --- venta_items: artículos no-huevo (size nullable + articulo_id + descripcion) ---
  await query(`ALTER TABLE venta_items ALTER COLUMN size DROP NOT NULL`);
  await query(`ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS articulo_id UUID REFERENCES articulos(id) ON DELETE SET NULL`);
  await query(`ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS descripcion TEXT`);
  await query(`ALTER TABLE venta_items DROP CONSTRAINT IF EXISTS venta_items_size_check`);
  await query(`ALTER TABLE venta_items ADD CONSTRAINT venta_items_size_check
    CHECK (size IS NULL OR size IN ('S', 'M', 'L', 'XL'))`);

  // --- Estado 'anulada' permitido en ventas.estado ---
  await query(`ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_estado_check`);
  await query(`ALTER TABLE ventas ADD CONSTRAINT ventas_estado_check
    CHECK (estado IN ('pagada', 'parcial', 'pendiente', 'anulada'))`);

  // --- Eliminar triggers de saldo: el backend es la única fuente de verdad ---
  // (si quedaran activos, el saldo se contaría doble respecto del recálculo del backend)
  await query(`DROP TRIGGER IF EXISTS trigger_actualizar_saldo_venta ON ventas`);
  await query(`DROP TRIGGER IF EXISTS trigger_procesar_pago ON pagos`);

  // --- Corrección de datos: recalcular saldo de TODOS los clientes con la
  //     fórmula canónica (total facturado no anulado - pagos válidos). ---
  await query(`
    UPDATE clientes c
    SET saldo = GREATEST(
          COALESCE((
            SELECT SUM(v.total) FROM ventas v
            WHERE v.cliente_id = c.id AND v.is_void = false
          ), 0)
          - COALESCE((
            SELECT SUM(p.monto) FROM pagos p
            LEFT JOIN ventas v ON p.venta_id = v.id
            WHERE p.cliente_id = c.id
              AND (p.venta_id IS NULL OR v.is_void = false)
          ), 0),
          0
        ),
        updated_at = CURRENT_TIMESTAMP
  `);

  // --- Corrección de datos: re-sincronizar ventas.pagado/saldo/estado con la
  //     suma real de pagos de cada venta no anulada. ---
  await query(`
    UPDATE ventas v
    SET pagado = COALESCE(pr.total_pagado, 0),
        saldo  = GREATEST(v.total - COALESCE(pr.total_pagado, 0), 0),
        estado = CASE
          WHEN GREATEST(v.total - COALESCE(pr.total_pagado, 0), 0) <= 0 THEN 'pagada'
          WHEN COALESCE(pr.total_pagado, 0) > 0 THEN 'parcial'
          ELSE 'pendiente'
        END
    FROM (
      SELECT venta_id, SUM(monto) AS total_pagado
      FROM pagos WHERE venta_id IS NOT NULL GROUP BY venta_id
    ) pr
    WHERE v.id = pr.venta_id AND v.is_void = false
  `);

  // Ventas no anuladas sin ningún pago asociado: pagado debe ser 0.
  await query(`
    UPDATE ventas v
    SET pagado = 0, saldo = v.total, estado = 'pendiente'
    WHERE v.is_void = false
      AND v.pagado <> 0
      AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.venta_id = v.id)
  `);
};

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

const start = async () => {
  await ensureSchema();
  app.listen(PORT, () => {
    console.log(`🚀 API corriendo en puerto ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

start().catch((err) => {
  console.error('Error iniciando servidor:', err);
  process.exit(1);
});
