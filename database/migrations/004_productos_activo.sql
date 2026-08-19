-- ============================================================
-- Agrega la columna `activo` a productos (para desactivar productos
-- descontinuados sin borrar su historial de ventas / movimientos
-- de inventario — antes, un producto con historial no podía
-- eliminarse y no había forma de "retirarlo" del catálogo).
-- Necesaria para bases de datos creadas antes de este cambio;
-- 001_schema.sql ya la incluye para instalaciones nuevas.
-- ============================================================

SET @col_existe := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'activo'
);

SET @sql := IF(
  @col_existe = 0,
  'ALTER TABLE productos ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1 AFTER coleccion_id',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
