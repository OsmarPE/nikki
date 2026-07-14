-- ============================================================
-- Población de datos falsos (Mock Data)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. usuarios
-- ------------------------------------------------------------
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES 
('Admin Principal', 'admin@tienda.com', '$2y$10$falsoHashDePruebaParaAdmin1234567890', 'admin'),
('Carlos Vendedor', 'carlos.v@tienda.com', '$2y$10$falsoHashDePruebaParaVendedor12345678', 'vendedor'),
('Laura Ventas', 'laura.v@tienda.com', '$2y$10$falsoHashDePruebaParaVendedora1234567', 'vendedor');

-- ------------------------------------------------------------
-- 2. clientes
-- ------------------------------------------------------------
INSERT INTO clientes (nombre, telefono, email) VALUES 
('María González', '555-123-4567', 'maria.gonzalez@ejemplo.com'),
('Juan Pérez', '555-987-6543', 'juan.perez@ejemplo.com'),
('Cliente Mostrador', NULL, NULL),
('Ana López', '555-555-5555', 'ana.lopez@ejemplo.com');

-- ------------------------------------------------------------
-- 3. categorias
-- ------------------------------------------------------------
INSERT INTO categorias (nombre) VALUES 
('Electrónica'), 
('Ropa'), 
('Hogar'), 
('Accesorios');

-- ------------------------------------------------------------
-- 4. marcas
-- ------------------------------------------------------------
INSERT INTO marcas (nombre) VALUES 
('Samsung'), 
('Nike'), 
('Sony'), 
('Genérica');

-- ------------------------------------------------------------
-- 5. colecciones
-- ------------------------------------------------------------
INSERT INTO colecciones (nombre, deleted_at) VALUES 
('Verano 2026', NULL), 
('Outlet', NULL),
('Invierno 2025', '2026-01-01 00:00:00'); -- Colección eliminada lógicamente

-- ------------------------------------------------------------
-- 6. productos
-- ------------------------------------------------------------
INSERT INTO productos (sku, nombre, precio, precio_descuento, descripcion, imagen_url, categoria_id, marca_id, coleccion_id) VALUES 
('SKU-1001', 'Smart TV 55"', 8500.00, 7999.00, 'Televisión 4K con Android TV', 'https://ejemplo.com/tv.jpg', 1, 1, NULL),
('SKU-1002', 'Tenis Running Pro', 1500.00, NULL, 'Tenis deportivos para correr', 'https://ejemplo.com/tenis.jpg', 2, 2, 1),
('SKU-1003', 'Audífonos Inalámbricos', 2000.00, 1500.00, 'Audífonos con cancelación de ruido activa', 'https://ejemplo.com/audifonos.jpg', 1, 3, 2),
('SKU-1004', 'Playera Básica Algodón', 250.00, NULL, 'Playera 100% algodón colores surtidos', NULL, 2, 4, 1),
('SKU-1005', 'Mochila Urbana Resistente', 800.00, 650.00, 'Mochila con compartimento para laptop', 'https://ejemplo.com/mochila.jpg', 4, 4, 2);

-- ------------------------------------------------------------
-- 7. movimientos_inventario (Inventario Inicial / Compras)
-- ------------------------------------------------------------
INSERT INTO movimientos_inventario (producto_id, tipo, motivo, cantidad, usuario_id, referencia, notas) VALUES 
(1, 'entrada', 'compra', 10, 1, 'FAC-COMPRA-001', 'Inventario inicial apertura'),
(2, 'entrada', 'compra', 25, 1, 'FAC-COMPRA-001', 'Inventario inicial apertura'),
(3, 'entrada', 'compra', 15, 1, 'FAC-COMPRA-002', 'Inventario inicial apertura'),
(4, 'entrada', 'compra', 50, 1, 'FAC-COMPRA-003', 'Inventario inicial apertura'),
(5, 'entrada', 'compra', 30, 1, 'FAC-COMPRA-003', 'Inventario inicial apertura');

-- ------------------------------------------------------------
-- 8. sesiones_caja
-- ------------------------------------------------------------
-- Sesión 1: Cerrada ayer
INSERT INTO sesiones_caja (usuario_id, fecha_apertura, fecha_cierre, saldo_inicial, saldo_final_esperado, saldo_final_declarado, diferencia, estado) VALUES 
(2, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 20 HOUR), 500.00, 8499.00, 8499.00, 0.00, 'cerrada');

-- Sesión 2: Abierta hoy
INSERT INTO sesiones_caja (usuario_id, fecha_apertura, fecha_cierre, saldo_inicial, saldo_final_esperado, saldo_final_declarado, diferencia, estado) VALUES 
(2, NOW(), NULL, 500.00, NULL, NULL, NULL, 'abierta');

-- ------------------------------------------------------------
-- 9. ventas
-- ------------------------------------------------------------
-- Venta 1 (Asociada a la sesión 1) - Smart TV
INSERT INTO ventas (folio, cliente_id, usuario_id, sesion_caja_id, total, metodo_pago) VALUES 
('VTA-00001', 1, 2, 1, 7999.00, 'tarjeta');

-- Venta 2 (Asociada a la sesión 2 - actual) - Tenis y Playera
INSERT INTO ventas (folio, cliente_id, usuario_id, sesion_caja_id, total, metodo_pago) VALUES 
('VTA-00002', 2, 2, 2, 1750.00, 'efectivo');

-- Venta 3 (Asociada a la sesión 2 - actual) - Audífonos
INSERT INTO ventas (folio, cliente_id, usuario_id, sesion_caja_id, total, metodo_pago) VALUES 
('VTA-00003', 3, 2, 2, 1500.00, 'transferencia');

-- ------------------------------------------------------------
-- 10. detalles_ventas
-- ------------------------------------------------------------
-- Detalles de Venta 1 (Smart TV con descuento)
INSERT INTO detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, descuento_aplicado, subtotal) VALUES 
(1, 1, 1, 8500.00, 501.00, 7999.00);

-- Detalles de Venta 2 (Tenis + Playera)
INSERT INTO detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, descuento_aplicado, subtotal) VALUES 
(2, 2, 1, 1500.00, 0.00, 1500.00),
(2, 4, 1, 250.00, 0.00, 250.00);

-- Detalles de Venta 3 (Audífonos con descuento)
INSERT INTO detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, descuento_aplicado, subtotal) VALUES 
(3, 3, 1, 2000.00, 500.00, 1500.00);

-- ------------------------------------------------------------
-- 11. movimientos_inventario (Salidas por Ventas)
-- ------------------------------------------------------------
INSERT INTO movimientos_inventario (producto_id, tipo, motivo, cantidad, usuario_id, referencia, notas) VALUES 
(1, 'salida', 'venta', 1, 2, 'VTA-00001', 'Venta en caja'),
(2, 'salida', 'venta', 1, 2, 'VTA-00002', 'Venta en caja'),
(4, 'salida', 'venta', 1, 2, 'VTA-00002', 'Venta en caja'),
(3, 'salida', 'venta', 1, 2, 'VTA-00003', 'Venta en caja');

SET FOREIGN_KEY_CHECKS = 1;