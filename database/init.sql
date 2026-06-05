-- ============================================
-- SISTEMA DE GESTIÓN AVÍCOLA - DATABASE SCHEMA
-- ============================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLA DE USUARIOS
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'empleado' CHECK (role IN ('admin', 'empleado', 'invitado')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA DE AUDITORÍA (LOG DE ACCIONES)
-- ============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA DE GALLINEROS
-- ============================================
CREATE TABLE gallineros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    chicken_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo', 'mantenimiento')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA DE PRODUCCIÓN (HUEVOS)
-- ============================================
CREATE TABLE produccion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gallinero_id UUID NOT NULL REFERENCES gallineros(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    size VARCHAR(2) NOT NULL CHECK (size IN ('S', 'M', 'L', 'XL')),
    cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA DE CLIENTES
-- ============================================
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    direccion TEXT,
    observaciones TEXT,
    saldo DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA DE VENTAS
-- ============================================
CREATE TABLE ventas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    pagado DECIMAL(12,2) DEFAULT 0,
    saldo DECIMAL(12,2) DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pagada', 'parcial', 'pendiente')),
    observaciones TEXT,
    invoice_generated BOOLEAN DEFAULT false,
    invoice_path VARCHAR(255),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA DE DETALLE DE VENTAS (ITEMS)
-- ============================================
CREATE TABLE venta_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    size VARCHAR(2) NOT NULL CHECK (size IN ('S', 'M', 'L', 'XL')),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA DE PAGOS (CUENTA CORRIENTE)
-- ============================================
CREATE TABLE pagos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    venta_id UUID REFERENCES ventas(id) ON DELETE SET NULL,
    monto DECIMAL(12,2) NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metodo VARCHAR(20) DEFAULT 'efectivo' CHECK (metodo IN ('efectivo', 'transferencia', 'tarjeta', 'cheque')),
    observaciones TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA DE GASTOS
-- ============================================
CREATE TABLE gastos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('alimento', 'cartones', 'transporte', 'medicamentos', 'mantenimiento', 'servicios', 'otros')),
    descripcion TEXT,
    monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================
CREATE INDEX idx_produccion_fecha ON produccion(fecha);
CREATE INDEX idx_produccion_gallinero ON produccion(gallinero_id);
CREATE INDEX idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX idx_ventas_fecha ON ventas(fecha);
CREATE INDEX idx_pagos_cliente ON pagos(cliente_id);
CREATE INDEX idx_gastos_fecha ON gastos(fecha);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ============================================
-- VISTAS PARA REPORTES
-- ============================================

-- Vista de producción diaria por gallinero
CREATE VIEW produccion_diaria AS
SELECT 
    fecha,
    gallinero_id,
    g.name as gallinero_name,
    SUM(CASE WHEN size = 'S' THEN cantidad ELSE 0 END) as huevos_s,
    SUM(CASE WHEN size = 'M' THEN cantidad ELSE 0 END) as huevos_m,
    SUM(CASE WHEN size = 'L' THEN cantidad ELSE 0 END) as huevos_l,
    SUM(CASE WHEN size = 'XL' THEN cantidad ELSE 0 END) as huevos_xl,
    SUM(cantidad) as total_huevos
FROM produccion p
JOIN gallineros g ON p.gallinero_id = g.id
GROUP BY fecha, gallinero_id, g.name;

-- Vista de ventas con detalle de cliente
CREATE VIEW ventas_cliente AS
SELECT 
    v.id,
    v.cliente_id,
    c.nombre as cliente_nombre,
    c.telefono as cliente_telefono,
    v.fecha,
    v.total,
    v.pagado,
    v.saldo,
    v.estado,
    v.observaciones
FROM ventas v
JOIN clientes c ON v.cliente_id = c.id;

-- ============================================
-- FUNCIONES ÚTILES
-- ============================================

-- Función para actualizar saldo de cliente
CREATE OR REPLACE FUNCTION actualizar_saldo_cliente()
RETURNS TRIGGER AS $$
BEGIN
    -- Si es una venta nueva
    IF TG_OP = 'INSERT' THEN
        UPDATE clientes SET saldo = saldo + NEW.saldo WHERE id = NEW.cliente_id;
    -- Si es actualización de venta
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE clientes SET saldo = saldo - OLD.saldo + NEW.saldo WHERE id = NEW.cliente_id;
    -- Si se elimina
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE clientes SET saldo = saldo - OLD.saldo WHERE id = OLD.cliente_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar saldo automáticamente
CREATE TRIGGER trigger_actualizar_saldo_venta
AFTER INSERT OR UPDATE OR DELETE ON ventas
FOR EACH ROW
EXECUTE FUNCTION actualizar_saldo_cliente();

-- Trigger para actualizar saldo de cliente cuando hay pago
CREATE OR REPLACE FUNCTION procesar_pago_cliente()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar saldo del cliente
    UPDATE clientes SET saldo = saldo - NEW.monto WHERE id = NEW.cliente_id;
    
    -- Si el pago está asociado a una venta específica
    IF NEW.venta_id IS NOT NULL THEN
        UPDATE ventas 
        SET pagado = pagado + NEW.monto,
            saldo = saldo - NEW.monto,
            estado = CASE 
                WHEN (saldo - NEW.monto) <= 0 THEN 'pagada'
                ELSE 'parcial'
            END
        WHERE id = NEW.venta_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_procesar_pago
AFTER INSERT ON pagos
FOR EACH ROW
EXECUTE FUNCTION procesar_pago_cliente();

-- ============================================
-- DATOS DE PRUEBA (Opcional, para desarrollo)
-- ============================================

-- Usuario admin por defecto (password: admin123)
INSERT INTO users (username, email, password_hash, name, role) VALUES 
('admin', 'admin@granja.com', '$2b$10$YourHashedPasswordHere', 'Administrador', 'admin');

-- Gallineros de ejemplo
INSERT INTO gallineros (name, description, chicken_count, status) VALUES 
('Gallinero 1', 'Gallinero principal con gallinas ponedoras', 150, 'activo'),
('Gallinero 2', 'Segundo galpón, gallinas jóvenes', 120, 'activo'),
('Gallinero 3', 'Gallinas en recuperación', 80, 'activo');

-- Clientes de ejemplo
INSERT INTO clientes (nombre, telefono, direccion, observaciones) VALUES 
('Juan Pérez', '11-1234-5678', 'Calle Falsa 123', 'Cliente habitual'),
('María González', '11-8765-4321', 'Av. Principal 456', 'Paga semanalmente'),
('Supermercado La Esquina', '11-5555-9999', 'Av. Comercial 789', 'Mayorista, pago a 30 días');

