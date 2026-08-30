-- ============================================================
-- Agrega el descuento global (10/20/30%) que el vendedor aplica
-- sobre el total completo de la venta antes de concluirla —
-- independiente del descuento por promoción 4x3 que ya se maneja
-- por línea en detalles_ventas.descuento_aplicado. Ambos son
-- acumulables: `total` en `ventas` queda con los dos ya aplicados.
-- Necesaria para bases de datos creadas antes de este cambio;
-- 001_schema.sql ya la incluye para instalaciones nuevas.
-- ============================================================

SET @col_existe := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'descuento_porcentaje'
);

SET @sql := IF(
  @col_existe = 0,
  'ALTER TABLE ventas
     ADD COLUMN descuento_porcentaje TINYINT UNSIGNED DEFAULT NULL AFTER total,
     ADD COLUMN descuento_monto DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER descuento_porcentaje',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
