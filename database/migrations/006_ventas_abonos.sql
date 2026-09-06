-- ============================================================
-- Ventas a crédito (abonos): una venta puede quedar parcialmente
-- pagada y cobrarse en varias exhibiciones. `ventas.metodo_pago`
-- deja de ser obligatorio (una venta a crédito recién creada sin
-- abono inicial no tiene método propio — cada abono trae el suyo).
-- El saldo pendiente NO se guarda como columna: se calcula siempre
-- como total - SUM(abonos.monto) para evitar desincronización.
-- ============================================================

SET @col_existe := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'tipo_venta'
);

SET @sql := IF(
  @col_existe = 0,
  'ALTER TABLE ventas
     ADD COLUMN tipo_venta ENUM(''contado'',''credito'') NOT NULL DEFAULT ''contado'' AFTER sesion_caja_id',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE ventas MODIFY metodo_pago ENUM('efectivo','transferencia','tarjeta') DEFAULT NULL;

-- ------------------------------------------------------------
-- abonos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abonos (
  id             INT            NOT NULL AUTO_INCREMENT,
  venta_id       INT            NOT NULL,
  monto          DECIMAL(10,2)  NOT NULL,
  metodo_pago    ENUM('efectivo','transferencia','tarjeta') NOT NULL,
  usuario_id     INT            NOT NULL,
  sesion_caja_id INT            NOT NULL,
  creado_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_abonos_venta   (venta_id),
  KEY idx_abonos_sesion  (sesion_caja_id),
  CONSTRAINT fk_abonos_venta    FOREIGN KEY (venta_id)       REFERENCES ventas       (id),
  CONSTRAINT fk_abonos_usuario  FOREIGN KEY (usuario_id)     REFERENCES usuarios     (id),
  CONSTRAINT fk_abonos_sesion   FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
