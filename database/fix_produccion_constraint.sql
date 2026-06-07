-- =======================================================
-- MIGRACIÓN: CORRECCIÓN DE CONSTRAINT EN TABLA PRODUCCION
-- =======================================================

-- 1. Eliminar duplicados si existen, dejando solo el registro más reciente (ID más alto/reciente)
DELETE FROM produccion a USING produccion b 
WHERE a.id < b.id 
  AND a.gallinero_id = b.gallinero_id 
  AND a.fecha = b.fecha 
  AND a.size = b.size;

-- 2. Agregar el constraint UNIQUE para permitir el ON CONFLICT UPSERT
ALTER TABLE produccion 
ADD CONSTRAINT unique_gallinero_fecha_size UNIQUE (gallinero_id, fecha, size);
