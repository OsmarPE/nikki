-- ============================================================
-- Permisos granulares por módulo (ver/crear/editar/eliminar) para
-- usuarios con rol "vendedor". Los administradores siempre tienen
-- acceso total y no dependen de esta tabla.
-- CREATE TABLE IF NOT EXISTS ya es idempotente; 001_schema.sql
-- también la incluye para instalaciones nuevas.
-- ============================================================
CREATE TABLE IF NOT EXISTS permisos_usuario (
  id         INT          NOT NULL AUTO_INCREMENT,
  usuario_id INT          NOT NULL,
  modulo     VARCHAR(50)  NOT NULL,
  ver        TINYINT(1)   NOT NULL DEFAULT 0,
  crear      TINYINT(1)   NOT NULL DEFAULT 0,
  editar     TINYINT(1)   NOT NULL DEFAULT 0,
  eliminar   TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permisos_usuario_modulo (usuario_id, modulo),
  CONSTRAINT fk_permisos_usuario_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
