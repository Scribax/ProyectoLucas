-- =======================================================
-- MIGRACIÓN: CATÁLOGO DE ARTÍCULOS Y MEJORAS DE FACTURACIÓN
-- =======================================================

-- 1. Crear tabla de artículos
CREATE TABLE IF NOT EXISTS articulos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Modificar tabla de detalle de ventas (items)
-- Hacer 'size' nullable ya que los artículos no tienen tamaño
ALTER TABLE venta_items ALTER COLUMN size DROP NOT NULL;

-- Agregar referencia a articulos
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS articulo_id UUID REFERENCES articulos(id) ON DELETE SET NULL;

-- Agregar descripción textual del ítem
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS descripcion VARCHAR(100);

-- 3. Modificar tabla de ventas para almacenar histórico de saldos del cliente
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS saldo_anterior DECIMAL(12,2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS saldo_acumulado DECIMAL(12,2) DEFAULT 0;

-- 4. Insertar artículos por defecto para el catálogo
INSERT INTO articulos (nombre, precio_unitario) VALUES 
('Maple vacío (Cartón)', 150.00),
('Cajón de madera (Vacío)', 2500.00),
('Alimento Balanceado (Bolsa 25kg)', 8900.00),
('Medicamento Aviar (Frasco)', 3500.00)
ON CONFLICT (nombre) DO NOTHING;
