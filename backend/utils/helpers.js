/**
 * 工具函数模块
 */
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

/**
 * 生成唯一ID
 */
function generateId(prefix = '') {
  return prefix + uuidv4().replace(/-/g, '').substring(0, 16);
}

/**
 * 生成订单号
 * 格式: ORDER + 日期(YYYYMMDD) + 3位随机数
 */
function generateOrderNumber() {
  const dateStr = moment().format('YYYYMMDD');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `ORDER${dateStr}${random}`;
}

/**
 * 生成运单号
 * 格式: XS + 10位时间戳
 */
function generateTrackingNumber() {
  const timestamp = Date.now().toString().slice(-10);
  return `XS${timestamp}`;
}

/**
 * 手机号脱敏
 * 格式: 138****1234
 */
function maskPhone(phone) {
  if (!phone || phone.length !== 11) return phone;
  return phone.substring(0, 3) + '****' + phone.substring(7);
}

/**
 * 姓名脱敏
 * 格式: 张*、张**
 */
function maskName(name) {
  if (!name) return name;
  const len = name.length;
  if (len <= 1) return name;
  if (len === 2) return name[0] + '*';
  return name[0] + '*'.repeat(len - 2) + name[len - 1];
}

/**
 * 地址脱敏
 * 保留省市区，隐藏详细地址
 */
function maskAddress(address) {
  if (!address || address.length < 10) return address;
  // 保留前6个字符和后4个字符
  return address.substring(0, 6) + '****' + address.substring(address.length - 4);
}

/**
 * 格式化时间
 */
function formatTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!date) return '';
  return moment(date).format(format);
}

/**
 * 格式化金额
 */
function formatMoney(amount) {
  return parseFloat(amount || 0).toFixed(2);
}

/**
 * 计算运费
 * 基础运费 + 重量费用 + 距离费用
 */
function calculateFreight(weight = 0, distance = 0, basePrice = 2.0) {
  const weightFee = weight > 1 ? (weight - 1) * 1.5 : 0; // 首重1kg，续重1.5元/kg
  const distanceFee = distance > 5 ? Math.ceil((distance - 5) / 5) * 0.5 : 0; // 5km内免费，超出每5km加0.5元
  return basePrice + weightFee + distanceFee;
}

/**
 * 分页参数处理
 */
function parsePagination(query) {
  const page = parseInt(query.page) || 1;
  const pageSize = parseInt(query.pageSize) || 10;
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

/**
 * 构建分页响应
 */
function buildPaginationResponse(data, total, page, pageSize) {
  return {
    list: data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
}

/**
 * 订单状态映射
 */
const ORDER_STATUS = {
  pending: '待处理',
  received: '已揽收',
  transit: '运输中',
  delivered: '已送达',
  cancelled: '已取消'
};

/**
 * 支付状态映射
 */
const PAYMENT_STATUS = {
  pending: '待支付',
  success: '支付成功',
  failed: '支付失败',
  refunded: '已退款'
};

/**
 * 用户角色映射
 */
const USER_ROLE = {
  user: '用户',
  courier: '快递员',
  admin: '管理员'
};

/**
 * 验证手机号
 */
function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 验证密码强度
 */
function validatePassword(password) {
  return password && password.length >= 6;
}

/**
 * 生成随机字符串
 */
function randomString(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateId,
  generateOrderNumber,
  generateTrackingNumber,
  maskPhone,
  maskName,
  maskAddress,
  formatTime,
  formatMoney,
  calculateFreight,
  parsePagination,
  buildPaginationResponse,
  ORDER_STATUS,
  PAYMENT_STATUS,
  USER_ROLE,
  validatePhone,
  validatePassword,
  randomString,
  delay
};
