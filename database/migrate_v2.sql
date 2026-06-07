-- ============================================
-- MIGRACIÓN v2 - Correcciones y nuevas features
-- ============================================

-- 1. Agregar columnas faltantes a ventas
ALTER TABLE ventas 
  ADD COLUMN IF NOT EXISTS saldo_anterior DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_acumulado DECIMAL(12,2) DEFAULT 0;

-- 2. Hacer nullable la columna size en venta_items (para artículos que no son huevos)
ALTER TABLE venta_items ALTER COLUMN size DROP NOT NULL;

-- 3. Agregar columnas articulo_id y descripcion a venta_items si no existen
ALTER TABLE venta_items 
  ADD COLUMN IF NOT EXISTS articulo_id UUID REFERENCES articulos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- 4. Actualizar el CHECK constraint de size para aceptar NULL
ALTER TABLE venta_items DROP CONSTRAINT IF EXISTS venta_items_size_check;
ALTER TABLE venta_items ADD CONSTRAINT venta_items_size_check 
  CHECK (size IS NULL OR size IN ('S', 'M', 'L', 'XL'));

-- 5. Crear tabla articulos si no existe (por si acaso)
CREATE TABLE IF NOT EXISTS articulos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Verificar que la tabla gastos existe con todos sus campos
CREATE TABLE IF NOT EXISTS gastos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('alimento', 'cartones', 'transporte', 'medicamentos', 'mantenimiento', 'servicios', 'otros')),
    descripcion TEXT,
    monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_articulos_nombre ON articulos(nombre);
