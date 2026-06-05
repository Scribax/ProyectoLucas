-- Crear tabla gastos si no existe
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

-- Índice para optimizar búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos(categoria);
