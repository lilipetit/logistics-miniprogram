/**
 * 配件库存路由
 * 处理配件出入库、库存管理
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { auth, isCourier, isAdmin } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/error');
const { formatTime } = require('../utils/helpers');

/**
 * @route   GET /api/parts
 * @desc    获取配件列表
 * @access  Private
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const { keyword, partsType, status } = req.query;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (keyword) {
    whereClause += ' AND (parts_name LIKE ? OR parts_code LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  if (partsType) {
    whereClause += ' AND parts_type = ?';
    params.push(partsType);
  }

  if (status !== undefined) {
    whereClause += ' AND status = ?';
    params.push(parseInt(status));
  }

  const parts = await query(
    `SELECT * FROM parts_inventory ${whereClause} ORDER BY parts_type, parts_name`,
    params
  );

  res.json({
    success: true,
    data: parts.map(p => ({
      ...p,
      isLowStock: p.stock_quantity <= p.warning_quantity
    }))
  });
}));

/**
 * @route   GET /api/parts/:id
 * @desc    获取配件详情
 * @access  Private
 */
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const parts = await query('SELECT * FROM parts_inventory WHERE id = ?', [id]);
  if (parts.length === 0) {
    throw new ApiError(404, '配件不存在');
  }

  res.json({
    success: true,
    data: parts[0]
  });
}));

/**
 * @route   POST /api/parts
 * @desc    添加配件
 * @access  Private (admin)
 */
router.post('/', [
  auth, isAdmin,
  body('partsCode').notEmpty().withMessage('请输入配件编码'),
  body('partsName').notEmpty().withMessage('请输入配件名称'),
  body('stockQuantity').optional().isInt({ min: 0 }).withMessage('库存数量必须为非负整数'),
  body('warningQuantity').optional().isInt({ min: 0 }).withMessage('预警数量必须为非负整数')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { partsCode, partsName, partsType, unit, stockQuantity, warningQuantity, unitPrice, description } = req.body;

  const existing = await query('SELECT id FROM parts_inventory WHERE parts_code = ?', [partsCode]);
  if (existing.length > 0) {
    throw new ApiError(400, '该配件编码已存在');
  }

  const result = await query(
    `INSERT INTO parts_inventory 
     (parts_code, parts_name, parts_type, unit, stock_quantity, warning_quantity, unit_price, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [partsCode, partsName, partsType, unit || '个', stockQuantity || 0, warningQuantity || 10, unitPrice || 0, description]
  );

  res.json({
    success: true,
    message: '配件添加成功',
    data: { id: result.insertId }
  });
}));

/**
 * @route   POST /api/parts/stock/in
 * @desc    配件入库
 * @access  Private (courier, admin)
 */
router.post('/stock/in', [
  auth,
  body('partsId').isInt().withMessage('配件ID无效'),
  body('quantity').isInt({ min: 1 }).withMessage('入库数量必须大于0')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { partsId, quantity, orderId, trackingNumber, remark } = req.body;

  await transaction(async (conn) => {
    const [parts] = await conn.execute('SELECT * FROM parts_inventory WHERE id = ? AND status = 1', [partsId]);
    if (parts.length === 0) {
      throw new ApiError(404, '配件不存在或已禁用');
    }

    const part = parts[0];
    const beforeQuantity = part.stock_quantity;
    const afterQuantity = beforeQuantity + parseInt(quantity);

    await conn.execute(
      'UPDATE parts_inventory SET stock_quantity = ?, updated_at = NOW() WHERE id = ?',
      [afterQuantity, partsId]
    );

    await conn.execute(
      `INSERT INTO parts_stock_records 
       (parts_id, parts_code, parts_name, type, quantity, before_quantity, after_quantity, order_id, tracking_number, operator_id, operator_name, remark)
       VALUES (?, ?, ?, 'in', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [partsId, part.parts_code, part.parts_name, quantity, beforeQuantity, afterQuantity, orderId, trackingNumber, req.user.id, req.user.username, remark]
    );
  });

  res.json({
    success: true,
    message: '入库成功'
  });
}));

/**
 * @route   POST /api/parts/stock/out
 * @desc    配件出库（自动扣减库存）
 * @access  Private (courier, admin)
 */
router.post('/stock/out', [
  auth,
  body('partsId').isInt().withMessage('配件ID无效'),
  body('quantity').isInt({ min: 1 }).withMessage('出库数量必须大于0')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { partsId, quantity, orderId, trackingNumber, remark } = req.body;

  await transaction(async (conn) => {
    const [parts] = await conn.execute('SELECT * FROM parts_inventory WHERE id = ? AND status = 1 FOR UPDATE', [partsId]);
    if (parts.length === 0) {
      throw new ApiError(404, '配件不存在或已禁用');
    }

    const part = parts[0];
    const beforeQuantity = part.stock_quantity;
    const outQuantity = parseInt(quantity);

    if (beforeQuantity < outQuantity) {
      throw new ApiError(400, `库存不足，当前库存: ${beforeQuantity}`);
    }

    const afterQuantity = beforeQuantity - outQuantity;

    await conn.execute(
      'UPDATE parts_inventory SET stock_quantity = ?, updated_at = NOW() WHERE id = ?',
      [afterQuantity, partsId]
    );

    await conn.execute(
      `INSERT INTO parts_stock_records 
       (parts_id, parts_code, parts_name, type, quantity, before_quantity, after_quantity, order_id, tracking_number, operator_id, operator_name, remark)
       VALUES (?, ?, ?, 'out', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [partsId, part.parts_code, part.parts_name, outQuantity, beforeQuantity, afterQuantity, orderId, trackingNumber, req.user.id, req.user.username, remark || '订单使用']
    );
  });

  res.json({
    success: true,
    message: '出库成功，库存已自动扣减'
  });
}));

/**
 * @route   GET /api/parts/stock/records
 * @desc    获取库存变动记录
 * @access  Private (admin)
 */
router.get('/stock/records', auth, isAdmin, asyncHandler(async (req, res) => {
  const { partsId, type, page = 1, pageSize = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (partsId) {
    whereClause += ' AND parts_id = ?';
    params.push(partsId);
  }

  if (type) {
    whereClause += ' AND type = ?';
    params.push(type);
  }

  const countResult = await query(
    `SELECT COUNT(*) as total FROM parts_stock_records ${whereClause}`,
    params
  );

  const records = await query(
    `SELECT * FROM parts_stock_records ${whereClause} ORDER BY create_time DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize), offset]
  );

  res.json({
    success: true,
    data: {
      list: records.map(r => ({
        ...r,
        typeLabel: r.type === 'in' ? '入库' : '出库',
        createTime: formatTime(r.create_time)
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
 * @route   GET /api/parts/alerts
 * @desc    获取库存预警列表
 * @access  Private
 */
router.get('/stock/alerts', auth, asyncHandler(async (req, res) => {
  const alerts = await query(
    `SELECT * FROM parts_inventory 
     WHERE stock_quantity <= warning_quantity AND status = 1 
     ORDER BY (warning_quantity - stock_quantity) DESC`
  );

  res.json({
    success: true,
    data: alerts.map(a => ({
      ...a,
      deficit: a.warning_quantity - a.stock_quantity
    }))
  });
}));

module.exports = router;
