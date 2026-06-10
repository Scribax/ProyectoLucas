-- FIX: sincronizar ventas.pagado y ventas.saldo con la suma real de pagos
-- Problema: el trigger trigger_procesar_pago y el backend actualizaban
-- ventas.pagado en simultáneo, dejando el campo inflado en ventas históricas.

UPDATE ventas v
SET
  pagado = pagos_reales.total_pagado,
  saldo  = GREATEST(v.total - pagos_reales.total_pagado, 0),
  estado = CASE
    WHEN GREATEST(v.total - pagos_reales.total_pagado, 0) <= 0 THEN 'pagada'
    WHEN pagos_reales.total_pagado > 0 THEN 'parcial'
    ELSE 'pendiente'
  END
FROM (
  SELECT venta_id, COALESCE(SUM(monto), 0) AS total_pagado
  FROM pagos
  GROUP BY venta_id
) AS pagos_reales
WHERE v.id = pagos_reales.venta_id
  AND v.is_void = false
  AND v.pagado <> pagos_reales.total_pagado;

-- También corregir ventas sin ningún pago registrado (pagado debería ser 0)
UPDATE ventas
SET
  pagado = 0,
  saldo  = total,
  estado = 'pendiente'
WHERE is_void = false
  AND pagado > 0
  AND id NOT IN (SELECT DISTINCT venta_id FROM pagos WHERE venta_id IS NOT NULL);

-- Recalcular saldo de clientes a partir de ventas corregidas
UPDATE clientes c
SET saldo = COALESCE((
  SELECT SUM(v.saldo)
  FROM ventas v
  WHERE v.cliente_id = c.id
    AND v.is_void = false
), 0);
