/**
 * 用户路由
 * 处理用户信息管理
 */
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { auth } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/error');
const { maskPhone, formatTime, USER_ROLE } = require('../utils/helpers');

/**
 * @route   GET /api/users/profile
 * @desc    获取个人资料
 * @access  Private
 */
router.get('/profile', auth, asyncHandler(async (req, res) => {
  const users = await query(
    'SELECT id, phone, username, role, avatar, status, last_login_time, created_at FROM users WHERE id = ?',
    [req.user.id]
  );

  if (users.length === 0) {
    throw new ApiError(404, '用户不存在');
  }

  const user = users[0];
  user.roleLabel = USER_ROLE[user.role];
  user.lastLoginTime = formatTime(user.last_login_time);
  user.createdAt = formatTime(user.created_at);
  delete user.password;

  res.json({
    success: true,
    data: user
  });
}));

/**
 * @route   PUT /api/users/profile
 * @desc    更新个人资料
 * @access  Private
 */
router.put('/profile', auth, asyncHandler(async (req, res) => {
  const { username, avatar } = req.body;

  const updates = [];
  const params = [];

  if (username) {
    updates.push('username = ?');
    params.push(username);
  }

  if (avatar !== undefined) {
    updates.push('avatar = ?');
    params.push(avatar);
  }

  if (updates.length === 0) {
    throw new ApiError(400, '没有要更新的字段');
  }

  params.push(req.user.id);
  await query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);

  res.json({
    success: true,
    message: '资料更新成功'
  });
}));

/**
 * @route   GET /api/users/history
 * @desc    获取历史联系人列表
 * @access  Private
 */
router.get('/history', auth, asyncHandler(async (req, res) => {
  const { type } = req.query;

  let whereClause = 'WHERE user_id = ?';
  const params = [req.user.id];

  if (type) {
    whereClause += ' AND type = ?';
    params.push(type);
  }

  const contacts = await query(
    `SELECT * FROM history_contacts ${whereClause} ORDER BY last_use_time DESC`,
    params
  );

  res.json({
    success: true,
    data: contacts.map(c => ({
      ...c,
      typeLabel: c.type === 'sender' ? '寄件人' : '收件人',
      lastUseTime: formatTime(c.last_use_time)
    }))
  });
}));

/**
 * @route   DELETE /api/users/history/:id
 * @desc    删除历史联系人
 * @access  Private
 */
router.delete('/history/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await query(
    'DELETE FROM history_contacts WHERE id = ? AND user_id = ?',
    [id, req.user.id]
  );

  if (result.affectedRows === 0) {
    throw new ApiError(404, '记录不存在');
  }

  res.json({
    success: true,
    message: '已删除'
  });
}));

module.exports = router;
