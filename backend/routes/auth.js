/**
 * 认证路由
 * 处理登录、注册、Token刷新等
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error');
const { generateId, validatePhone, validatePassword, USER_ROLE } = require('../utils/helpers');

/**
 * @route   POST /api/auth/register
 * @desc    用户注册
 * @access  Public
 */
router.post('/register', [
  body('phone').isMobilePhone('zh-CN').withMessage('请输入正确的手机号'),
  body('username').isLength({ min: 2, max: 20 }).withMessage('用户名长度应为2-20个字符'),
  body('password').isLength({ min: 6 }).withMessage('密码长度至少6位'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('两次密码输入不一致');
    }
    return true;
  }),
  body('role').isIn(['user', 'courier', 'admin']).withMessage('角色类型无效')
], asyncHandler(async (req, res) => {
  // 验证输入
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { phone, username, password, role } = req.body;

  // 检查手机号是否已注册
  const existingUsers = await query('SELECT id FROM users WHERE phone = ?', [phone]);
  if (existingUsers.length > 0) {
    throw new ApiError(400, '该手机号已注册');
  }

  // 加密密码
  const hashedPassword = await bcrypt.hash(password, 10);

  // 创建用户
  const userId = generateId('u_');
  await query(
    `INSERT INTO users (id, phone, username, password, role, status) VALUES (?, ?, ?, ?, ?, 1)`,
    [userId, phone, username, hashedPassword, role]
  );

  res.json({
    success: true,
    message: '注册成功',
    data: {
      id: userId,
      phone,
      username,
      role,
      roleLabel: USER_ROLE[role]
    }
  });
}));

/**
 * @route   POST /api/auth/login
 * @desc    用户登录
 * @access  Public
 */
router.post('/login', [
  body('phone').isMobilePhone('zh-CN').withMessage('请输入正确的手机号'),
  body('password').notEmpty().withMessage('请输入密码')
], asyncHandler(async (req, res) => {
  // 验证输入
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { phone, password } = req.body;

  // 查找用户
  const users = await query('SELECT * FROM users WHERE phone = ? AND status = 1', [phone]);
  if (users.length === 0) {
    throw new ApiError(401, '手机号或密码错误');
  }

  const user = users[0];

  // 验证密码
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(401, '手机号或密码错误');
  }

  // 更新最后登录时间
  await query(
    'UPDATE users SET last_login_time = NOW(), last_login_ip = ? WHERE id = ?',
    [req.ip, user.id]
  );

  // 记录登录日志
  await query(
    `INSERT INTO login_logs (user_id, phone, role, login_ip, login_status) VALUES (?, ?, ?, ?, 1)`,
    [user.id, user.phone, user.role, req.ip]
  );

  // 生成JWT Token
  const token = jwt.sign(
    { id: user.id, phone: user.phone, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    success: true,
    message: '登录成功',
    data: {
      token,
      user: {
        id: user.id,
        phone: user.phone,
        username: user.username,
        role: user.role,
        roleLabel: USER_ROLE[user.role],
        avatar: user.avatar
      }
    }
  });
}));

/**
 * @route   GET /api/auth/me
 * @desc    获取当前用户信息
 * @access  Private
 */
router.get('/me', require('../middleware/auth').auth, asyncHandler(async (req, res) => {
  const users = await query('SELECT id, phone, username, role, avatar, status, created_at FROM users WHERE id = ?', [req.user.id]);
  
  if (users.length === 0) {
    throw new ApiError(404, '用户不存在');
  }

  const user = users[0];
  user.roleLabel = USER_ROLE[user.role];

  res.json({
    success: true,
    data: user
  });
}));

/**
 * @route   POST /api/auth/logout
 * @desc    用户登出
 * @access  Private
 */
router.post('/logout', require('../middleware/auth').auth, asyncHandler(async (req, res) => {
  // 可以在这里处理Token黑名单等逻辑
  res.json({
    success: true,
    message: '登出成功'
  });
}));

/**
 * @route   POST /api/auth/refresh
 * @desc    刷新Token
 * @access  Private
 */
router.post('/refresh', require('../middleware/auth').auth, asyncHandler(async (req, res) => {
  const token = jwt.sign(
    { id: req.user.id, phone: req.user.phone, username: req.user.username, role: req.user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    success: true,
    data: { token }
  });
}));

/**
 * @route   PUT /api/auth/password
 * @desc    修改密码
 * @access  Private
 */
router.put('/password', [
  require('../middleware/auth').auth,
  body('oldPassword').notEmpty().withMessage('请输入原密码'),
  body('newPassword').isLength({ min: 6 }).withMessage('新密码长度至少6位')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { oldPassword, newPassword } = req.body;

  // 获取用户
  const users = await query('SELECT password FROM users WHERE id = ?', [req.user.id]);
  if (users.length === 0) {
    throw new ApiError(404, '用户不存在');
  }

  // 验证原密码
  const isMatch = await bcrypt.compare(oldPassword, users[0].password);
  if (!isMatch) {
    throw new ApiError(400, '原密码错误');
  }

  // 更新密码
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, req.user.id]);

  res.json({
    success: true,
    message: '密码修改成功'
  });
}));

module.exports = router;
