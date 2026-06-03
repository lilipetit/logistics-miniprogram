// utils/util.js

/**
 * 格式化时间
 */
const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

/**
 * 生成订单号
 */
const generateOrderNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `ORDER${dateStr}${random}`;
}

/**
 * 生成快递单号
 */
const generateTrackingNumber = () => {
  const prefix = 'XS';
  const timestamp = Date.now().toString().slice(-10);
  return `${prefix}${timestamp}`;
}

/**
 * 验证手机号
 */
const validatePhone = (phone) => {
  const reg = /^1[3-9]\d{9}$/;
  return reg.test(phone);
}

/**
 * 验证密码
 */
const validatePassword = (password) => {
  return password && password.length >= 6;
}

module.exports = {
  formatTime,
  formatNumber,
  generateOrderNumber,
  generateTrackingNumber,
  validatePhone,
  validatePassword
}
