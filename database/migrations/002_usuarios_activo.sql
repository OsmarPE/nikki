-- ============================================================
-- Agrega la columna `activo` a usuarios (para desactivar cuentas
-- sin borrar su historial de ventas / movimientos de inventario).
-- Necesaria para bases de datos creadas antes de este cambio;
-- 001_schema.sql ya la incluye para instalaciones nuevas.
-- ============================================================

SET @col_existe := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'activo'
);

SET @sql := IF(
  @col_existe = 0,
  'ALTER TABLE usuarios ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1 AFTER rol',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
