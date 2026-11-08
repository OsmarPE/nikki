-- ============================================================
-- ventas.ultimo_abono: fecha del abono más reciente de la venta.
-- Sirve para mostrar en la lista de Ventas cuándo se liquidó (o se
-- abonó por última vez) un apartado, y ordenar por última actividad.
--
-- Lo mantienen TRIGGERS sobre `abonos` (insertar, editar, borrar),
-- no el código de la app: así queda correcto sin importar desde dónde
-- se registre, corrija o cancele un abono. Siempre se recalcula como
-- MAX(abonos.creado_at) de la venta (NULL si ya no tiene abonos), igual
-- que el saldo, que sigue sin guardarse (total - SUM(abonos.monto)).
--
-- Idempotente: se puede volver a correr sin efectos duplicados.
-- ============================================================

SET @col_existe := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'ultimo_abono'
);

SET @sql := IF(
  @col_existe = 0,
  'ALTER TABLE ventas ADD COLUMN ultimo_abono TIMESTAMP NULL DEFAULT NULL AFTER creado_at',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Llenar las ventas que ya existen.
UPDATE ventas v
SET v.ultimo_abono = (SELECT MAX(a.creado_at) FROM abonos a WHERE a.venta_id = v.id);

-- ------------------------------------------------------------
-- Triggers (una sola sentencia cada uno: no requieren DELIMITER)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_abonos_ultimo_abono_insert;
CREATE TRIGGER trg_abonos_ultimo_abono_insert
AFTER INSERT ON abonos
FOR EACH ROW
  UPDATE ventas
  SET ultimo_abono = (SELECT MAX(a.creado_at) FROM abonos a WHERE a.venta_id = NEW.venta_id)
  WHERE id = NEW.venta_id;

-- Al editar se recalculan la venta anterior y la nueva (por si el abono
-- se movió de venta) y también si cambió su fecha.
DROP TRIGGER IF EXISTS trg_abonos_ultimo_abono_update;
CREATE TRIGGER trg_abonos_ultimo_abono_update
AFTER UPDATE ON abonos
FOR EACH ROW
  UPDATE ventas v
  SET v.ultimo_abono = (SELECT MAX(a.creado_at) FROM abonos a WHERE a.venta_id = v.id)
  WHERE v.id IN (OLD.venta_id, NEW.venta_id);

DROP TRIGGER IF EXISTS trg_abonos_ultimo_abono_delete;
CREATE TRIGGER trg_abonos_ultimo_abono_delete
AFTER DELETE ON abonos
FOR EACH ROW
  UPDATE ventas
  SET ultimo_abono = (SELECT MAX(a.creado_at) FROM abonos a WHERE a.venta_id = OLD.venta_id)
  WHERE id = OLD.venta_id;
