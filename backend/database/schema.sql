-- =============================================
-- 物流快递小程序 MySQL 数据库设计
-- 创建时间: 2026-06-03
-- =============================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS logistics_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE logistics_db;

-- =============================================
-- 1. 用户表 (users)
-- 存储所有用户信息，包括用户、快递员、管理员
-- =============================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` VARCHAR(32) PRIMARY KEY COMMENT '用户ID',
  `phone` VARCHAR(11) NOT NULL UNIQUE COMMENT '手机号',
  `username` VARCHAR(50) NOT NULL COMMENT '用户名',
  `password` VARCHAR(255) NOT NULL COMMENT '密码(加密存储)',
  `role` ENUM('user', 'courier', 'admin') NOT NULL DEFAULT 'user' COMMENT '角色: user-用户, courier-快递员, admin-管理员',
  `avatar` VARCHAR(255) DEFAULT NULL COMMENT '头像URL',
  `status` TINYINT DEFAULT 1 COMMENT '状态: 1-正常, 0-禁用',
  `last_login_time` DATETIME DEFAULT NULL COMMENT '最后登录时间',
  `last_login_ip` VARCHAR(50) DEFAULT NULL COMMENT '最后登录IP',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_phone` (`phone`),
  INDEX `idx_role` (`role`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- =============================================
-- 2. 订单表 (orders)
-- 存储快递订单信息
-- =============================================
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` VARCHAR(32) PRIMARY KEY COMMENT '订单ID',
  `order_number` VARCHAR(30) NOT NULL UNIQUE COMMENT '订单号 (ORDER+日期+随机数)',
  `tracking_number` VARCHAR(30) NOT NULL UNIQUE COMMENT '运单号 (XS+时间戳)',
  
  -- 寄件人信息
  `sender_address` VARCHAR(500) NOT NULL COMMENT '寄件地址',
  `sender_name` VARCHAR(50) NOT NULL COMMENT '寄件人姓名',
  `sender_phone` VARCHAR(11) NOT NULL COMMENT '寄件人电话',
  
  -- 收件人信息
  `receiver_address` VARCHAR(500) NOT NULL COMMENT '收件地址',
  `receiver_name` VARCHAR(50) NOT NULL COMMENT '收件人姓名',
  `receiver_phone` VARCHAR(11) NOT NULL COMMENT '收件人电话',
  
  -- 货品信息
  `product_count` INT DEFAULT 1 COMMENT '货品数量',
  `product_weight` DECIMAL(10,2) DEFAULT 0 COMMENT '货品重量(kg)',
  `product_type` VARCHAR(50) DEFAULT NULL COMMENT '货品类型',
  `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  
  -- 费用信息
  `unit_price` DECIMAL(10,2) DEFAULT 0 COMMENT '单价',
  `amount` DECIMAL(10,2) DEFAULT 0 COMMENT '总金额',
  `freight` DECIMAL(10,2) DEFAULT 0 COMMENT '运费',
  `insurance_fee` DECIMAL(10,2) DEFAULT 0 COMMENT '保价费',
  
  -- 订单状态
  `status` ENUM('pending', 'received', 'transit', 'delivered', 'cancelled') DEFAULT 'pending' COMMENT '订单状态: pending-待处理, received-已揽收, transit-运输中, delivered-已送达, cancelled-已取消',
  `payment_status` ENUM('pending', 'success', 'failed', 'refunded') DEFAULT 'pending' COMMENT '支付状态: pending-待支付, success-支付成功, failed-支付失败, refunded-已退款',
  `payment_method` ENUM('wechat', 'alipay', 'cash', 'other') DEFAULT NULL COMMENT '支付方式',
  `payment_time` DATETIME DEFAULT NULL COMMENT '支付时间',
  `payment_transaction_id` VARCHAR(64) DEFAULT NULL COMMENT '支付流水号',
  
  -- 快递员信息
  `courier_id` VARCHAR(32) DEFAULT NULL COMMENT '快递员ID',
  `courier_name` VARCHAR(50) DEFAULT NULL COMMENT '快递员姓名',
  
  -- 用户信息
  `user_id` VARCHAR(32) NOT NULL COMMENT '下单用户ID',
  `user_name` VARCHAR(50) DEFAULT NULL COMMENT '下单用户名',
  
  -- 时间戳
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `received_time` DATETIME DEFAULT NULL COMMENT '揽收时间',
  `delivered_time` DATETIME DEFAULT NULL COMMENT '送达时间',
  `cancel_time` DATETIME DEFAULT NULL COMMENT '取消时间',
  `cancel_reason` VARCHAR(255) DEFAULT NULL COMMENT '取消原因',
  
  INDEX `idx_order_number` (`order_number`),
  INDEX `idx_tracking_number` (`tracking_number`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_courier_id` (`courier_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_payment_status` (`payment_status`),
  INDEX `idx_create_time` (`create_time`),
  INDEX `idx_sender_phone` (`sender_phone`),
  INDEX `idx_receiver_phone` (`receiver_phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- =============================================
-- 3. 订单轨迹表 (order_tracks)
-- 存储订单状态变更记录
-- =============================================
DROP TABLE IF EXISTS `order_tracks`;
CREATE TABLE `order_tracks` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '轨迹ID',
  `order_id` VARCHAR(32) NOT NULL COMMENT '订单ID',
  `tracking_number` VARCHAR(30) NOT NULL COMMENT '运单号',
  `status` VARCHAR(20) NOT NULL COMMENT '状态',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '描述',
  `location` VARCHAR(100) DEFAULT NULL COMMENT '位置',
  `operator_id` VARCHAR(32) DEFAULT NULL COMMENT '操作人ID',
  `operator_name` VARCHAR(50) DEFAULT NULL COMMENT '操作人姓名',
  `operator_role` VARCHAR(20) DEFAULT NULL COMMENT '操作人角色',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_order_id` (`order_id`),
  INDEX `idx_tracking_number` (`tracking_number`),
  INDEX `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单轨迹表';

-- =============================================
-- 4. 配件库存表 (parts_inventory)
-- 存储配件库存信息
-- =============================================
DROP TABLE IF EXISTS `parts_inventory`;
CREATE TABLE `parts_inventory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '配件ID',
  `parts_code` VARCHAR(50) NOT NULL UNIQUE COMMENT '配件编码',
  `parts_name` VARCHAR(100) NOT NULL COMMENT '配件名称',
  `parts_type` VARCHAR(50) DEFAULT NULL COMMENT '配件类型',
  `unit` VARCHAR(20) DEFAULT '个' COMMENT '单位',
  `stock_quantity` INT DEFAULT 0 COMMENT '库存数量',
  `warning_quantity` INT DEFAULT 10 COMMENT '预警数量',
  `unit_price` DECIMAL(10,2) DEFAULT 0 COMMENT '单价',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '描述',
  `status` TINYINT DEFAULT 1 COMMENT '状态: 1-正常, 0-禁用',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_parts_code` (`parts_code`),
  INDEX `idx_parts_name` (`parts_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配件库存表';

-- =============================================
-- 5. 配件出入库记录表 (parts_stock_records)
-- 存储配件出入库记录
-- =============================================
DROP TABLE IF EXISTS `parts_stock_records`;
CREATE TABLE `parts_stock_records` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `parts_id` INT NOT NULL COMMENT '配件ID',
  `parts_code` VARCHAR(50) NOT NULL COMMENT '配件编码',
  `parts_name` VARCHAR(100) NOT NULL COMMENT '配件名称',
  `type` ENUM('in', 'out') NOT NULL COMMENT '类型: in-入库, out-出库',
  `quantity` INT NOT NULL COMMENT '数量',
  `before_quantity` INT DEFAULT 0 COMMENT '变更前数量',
  `after_quantity` INT DEFAULT 0 COMMENT '变更后数量',
  `order_id` VARCHAR(32) DEFAULT NULL COMMENT '关联订单ID',
  `tracking_number` VARCHAR(30) DEFAULT NULL COMMENT '关联运单号',
  `operator_id` VARCHAR(32) DEFAULT NULL COMMENT '操作人ID',
  `operator_name` VARCHAR(50) DEFAULT NULL COMMENT '操作人姓名',
  `remark` VARCHAR(255) DEFAULT NULL COMMENT '备注',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_parts_id` (`parts_id`),
  INDEX `idx_parts_code` (`parts_code`),
  INDEX `idx_type` (`type`),
  INDEX `idx_order_id` (`order_id`),
  INDEX `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配件出入库记录表';

-- =============================================
-- 6. 打印记录表 (print_records)
-- 存储快递面单打印记录
-- =============================================
DROP TABLE IF EXISTS `print_records`;
CREATE TABLE `print_records` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '打印记录ID',
  `order_id` VARCHAR(32) NOT NULL COMMENT '订单ID',
  `tracking_number` VARCHAR(30) NOT NULL COMMENT '运单号',
  `order_number` VARCHAR(30) DEFAULT NULL COMMENT '订单号',
  
  -- 打印内容(脱敏后)
  `sender_name_masked` VARCHAR(50) DEFAULT NULL COMMENT '寄件人姓名(脱敏)',
  `sender_phone_masked` VARCHAR(20) DEFAULT NULL COMMENT '寄件人电话(脱敏)',
  `sender_address` VARCHAR(500) DEFAULT NULL COMMENT '寄件地址',
  `receiver_name_masked` VARCHAR(50) DEFAULT NULL COMMENT '收件人姓名(脱敏)',
  `receiver_phone_masked` VARCHAR(20) DEFAULT NULL COMMENT '收件人电话(脱敏)',
  `receiver_address` VARCHAR(500) DEFAULT NULL COMMENT '收件地址',
  
  -- 打印信息
  `printer_model` VARCHAR(50) DEFAULT 'A300E' COMMENT '打印机型号',
  `print_type` VARCHAR(20) DEFAULT 'face_sheet' COMMENT '打印类型: face_sheet-面单, label-标签',
  `barcode_data` VARCHAR(100) DEFAULT NULL COMMENT '一维码数据',
  `qrcode_data` VARCHAR(255) DEFAULT NULL COMMENT '二维码数据',
  
  -- 操作信息
  `operator_id` VARCHAR(32) DEFAULT NULL COMMENT '操作人ID',
  `operator_name` VARCHAR(50) DEFAULT NULL COMMENT '操作人姓名',
  `print_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '打印时间',
  `print_status` TINYINT DEFAULT 1 COMMENT '打印状态: 1-成功, 0-失败',
  `error_message` VARCHAR(255) DEFAULT NULL COMMENT '错误信息',
  
  INDEX `idx_order_id` (`order_id`),
  INDEX `idx_tracking_number` (`tracking_number`),
  INDEX `idx_operator_id` (`operator_id`),
  INDEX `idx_print_time` (`print_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打印记录表';

-- =============================================
-- 7. 历史联系人表 (history_contacts)
-- 存储用户常用寄件人/收件人信息
-- =============================================
DROP TABLE IF EXISTS `history_contacts`;
CREATE TABLE `history_contacts` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `user_id` VARCHAR(32) NOT NULL COMMENT '用户ID',
  `type` ENUM('sender', 'receiver') NOT NULL COMMENT '类型: sender-寄件人, receiver-收件人',
  `name` VARCHAR(50) NOT NULL COMMENT '姓名',
  `phone` VARCHAR(11) NOT NULL COMMENT '电话',
  `address` VARCHAR(500) NOT NULL COMMENT '地址',
  `use_count` INT DEFAULT 1 COMMENT '使用次数',
  `last_use_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后使用时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `uk_user_type_contact` (`user_id`, `type`, `phone`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='历史联系人表';

-- =============================================
-- 8. 系统配置表 (system_config)
-- 存储系统配置信息
-- =============================================
DROP TABLE IF EXISTS `system_config`;
CREATE TABLE `system_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '配置ID',
  `config_key` VARCHAR(50) NOT NULL UNIQUE COMMENT '配置键',
  `config_value` TEXT COMMENT '配置值',
  `config_type` VARCHAR(20) DEFAULT 'string' COMMENT '配置类型: string, number, json, boolean',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '配置描述',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- =============================================
-- 9. 登录日志表 (login_logs)
-- 存储用户登录日志
-- =============================================
DROP TABLE IF EXISTS `login_logs`;
CREATE TABLE `login_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
  `user_id` VARCHAR(32) DEFAULT NULL COMMENT '用户ID',
  `phone` VARCHAR(11) DEFAULT NULL COMMENT '手机号',
  `role` VARCHAR(20) DEFAULT NULL COMMENT '角色',
  `login_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  `login_ip` VARCHAR(50) DEFAULT NULL COMMENT '登录IP',
  `login_device` VARCHAR(100) DEFAULT NULL COMMENT '登录设备',
  `login_status` TINYINT DEFAULT 1 COMMENT '登录状态: 1-成功, 0-失败',
  `fail_reason` VARCHAR(255) DEFAULT NULL COMMENT '失败原因',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_login_time` (`login_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='登录日志表';

-- =============================================
-- 10. 操作日志表 (operation_logs)
-- 存储用户操作日志
-- =============================================
DROP TABLE IF EXISTS `operation_logs`;
CREATE TABLE `operation_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
  `user_id` VARCHAR(32) DEFAULT NULL COMMENT '用户ID',
  `user_name` VARCHAR(50) DEFAULT NULL COMMENT '用户名',
  `role` VARCHAR(20) DEFAULT NULL COMMENT '角色',
  `module` VARCHAR(50) DEFAULT NULL COMMENT '模块',
  `action` VARCHAR(50) DEFAULT NULL COMMENT '操作',
  `target_type` VARCHAR(50) DEFAULT NULL COMMENT '目标类型',
  `target_id` VARCHAR(32) DEFAULT NULL COMMENT '目标ID',
  `detail` TEXT COMMENT '详情(JSON)',
  `ip` VARCHAR(50) DEFAULT NULL COMMENT 'IP地址',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_module` (`module`),
  INDEX `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- =============================================
-- 初始化数据
-- =============================================

-- 插入默认管理员账号 (密码: admin123, 使用bcrypt加密)
INSERT INTO `users` (`id`, `phone`, `username`, `password`, `role`, `status`) VALUES
('admin_001', '13800000000', '系统管理员', '$2b$10$rQZ9QxZxQxZxQxZxQxZxQOZxQxZxQxZxQxZxQxZxQxZxQxZxQxZx', 'admin', 1);

-- 插入测试快递员账号
INSERT INTO `users` (`id`, `phone`, `username`, `password`, `role`, `status`) VALUES
('courier_001', '13800000001', '张三快递员', '$2b$10$rQZ9QxZxQxZxQxZxQxZxQOZxQxZxQxZxQxZxQxZxQxZxQxZxQxZx', 'courier', 1),
('courier_002', '13800000002', '李四快递员', '$2b$10$rQZ9QxZxQxZxQxZxQxZxQOZxQxZxQxZxQxZxQxZxQxZxQxZxQxZx', 'courier', 1);

-- 插入测试用户账号
INSERT INTO `users` (`id`, `phone`, `username`, `password`, `role`, `status`) VALUES
('user_001', '13800000003', '测试用户', '$2b$10$rQZ9QxZxQxZxQxZxQxZxQOZxQxZxQxZxQxZxQxZxQxZxQxZxQxZx', 'user', 1);

-- 插入系统配置
INSERT INTO `system_config` (`config_key`, `config_value`, `config_type`, `description`) VALUES
('order_prefix', 'ORDER', 'string', '订单号前缀'),
('tracking_prefix', 'XS', 'string', '运单号前缀'),
('default_unit_price', '2.00', 'number', '默认单价'),
('print_template_version', '1.0', 'string', '打印模板版本');

-- 插入测试配件数据
INSERT INTO `parts_inventory` (`parts_code`, `parts_name`, `parts_type`, `unit`, `stock_quantity`, `warning_quantity`, `unit_price`) VALUES
('BOX001', '标准快递箱', '包装材料', '个', 100, 20, 5.00),
('BOX002', '大号快递箱', '包装材料', '个', 50, 10, 8.00),
('TAPE001', '封箱胶带', '包装材料', '卷', 200, 30, 2.00),
('BUBBLE001', '气泡膜', '包装材料', '米', 500, 50, 1.00);
