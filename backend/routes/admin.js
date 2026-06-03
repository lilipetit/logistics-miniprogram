/**
 * 管理员路由
 * 处理管理员相关操作
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { auth, isAdmin } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/error');
const { generateId, formatTime, formatMoney, ORDER_STATUS, PAYMENT_STATUS, USER_ROLE, parsePagination, buildPaginationResponse } = require('../utils/helpers');

/**
 * @route   GET /api/admin/stats
 * @desc    获取系统统计数据
 * @access  Private (admin)
 */
router.get('/stats', auth, isAdmin, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  // 订单统计
  const orderStats = await query(`
    SELECT 
      COUNT(*) as totalOrders,
      SUM(CASE WHEN DATE(create_time) = ? THEN 1 ELSE 0 END) as todayOrders,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingOrders,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as deliveredOrders,
      SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as unpaidOrders,
      SUM(CASE WHEN payment_status = 'success' THEN amount ELSE 0 END) as totalRevenue,
      SUM(CASE WHEN DATE(payment_time) = ? AND payment_status = 'success' THEN amount ELSE 0 END) as todayRevenue
    FROM orders`,
    [today, today]
  );

  // 用户统计
  const userStats = await query(`
    SELECT 
      COUNT(*) as totalUsers,
      SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as userCount,
      SUM(CASE WHEN role = 'courier' THEN 1 ELSE 0 END) as courierCount,
      SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as adminCount,
      SUM(CASE WHEN DATE(created_at) = ? THEN 1 ELSE 0 END) as todayNewUsers
    FROM users WHERE status = 1`,
    [today]
  );

  // 配件库存预警
  const inventoryAlerts = await query(
    'SELECT COUNT(*) as alertCount FROM parts_inventory WHERE stock_quantity <= warning_quantity AND status = 1'
  );

  res.json({
    success: true,
    data: {
      orders: orderStats[0],
      users: userStats[0],
      inventory: inventoryAlerts[0],
      todayRevenue: formatMoney(orderStats[0].todayRevenue || 0),
      totalRevenue: formatMoney(orderStats[0].totalRevenue || 0)
    }
  });
}));

/**
 * @route   GET /api/admin/users
 * @desc    获取用户列表
 * @access  Private (admin)
 */
router.get('/users', auth, isAdmin, asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query);
  const { role, keyword, status } = req.query;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (role) {
    whereClause += ' AND role = ?';
    params.push(role);
  }

  if (status) {
    whereClause += ' AND status = ?';
    params.push(parseInt(status));
  }

  if (keyword) {
    whereClause += ' AND (username LIKE ? OR phone LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const countResult = await query(`SELECT COUNT(*) as total FROM users ${whereClause}`, params);
  const users = await query(
    `SELECT id, phone, username, role, avatar, status, last_login_time, created_at 
     FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  res.json({
    success: true,
    data: buildPaginationResponse(
      users.map(u => ({
        ...u,
        roleLabel: USER_ROLE[u.role],
        lastLoginTime: formatTime(u.last_login_time),
        createdAt: formatTime(u.created_at)
      })),
      countResult[0].total,
      page,
      pageSize
    )
  });
}));

/**
 * @route   POST /api/admin/users
 * @desc    创建用户
 * @access  Private (admin)
 */
router.post('/users', [
  auth, isAdmin,
  body('phone').isMobilePhone('zh-CN').withMessage('请输入正确的手机号'),
  body('username').isLength({ min: 2, max: 20 }).withMessage('用户名长度应为2-20个字符'),
  body('password').isLength({ min: 6 }).withMessage('密码长度至少6位'),
  body('role').isIn(['user', 'courier', 'admin']).withMessage('角色类型无效')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { phone, username, password, role } = req.body;

  // 检查手机号是否存在
  const existing = await query('SELECT id FROM users WHERE phone = ?', [phone]);
  if (existing.length > 0) {
    throw new ApiError(400, '该手机号已注册');
  }

  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = generateId('u_');

  await query(
    'INSERT INTO users (id, phone, username, password, role, status) VALUES (?, ?, ?, ?, ?, 1)',
    [userId, phone, username, hashedPassword, role]
  );

  res.json({
    success: true,
    message: '用户创建成功',
    data: { id: userId, phone, username, role }
  });
}));

/**
 * @route   PUT /api/admin/users/:id
 * @desc    更新用户信息
 * @access  Private (admin)
 */
router.put('/users/:id', [
  auth, isAdmin,
  body('phone').optional().isMobilePhone('zh-CN').withMessage('请输入正确的手机号'),
  body('username').optional().isLength({ min: 2, max: 20 }).withMessage('用户名长度应为2-20个字符'),
  body('role').optional().isIn(['user', 'courier', 'admin']).withMessage('角色类型无效'),
  body('status').optional().isIn([0, 1]).withMessage('状态值无效')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { id } = req.params;
  const { phone, username, role, status, password } = req.body;

  const updates = [];
  const params = [];

  if (phone) {
    const existing = await query('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, id]);
    if (existing.length > 0) {
      throw new ApiError(400, '该手机号已被使用');
    }
    updates.push('phone = ?');
    params.push(phone);
  }

  if (username) {
    updates.push('username = ?');
    params.push(username);
  }

  if (role) {
    updates.push('role = ?');
    params.push(role);
  }

  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }

  if (password) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    updates.push('password = ?');
    params.push(hashedPassword);
  }

  if (updates.length === 0) {
    throw new ApiError(400, '没有要更新的字段');
  }

  params.push(id);
  await query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);

  res.json({
    success: true,
    message: '用户信息更新成功'
  });
}));

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    删除用户
 * @access  Private (admin)
 */
router.delete('/users/:id', auth, isAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    throw new ApiError(400, '不能删除当前登录账号');
  }

  const result = await query('DELETE FROM users WHERE id = ? AND role != "admin"', [id]);

  if (result.affectedRows === 0) {
    throw new ApiError(400, '用户不存在或无法删除');
  }

  res.json({
    success: true,
    message: '用户已删除'
  });
}));

/**
 * @route   GET /api/admin/orders
 * @desc    获取所有订单（管理员视图）
 * @access  Private (admin)
 */
router.get('/orders', auth, isAdmin, asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query);
  const { status, paymentStatus, courierId, keyword, startDate, endDate } = req.query;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }

  if (paymentStatus) {
    whereClause += ' AND payment_status = ?';
    params.push(paymentStatus);
  }

  if (courierId) {
    whereClause += ' AND courier_id = ?';
    params.push(courierId);
  }

  if (keyword) {
    whereClause += ` AND (
      tracking_number LIKE ? OR order_number LIKE ? OR 
      receiver_name LIKE ? OR sender_name LIKE ? OR
      receiver_phone LIKE ? OR sender_phone LIKE ?
    )`;
    const like = `%${keyword}%`;
    params.push(like, like, like, like, like, like);
  }

  if (startDate) {
    whereClause += ' AND DATE(create_time) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    whereClause += ' AND DATE(create_time) <= ?';
    params.push(endDate);
  }

  const countResult = await query(`SELECT COUNT(*) as total FROM orders ${whereClause}`, params);
  const orders = await query(
    `SELECT * FROM orders ${whereClause} ORDER BY create_time DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  res.json({
    success: true,
    data: buildPaginationResponse(
      orders.map(o => ({
        ...o,
        statusLabel: ORDER_STATUS[o.status],
        paymentStatusLabel: PAYMENT_STATUS[o.payment_status],
        amount: formatMoney(o.amount),
        createTime: formatTime(o.create_time)
      })),
      countResult[0].total,
      page,
      pageSize
    )
  });
}));

/**
 * @route   POST /api/admin/orders/:id/assign
 * @desc    管理员分配快递员
 * @access  Private (admin)
 */
router.post('/orders/:id/assign', [
  auth, isAdmin,
  body('courierId').notEmpty().withMessage('请选择快递员')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { id } = req.params;
  const { courierId } = req.body;

  const couriers = await query('SELECT id, username FROM users WHERE id = ? AND role = "courier"', [courierId]);
  if (couriers.length === 0) {
    throw new ApiError(400, '快递员不存在');
  }

  await transaction(async (conn) => {
    await conn.execute(
      'UPDATE orders SET courier_id = ?, courier_name = ?, status = "received", update_time = NOW() WHERE id = ?',
      [courierId, couriers[0].username, id]
    );

    const [order] = await conn.execute('SELECT tracking_number FROM orders WHERE id = ?', [id]);
    await conn.execute(
      `INSERT INTO order_tracks (order_id, tracking_number, status, description, operator_id, operator_name, operator_role)
       VALUES (?, ?, 'received', '管理员分配快递员', ?, ?, 'admin')`,
      [id, order[0].tracking_number, req.user.id, req.user.username]
    );
  });

  res.json({
    success: true,
    message: '快递员分配成功'
  });
}));

/**
 * @route   GET /api/admin/couriers
 * @desc    获取快递员列表
 * @access  Private (admin)
 */
router.get('/couriers', auth, isAdmin, asyncHandler(async (req, res) => {
  const couriers = await query(
    `SELECT u.id, u.phone, u.username, u.status, u.last_login_time,
            COUNT(o.id) as orderCount,
            SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) as deliveredCount
     FROM users u
     LEFT JOIN orders o ON u.id = o.courier_id
     WHERE u.role = 'courier'
     GROUP BY u.id
     ORDER BY deliveredCount DESC`
  );

  res.json({
    success: true,
    data: couriers.map(c => ({
      ...c,
      lastLoginTime: formatTime(c.last_login_time)
    }))
  });
}));

module.exports = router;
