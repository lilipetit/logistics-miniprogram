/**
 * 快递员路由
 * 处理快递员相关操作
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { auth, isCourier } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/error');
const { generateTrackingNumber, formatTime, ORDER_STATUS } = require('../utils/helpers');

/**
 * @route   GET /api/courier/orders
 * @desc    获取快递员负责的订单列表
 * @access  Private (courier)
 */
router.get('/orders', auth, asyncHandler(async (req, res) => {
  const { status, page = 1, pageSize = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  let whereClause = 'WHERE (courier_id = ? OR (courier_id IS NULL AND status = "pending"))';
  const params = [req.user.id];

  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }

  const countResult = await query(
    `SELECT COUNT(*) as total FROM orders ${whereClause}`,
    params
  );

  const orders = await query(
    `SELECT 
      id, order_number, tracking_number,
      sender_address, sender_name, sender_phone,
      receiver_address, receiver_name, receiver_phone,
      product_count, amount, status, payment_status,
      create_time, update_time
    FROM orders 
    ${whereClause}
    ORDER BY FIELD(status, 'pending', 'received', 'transit', 'delivered'), create_time DESC
    LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize), offset]
  );

  res.json({
    success: true,
    data: {
      list: orders.map(o => ({
        ...o,
        statusLabel: ORDER_STATUS[o.status],
        amount: parseFloat(o.amount).toFixed(2),
        createTime: formatTime(o.create_time)
      })),
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total
      }
    }
  });
}));

/**
 * @route   POST /api/courier/package/entry
 * @desc    快递员录入包裹（扫码入库）
 * @access  Private (courier)
 */
router.post('/package/entry', [
  auth,
  body('trackingNumber').notEmpty().withMessage('请输入运单号')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { trackingNumber } = req.body;
  const normalizedTracking = trackingNumber.replace(/^XS/, '').toUpperCase();

  await transaction(async (conn) => {
    // 查询是否已存在该订单
    const [existingOrder] = await conn.execute(
      'SELECT * FROM orders WHERE tracking_number = ? OR tracking_number LIKE ?',
      [normalizedTracking, `%${normalizedTracking}`]
    );

    if (existingOrder.length > 0) {
      const order = existingOrder[0];
      // 更新订单状态为已揽收
      await conn.execute(
        `UPDATE orders SET status = 'received', courier_id = ?, courier_name = ?, 
         received_time = NOW(), update_time = NOW() WHERE id = ?`,
        [req.user.id, req.user.username, order.id]
      );

      // 插入轨迹
      await conn.execute(
        `INSERT INTO order_tracks (order_id, tracking_number, status, description, operator_id, operator_name, operator_role)
         VALUES (?, ?, 'received', '快件已揽收，由快递员入库', ?, ?, ?)`,
        [order.id, order.tracking_number, req.user.id, req.user.username, req.user.role]
      );

      res.json({
        success: true,
        message: '包裹录入成功',
        data: {
          orderId: order.id,
          trackingNumber: order.tracking_number,
          receiverName: order.receiver_name,
          receiverAddress: order.receiver_address,
          status: 'received'
        }
      });
    } else {
      // 创建新订单（扫码录入的外来件）
      const orderId = require('uuid').v4().replace(/-/g, '').substring(0, 16);
      const newTrackingNumber = 'XS' + Date.now().toString().slice(-10);

      await conn.execute(
        `INSERT INTO orders (id, order_number, tracking_number, status, courier_id, courier_name, received_time, create_time)
         VALUES (?, ?, ?, 'received', ?, ?, NOW(), NOW())`,
        [orderId, 'ORDER' + Date.now(), newTrackingNumber, req.user.id, req.user.username]
      );

      // 插入轨迹
      await conn.execute(
        `INSERT INTO order_tracks (order_id, tracking_number, status, description, operator_id, operator_name, operator_role)
         VALUES (?, ?, 'received', '快件已揽收(扫码录入)', ?, ?, ?)`,
        [orderId, newTrackingNumber, req.user.id, req.user.username, req.user.role]
      );

      res.json({
        success: true,
        message: '新包裹录入成功',
        data: {
          orderId,
          trackingNumber: newTrackingNumber,
          status: 'received'
        }
      });
    }
  });
}));

/**
 * @route   POST /api/courier/claim/:orderId
 * @desc    快递员认领订单
 * @access  Private (courier)
 */
router.post('/claim/:orderId', auth, asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const result = await query(
    `UPDATE orders SET courier_id = ?, courier_name = ?, status = 'received', 
     received_time = NOW(), update_time = NOW() WHERE id = ? AND courier_id IS NULL`,
    [req.user.id, req.user.username, orderId]
  );

  if (result.affectedRows === 0) {
    throw new ApiError(400, '订单不存在或已被认领');
  }

  // 插入轨迹
  const order = await query('SELECT tracking_number FROM orders WHERE id = ?', [orderId]);
  await query(
    `INSERT INTO order_tracks (order_id, tracking_number, status, description, operator_id, operator_name, operator_role)
     VALUES (?, ?, 'received', '快递员已认领订单', ?, ?, ?)`,
    [orderId, order[0].tracking_number, req.user.id, req.user.username, req.user.role]
  );

  res.json({
    success: true,
    message: '订单认领成功'
  });
}));

/**
 * @route   PUT /api/courier/assign/:orderId
 * @desc    快递员分配订单给其他快递员
 * @access  Private (courier)
 */
router.put('/assign/:orderId', [
  auth,
  body('courierId').notEmpty().withMessage('请选择要分配的快递员')
], asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { courierId } = req.body;

  // 查询目标快递员
  const couriers = await query(
    'SELECT id, username FROM users WHERE id = ? AND role = "courier"',
    [courierId]
  );

  if (couriers.length === 0) {
    throw new ApiError(400, '目标快递员不存在');
  }

  const courier = couriers[0];

  // 更新订单
  await query(
    `UPDATE orders SET courier_id = ?, courier_name = ?, update_time = NOW() WHERE id = ?`,
    [courier.id, courier.username, orderId]
  );

  res.json({
    success: true,
    message: '订单已分配给 ' + courier.username
  });
}));

/**
 * @route   GET /api/courier/stats
 * @desc    获取快递员统计数据
 * @access  Private (courier)
 */
router.get('/stats', auth, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const stats = await query(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as received,
      SUM(CASE WHEN status = 'transit' THEN 1 ELSE 0 END) as transit,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN DATE(create_time) = ? THEN 1 ELSE 0 END) as todayReceived,
      SUM(CASE WHEN DATE(delivered_time) = ? THEN 1 ELSE 0 END) as todayDelivered
    FROM orders WHERE courier_id = ?`,
    [today, today, req.user.id]
  );

  res.json({
    success: true,
    data: stats[0]
  });
}));

module.exports = router;
