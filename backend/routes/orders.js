/**
 * 订单路由
 * 处理订单创建、查询、状态更新等
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { auth, isOwnerOrAdmin } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/error');
const { 
  generateId, 
  generateOrderNumber, 
  generateTrackingNumber,
  formatTime,
  formatMoney,
  ORDER_STATUS,
  PAYMENT_STATUS,
  parsePagination,
  buildPaginationResponse
} = require('../utils/helpers');

/**
 * @route   POST /api/orders
 * @desc    创建订单（用户下单）
 * @access  Private (user)
 */
router.post('/', [
  auth,
  body('senderAddress').notEmpty().withMessage('请输入寄件地址'),
  body('senderName').notEmpty().withMessage('请输入寄件人姓名'),
  body('senderPhone').isMobilePhone('zh-CN').withMessage('请输入正确的寄件人手机号'),
  body('receiverAddress').notEmpty().withMessage('请输入收件地址'),
  body('receiverName').notEmpty().withMessage('请输入收件人姓名'),
  body('receiverPhone').isMobilePhone('zh-CN').withMessage('请输入正确的收件人手机号'),
  body('productCount').optional().isInt({ min: 1 }).withMessage('货品数量必须大于0'),
  body('unitPrice').optional().isFloat({ min: 0 }).withMessage('单价不能为负数')
], asyncHandler(async (req, res) => {
  // 验证输入
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const {
    senderAddress, senderName, senderPhone,
    receiverAddress, receiverName, receiverPhone,
    productCount = 1, unitPrice = 2.00, remark
  } = req.body;

  // 计算总金额
  const amount = parseFloat((productCount * unitPrice).toFixed(2));

  // 生成订单号和运单号
  const orderId = generateId('o_');
  const orderNumber = generateOrderNumber();
  const trackingNumber = generateTrackingNumber();

  // 创建订单
  await transaction(async (conn) => {
    // 插入订单
    await conn.execute(
      `INSERT INTO orders (
        id, order_number, tracking_number,
        sender_address, sender_name, sender_phone,
        receiver_address, receiver_name, receiver_phone,
        product_count, unit_price, amount,
        user_id, user_name, status, payment_status, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)`,
      [
        orderId, orderNumber, trackingNumber,
        senderAddress, senderName, senderPhone,
        receiverAddress, receiverName, receiverPhone,
        productCount, unitPrice, amount,
        req.user.id, req.user.username, remark
      ]
    );

    // 插入订单轨迹
    await conn.execute(
      `INSERT INTO order_tracks (order_id, tracking_number, status, description, operator_id, operator_name, operator_role)
       VALUES (?, ?, 'pending', '订单已创建，等待处理', ?, ?, ?)`,
      [orderId, trackingNumber, req.user.id, req.user.username, req.user.role]
    );

    // 保存寄件人历史记录
    await conn.execute(
      `INSERT INTO history_contacts (user_id, type, name, phone, address) VALUES (?, 'sender', ?, ?, ?)
       ON DUPLICATE KEY UPDATE use_count = use_count + 1, last_use_time = NOW()`,
      [req.user.id, senderName, senderPhone, senderAddress]
    );

    // 保存收件人历史记录
    await conn.execute(
      `INSERT INTO history_contacts (user_id, type, name, phone, address) VALUES (?, 'receiver', ?, ?, ?)
       ON DUPLICATE KEY UPDATE use_count = use_count + 1, last_use_time = NOW()`,
      [req.user.id, receiverName, receiverPhone, receiverAddress]
    );
  });

  res.json({
    success: true,
    message: '订单创建成功',
    data: {
      id: orderId,
      orderNumber,
      trackingNumber,
      amount
    }
  });
}));

/**
 * @route   GET /api/orders
 * @desc    获取订单列表
 * @access  Private
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query);
  const { status, paymentStatus, keyword, startDate, endDate } = req.query;

  let whereClause = 'WHERE 1=1';
  const params = [];

  // 根据角色过滤
  if (req.user.role === 'user') {
    whereClause += ' AND user_id = ?';
    params.push(req.user.id);
  } else if (req.user.role === 'courier') {
    whereClause += ' AND (courier_id = ? OR (courier_id IS NULL AND status = "pending"))';
    params.push(req.user.id);
  }
  // 管理员可以查看所有订单

  // 状态过滤
  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }

  // 支付状态过滤
  if (paymentStatus) {
    whereClause += ' AND payment_status = ?';
    params.push(paymentStatus);
  }

  // 关键词搜索
  if (keyword) {
    whereClause += ` AND (
      tracking_number LIKE ? OR 
      order_number LIKE ? OR 
      receiver_name LIKE ? OR 
      receiver_phone LIKE ? OR
      sender_name LIKE ? OR
      sender_phone LIKE ?
    )`;
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword);
  }

  // 日期范围
  if (startDate) {
    whereClause += ' AND DATE(create_time) >= ?';
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ' AND DATE(create_time) <= ?';
    params.push(endDate);
  }

  // 查询总数
  const countSql = `SELECT COUNT(*) as total FROM orders ${whereClause}`;
  const countResult = await query(countSql, params);
  const total = countResult[0].total;

  // 查询列表
  const listSql = `
    SELECT 
      id, order_number, tracking_number,
      sender_address, sender_name, sender_phone,
      receiver_address, receiver_name, receiver_phone,
      product_count, amount, status, payment_status,
      courier_id, courier_name, user_id, user_name,
      create_time, update_time, delivered_time
    FROM orders 
    ${whereClause}
    ORDER BY create_time DESC
    LIMIT ? OFFSET ?
  `;
  params.push(pageSize, offset);
  const orders = await query(listSql, params);

  // 格式化输出
  const formattedOrders = orders.map(order => ({
    ...order,
    statusLabel: ORDER_STATUS[order.status],
    paymentStatusLabel: PAYMENT_STATUS[order.payment_status],
    amount: formatMoney(order.amount),
    createTime: formatTime(order.create_time),
    updateTime: formatTime(order.update_time),
    deliveredTime: formatTime(order.delivered_time)
  }));

  res.json({
    success: true,
    data: buildPaginationResponse(formattedOrders, total, page, pageSize)
  });
}));

/**
 * @route   GET /api/orders/:id
 * @desc    获取订单详情
 * @access  Private
 */
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 查询订单
  const orders = await query('SELECT * FROM orders WHERE id = ?', [id]);
  if (orders.length === 0) {
    throw new ApiError(404, '订单不存在');
  }

  const order = orders[0];

  // 权限检查
  if (req.user.role === 'user' && order.user_id !== req.user.id) {
    throw new ApiError(403, '无权查看此订单');
  }
  if (req.user.role === 'courier' && order.courier_id !== req.user.id && order.status !== 'pending') {
    throw new ApiError(403, '无权查看此订单');
  }

  // 查询订单轨迹
  const tracks = await query(
    'SELECT * FROM order_tracks WHERE order_id = ? ORDER BY create_time DESC',
    [id]
  );

  // 格式化输出
  order.statusLabel = ORDER_STATUS[order.status];
  order.paymentStatusLabel = PAYMENT_STATUS[order.payment_status];
  order.amount = formatMoney(order.amount);
  order.createTime = formatTime(order.create_time);
  order.updateTime = formatTime(order.update_time);
  order.tracks = tracks.map(t => ({
    ...t,
    createTime: formatTime(t.create_time)
  }));

  res.json({
    success: true,
    data: order
  });
}));

/**
 * @route   PUT /api/orders/:id/status
 * @desc    更新订单状态
 * @access  Private (courier, admin)
 */
router.put('/:id/status', [
  auth,
  body('status').isIn(['pending', 'received', 'transit', 'delivered', 'cancelled']).withMessage('状态值无效')
], asyncHandler(async (req, res) => {
  // 权限检查
  if (req.user.role !== 'courier' && req.user.role !== 'admin') {
    throw new ApiError(403, '无权修改订单状态');
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { id } = req.params;
  const { status, location, description } = req.body;

  await transaction(async (conn) => {
    // 查询订单
    const [order] = await conn.execute('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order || order.length === 0) {
      throw new ApiError(404, '订单不存在');
    }

    const orderData = order[0];

    // 快递员认领逻辑
    let courierId = orderData.courier_id;
    let courierName = orderData.courier_name;
    
    if (req.user.role === 'courier' && !courierId) {
      courierId = req.user.id;
      courierName = req.user.username;
    }

    // 更新订单状态
    const updateFields = ['status = ?', 'update_time = NOW()'];
    const updateParams = [status];

    if (courierId !== orderData.courier_id) {
      updateFields.push('courier_id = ?', 'courier_name = ?');
      updateParams.push(courierId, courierName);
    }

    if (status === 'delivered') {
      updateFields.push('delivered_time = NOW()');
    }
    if (status === 'cancelled') {
      updateFields.push('cancel_time = NOW()');
    }

    updateParams.push(id);
    await conn.execute(
      `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    // 插入轨迹记录
    const statusDesc = {
      pending: '订单已创建',
      received: '快件已揽收',
      transit: '快件运输中',
      delivered: '快件已送达',
      cancelled: '订单已取消'
    };

    await conn.execute(
      `INSERT INTO order_tracks (order_id, tracking_number, status, description, location, operator_id, operator_name, operator_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orderData.tracking_number, status, description || statusDesc[status], location, req.user.id, req.user.username, req.user.role]
    );
  });

  res.json({
    success: true,
    message: '状态更新成功'
  });
}));

/**
 * @route   PUT /api/orders/:id/payment
 * @desc    更新支付状态
 * @access  Private
 */
router.put('/:id/payment', [
  auth,
  body('paymentStatus').isIn(['pending', 'success', 'failed', 'refunded']).withMessage('支付状态无效'),
  body('paymentMethod').optional().isIn(['wechat', 'alipay', 'cash', 'other']).withMessage('支付方式无效')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { id } = req.params;
  const { paymentStatus, paymentMethod, transactionId } = req.body;

  const updateFields = ['payment_status = ?', 'update_time = NOW()'];
  const params = [paymentStatus];

  if (paymentMethod) {
    updateFields.push('payment_method = ?');
    params.push(paymentMethod);
  }

  if (paymentStatus === 'success') {
    updateFields.push('payment_time = NOW()');
    if (transactionId) {
      updateFields.push('payment_transaction_id = ?');
      params.push(transactionId);
    }
  }

  params.push(id);
  await query(`UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`, params);

  res.json({
    success: true,
    message: '支付状态更新成功'
  });
}));

/**
 * @route   GET /api/orders/track/:trackingNumber
 * @desc    根据运单号查询订单
 * @access  Public
 */
router.get('/track/:trackingNumber', asyncHandler(async (req, res) => {
  const { trackingNumber } = req.params;

  const orders = await query(
    `SELECT 
      tracking_number, order_number, status,
      sender_address, sender_name, sender_phone,
      receiver_address, receiver_name, receiver_phone,
      create_time, received_time, delivered_time
    FROM orders WHERE tracking_number = ?`,
    [trackingNumber]
  );

  if (orders.length === 0) {
    throw new ApiError(404, '未找到该运单号对应的订单');
  }

  const order = orders[0];

  // 查询轨迹
  const tracks = await query(
    'SELECT status, description, location, operator_name, create_time FROM order_tracks WHERE tracking_number = ? ORDER BY create_time DESC',
    [trackingNumber]
  );

  order.statusLabel = ORDER_STATUS[order.status];
  order.tracks = tracks.map(t => ({
    ...t,
    createTime: formatTime(t.create_time)
  }));

  res.json({
    success: true,
    data: order
  });
}));

/**
 * @route   DELETE /api/orders/:id
 * @desc    删除订单
 * @access  Private (admin)
 */
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(403, '需要管理员权限');
  }

  const { id } = req.params;
  
  await query('DELETE FROM orders WHERE id = ?', [id]);
  await query('DELETE FROM order_tracks WHERE order_id = ?', [id]);

  res.json({
    success: true,
    message: '订单已删除'
  });
}));

module.exports = router;
