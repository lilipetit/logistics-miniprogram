/**
 * 打印路由
 * 处理快递面单打印、二维码生成等
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { auth, isCourier } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/error');
const { maskPhone, maskName, formatTime } = require('../utils/helpers');
const { generateCode128, generateQRCode } = require('../utils/barcode');

/**
 * @route   POST /api/print/label
 * @desc    生成快递面单数据（含脱敏处理）
 * @access  Private (courier, admin)
 */
router.post('/label', [
  auth,
  body('orderId').notEmpty().withMessage('订单ID不能为空')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { orderId } = req.body;

  // 查询订单
  const orders = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (orders.length === 0) {
    throw new ApiError(404, '订单不存在');
  }

  const order = orders[0];

  // 生成条码和二维码
  const barcode = await generateCode128(order.tracking_number, { height: 12, scale: 2 });
  const orderUrl = `https://logistics.example.com/track/${order.tracking_number}`;
  const qrcode = await generateQRCode(orderUrl, { width: 150 });

  // 脱敏处理
  const printData = {
    orderId: order.id,
    orderNumber: order.order_number,
    trackingNumber: order.tracking_number,
    
    // 寄件人信息（脱敏）
    sender: {
      name: maskName(order.sender_name),
      phone: maskPhone(order.sender_phone),
      address: order.sender_address
    },
    
    // 收件人信息（脱敏）
    receiver: {
      name: maskName(order.receiver_name),
      phone: maskPhone(order.receiver_phone),
      address: order.receiver_address
    },
    
    // 货品信息
    product: {
      count: order.product_count,
      weight: order.product_weight,
      type: order.product_type
    },
    remark: order.remark,
    
    // 时间和金额
    amount: parseFloat(order.amount).toFixed(2),
    createTime: formatTime(order.create_time),
    
    // 条码数据
    barcode,
    qrcode,
    barcodeData: order.tracking_number,
    qrcodeData: orderUrl
  };

  res.json({
    success: true,
    data: printData
  });
}));

/**
 * @route   POST /api/print/barcode
 * @desc    生成CODE128一维码
 * @access  Private
 */
router.post('/barcode', [
  auth,
  body('data').notEmpty().withMessage('数据不能为空')
], asyncHandler(async (req, res) => {
  const { data } = req.body;
  const { width = 2, height = 10 } = req.body;

  const barcode = await generateCode128(data, { width, height });

  res.json({
    success: true,
    data: {
      barcode,
      data
    }
  });
}));

/**
 * @route   POST /api/print/qrcode
 * @desc    生成QR二维码
 * @access  Private
 */
router.post('/qrcode', [
  auth,
  body('data').notEmpty().withMessage('数据不能为空')
], asyncHandler(async (req, res) => {
  const { data } = req.body;
  const { width = 200 } = req.body;

  const qrcode = await generateQRCode(data, { width });

  res.json({
    success: true,
    data: {
      qrcode,
      data
    }
  });
}));

/**
 * @route   POST /api/print/record
 * @desc    记录打印历史
 * @access  Private
 */
router.post('/record', [
  auth,
  body('orderId').notEmpty().withMessage('订单ID不能为空'),
  body('trackingNumber').notEmpty().withMessage('运单号不能为空')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, '输入验证失败', errors.array());
  }

  const { orderId, trackingNumber, orderNumber, printType = 'face_sheet', status = 1, errorMessage } = req.body;

  // 查询订单获取脱敏信息
  const orders = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (orders.length === 0) {
    throw new ApiError(404, '订单不存在');
  }

  const order = orders[0];

  // 生成条码数据
  const barcodeData = trackingNumber;
  const qrcodeData = `https://logistics.example.com/track/${trackingNumber}`;

  // 保存打印记录
  await query(
    `INSERT INTO print_records (
      order_id, tracking_number, order_number,
      sender_name_masked, sender_phone_masked, sender_address,
      receiver_name_masked, receiver_phone_masked, receiver_address,
      printer_model, print_type, barcode_data, qrcode_data,
      operator_id, operator_name, print_status, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId, trackingNumber, orderNumber,
      maskName(order.sender_name), maskPhone(order.sender_phone), order.sender_address,
      maskName(order.receiver_name), maskPhone(order.receiver_phone), order.receiver_address,
      'A300E', printType, barcodeData, qrcodeData,
      req.user.id, req.user.username, status, errorMessage
    ]
  );

  res.json({
    success: true,
    message: '打印记录已保存'
  });
}));

/**
 * @route   GET /api/print/records
 * @desc    获取打印记录列表
 * @access  Private (courier, admin)
 */
router.get('/records', auth, asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 20, orderId, trackingNumber } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  let whereClause = 'WHERE 1=1';
  const params = [];

  // 快递员只能查看自己的打印记录
  if (req.user.role === 'courier') {
    whereClause += ' AND operator_id = ?';
    params.push(req.user.id);
  }

  if (orderId) {
    whereClause += ' AND order_id = ?';
    params.push(orderId);
  }

  if (trackingNumber) {
    whereClause += ' AND tracking_number LIKE ?';
    params.push(`%${trackingNumber}%`);
  }

  const countResult = await query(
    `SELECT COUNT(*) as total FROM print_records ${whereClause}`,
    params
  );

  const records = await query(
    `SELECT * FROM print_records ${whereClause} ORDER BY print_time DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize), offset]
  );

  res.json({
    success: true,
    data: {
      list: records.map(r => ({
        ...r,
        printStatusLabel: r.print_status === 1 ? '成功' : '失败',
        printTime: formatTime(r.print_time)
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
 * @route   GET /api/print/template
 * @desc    获取打印模板配置
 * @access  Private
 */
router.get('/template', auth, asyncHandler(async (req, res) => {
  // 汉印A300E ESC/POS 打印模板配置
  const template = {
    printer: 'A300E',
    type: 'ESC/POS',
    pageWidth: 80, // 毫米
    pageHeight: 120,
    margin: 2,
    fontSize: {
      normal: 2,
      large: 3,
      title: 4
    },
    elements: [
      {
        type: 'logo',
        height: 8
      },
      {
        type: 'title',
        text: '快递运单',
        fontSize: 4,
        align: 'center'
      },
      {
        type: 'divider',
        style: 'dashed'
      },
      {
        type: 'barcode',
        data: '{{trackingNumber}}',
        height: 30,
        align: 'center'
      },
      {
        type: 'text',
        data: '{{trackingNumber}}',
        fontSize: 2,
        align: 'center'
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        title: '寄件人',
        fields: [
          { label: '姓名', data: '{{senderName}}' },
          { label: '电话', data: '{{senderPhone}}' },
          { label: '地址', data: '{{senderAddress}}' }
        ]
      },
      {
        type: 'section',
        title: '收件人',
        fields: [
          { label: '姓名', data: '{{receiverName}}' },
          { label: '电话', data: '{{receiverPhone}}' },
          { label: '地址', data: '{{receiverAddress}}' }
        ]
      },
      {
        type: 'qrcode',
        data: '{{orderUrl}}',
        size: 40,
        align: 'center'
      },
      {
        type: 'footer',
        text: '签名: ___________ 日期: {{date}}',
        fontSize: 2
      }
    ]
  };

  res.json({
    success: true,
    data: template
  });
}));

/**
 * @route   GET /api/print/records/:id
 * @desc    获取打印记录详情
 * @access  Private
 */
router.get('/records/:id', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const records = await query('SELECT * FROM print_records WHERE id = ?', [id]);
  if (records.length === 0) {
    throw new ApiError(404, '打印记录不存在');
  }

  res.json({
    success: true,
    data: {
      ...records[0],
      printStatusLabel: records[0].print_status === 1 ? '成功' : '失败',
      printTime: formatTime(records[0].print_time)
    }
  });
}));

module.exports = router;
