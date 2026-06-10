-- FIX: agregar 'anulada' a los valores permitidos en ventas.estado
-- El constraint original solo tenía: 'pagada', 'parcial', 'pendiente'
-- Al anular una venta el backend intenta poner estado = 'anulada' y falla

ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_estado_check;

ALTER TABLE ventas ADD CONSTRAINT ventas_estado_check
  CHECK (estado IN ('pagada', 'parcial', 'pendiente', 'anulada'));
