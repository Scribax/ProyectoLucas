-- ============================================
-- FIX: Saldo duplicado (x2) en clientes
-- ============================================
-- Problema: los triggers trigger_actualizar_saldo_venta y trigger_procesar_pago
-- actualizaban clientes.saldo automáticamente, pero el backend también lo hacía
-- manualmente, resultando en saldo x2 para todos los clientes.
--
-- Solución: se desactivan los triggers y toda la lógica queda en el backend,
-- que ya tiene validaciones más robustas (GREATEST, transacciones, etc.)
-- ============================================

-- Deshabilitar trigger que duplicaba saldo al crear/modificar ventas
DROP TRIGGER IF EXISTS trigger_actualizar_saldo_venta ON ventas;

-- Deshabilitar trigger que duplicaba saldo al insertar pagos
DROP TRIGGER IF EXISTS trigger_procesar_pago ON pagos;

-- ============================================
-- CORRECCIÓN DE DATOS EXISTENTES
-- Recalcula el saldo real de cada cliente
-- sumando los saldos de sus ventas activas
-- ============================================
UPDATE clientes c
SET saldo = COALESCE((
  SELECT SUM(v.saldo)
  FROM ventas v
  WHERE v.cliente_id = c.id
    AND v.is_void = false
), 0);
