-- ============================================================
-- Sistema POS & Inventario — Migración inicial
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- usuarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT           NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(150)  NOT NULL,
  email         VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  rol           ENUM('admin','vendedor') NOT NULL DEFAULT 'vendedor',
  activo        TINYINT(1)    NOT NULL DEFAULT 1,
  creado_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- permisos_usuario  (permisos granulares por módulo para vendedores)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- clientes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id        INT          NOT NULL AUTO_INCREMENT,
  nombre    VARCHAR(150) NOT NULL,
  telefono  VARCHAR(30)  DEFAULT NULL,
  email     VARCHAR(255) DEFAULT NULL,
  creado_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- categorias
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id        INT          NOT NULL AUTO_INCREMENT,
  nombre    VARCHAR(100) NOT NULL,
  creado_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- marcas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marcas (
  id        INT          NOT NULL AUTO_INCREMENT,
  nombre    VARCHAR(100) NOT NULL,
  creado_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_marcas_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- colecciones  (soft delete via deleted_at)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS colecciones (
  id         INT          NOT NULL AUTO_INCREMENT,
  nombre     VARCHAR(100) NOT NULL,
  deleted_at TIMESTAMP    DEFAULT NULL,
  creado_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- productos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id               INT              NOT NULL AUTO_INCREMENT,
  sku              VARCHAR(100)     NOT NULL,
  nombre           VARCHAR(255)     NOT NULL,
  precio           DECIMAL(10,2)    NOT NULL,
  precio_descuento DECIMAL(10,2)    DEFAULT NULL,
  stock            INT              NOT NULL DEFAULT 0,
  descripcion      TEXT             DEFAULT NULL,
  imagen_url       VARCHAR(500)     DEFAULT NULL,
  categoria_id     INT              DEFAULT NULL,
  marca_id         INT              DEFAULT NULL,
  coleccion_id     INT              DEFAULT NULL,
  creado_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_productos_sku (sku),
  KEY idx_productos_categoria (categoria_id),
  KEY idx_productos_marca (marca_id),
  KEY idx_productos_coleccion (coleccion_id),
  CONSTRAINT fk_productos_categoria  FOREIGN KEY (categoria_id)  REFERENCES categorias (id) ON DELETE SET NULL,
  CONSTRAINT fk_productos_marca      FOREIGN KEY (marca_id)      REFERENCES marcas     (id) ON DELETE SET NULL,
  CONSTRAINT fk_productos_coleccion  FOREIGN KEY (coleccion_id)  REFERENCES colecciones(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- movimientos_inventario  (Kardex)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id          INT      NOT NULL AUTO_INCREMENT,
  producto_id INT      NOT NULL,
  tipo        ENUM('entrada','salida') NOT NULL,
  motivo      ENUM('venta','devolucion','compra','ajuste') NOT NULL,
  cantidad    INT      NOT NULL,
  usuario_id  INT      NOT NULL,
  referencia  VARCHAR(100) DEFAULT NULL,
  notas       TEXT         DEFAULT NULL,
  creado_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mov_producto  (producto_id),
  KEY idx_mov_usuario   (usuario_id),
  KEY idx_mov_creado_at (creado_at),
  CONSTRAINT fk_mov_producto FOREIGN KEY (producto_id) REFERENCES productos (id),
  CONSTRAINT fk_mov_usuario  FOREIGN KEY (usuario_id)  REFERENCES usuarios  (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- sesiones_caja
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sesiones_caja (
  id                    INT            NOT NULL AUTO_INCREMENT,
  usuario_id            INT            NOT NULL,
  fecha_apertura        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre          TIMESTAMP      DEFAULT NULL,
  saldo_inicial         DECIMAL(10,2)  NOT NULL,
  saldo_final_esperado  DECIMAL(10,2)  DEFAULT NULL,
  saldo_final_declarado DECIMAL(10,2)  DEFAULT NULL,
  diferencia            DECIMAL(10,2)  DEFAULT NULL,
  estado                ENUM('abierta','cerrada') NOT NULL DEFAULT 'abierta',
  PRIMARY KEY (id),
  KEY idx_sesiones_usuario (usuario_id),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- ventas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
  id             INT            NOT NULL AUTO_INCREMENT,
  folio          VARCHAR(50)    NOT NULL,
  cliente_id     INT            DEFAULT NULL,
  usuario_id     INT            NOT NULL,
  sesion_caja_id INT            NOT NULL,
  total          DECIMAL(10,2)  NOT NULL,
  metodo_pago    ENUM('efectivo','transferencia','tarjeta') NOT NULL,
  creado_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ventas_folio (folio),
  KEY idx_ventas_cliente   (cliente_id),
  KEY idx_ventas_usuario   (usuario_id),
  KEY idx_ventas_sesion    (sesion_caja_id),
  KEY idx_ventas_creado_at (creado_at),
  CONSTRAINT fk_ventas_cliente FOREIGN KEY (cliente_id)     REFERENCES clientes     (id) ON DELETE SET NULL,
  CONSTRAINT fk_ventas_usuario FOREIGN KEY (usuario_id)     REFERENCES usuarios     (id),
  CONSTRAINT fk_ventas_sesion  FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- detalles_ventas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalles_ventas (
  id                  INT            NOT NULL AUTO_INCREMENT,
  venta_id            INT            NOT NULL,
  producto_id         INT            NOT NULL,
  cantidad            INT            NOT NULL,
  precio_unitario     DECIMAL(10,2)  NOT NULL,
  descuento_aplicado  DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  subtotal            DECIMAL(10,2)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_det_venta    (venta_id),
  KEY idx_det_producto (producto_id),
  CONSTRAINT fk_det_venta    FOREIGN KEY (venta_id)    REFERENCES ventas   (id),
  CONSTRAINT fk_det_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
