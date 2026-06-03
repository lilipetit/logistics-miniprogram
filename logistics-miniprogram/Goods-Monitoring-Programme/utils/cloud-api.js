/**
 * 微信云开发 API 封装
 * 使用云函数调用后端接口
 */

// 初始化云开发
wx.cloud.init({
  env: 'your-cloud-env-id', // 替换为您的云开发环境 ID
  traceUser: true
})

/**
 * 调用云函数
 * @param {string} name 云函数名称
 * @param {object} data 传递的数据
 * @returns {Promise}
 */
function callFunction(name, data = {}) {
  return wx.cloud.callFunction({
    name: name,
    data: data
  }).then(res => {
    console.log(`[${name}] 调用成功:`, res)
    return res.result
  }).catch(err => {
    console.error(`[${name}] 调用失败:`, err)
    return { success: false, message: '网络错误', error: err }
  })
}

// ============ 用户相关 ============

/**
 * 用户注册
 */
function register(phone, password, role = 'user', name = '') {
  return callFunction('user-auth', {
    action: 'register',
    phone,
    password,
    role,
    name
  })
}

/**
 * 用户登录
 */
function login(phone, password) {
  return callFunction('user-login', {
    phone,
    password
  })
}

/**
 * 获取用户信息
 */
function getUserInfo() {
  const app = getApp()
  return app.globalData.userInfo
}

// ============ 订单相关 ============

/**
 * 创建订单
 */
function createOrder(orderData) {
  return callFunction('order', {
    action: 'create',
    ...orderData
  })
}

/**
 * 获取订单列表
 */
function getOrderList(status = '', page = 1, pageSize = 10) {
  return callFunction('order', {
    action: 'getList',
    status,
    page,
    pageSize
  })
}

/**
 * 通过运单号查询订单
 */
function getOrderByTrackingNo(trackingNo) {
  return callFunction('order', {
    action: 'getByTrackingNo',
    tracking_no: trackingNo
  })
}

/**
 * 更新订单状态
 */
function updateOrderStatus(orderId, status, location, description) {
  return callFunction('order', {
    action: 'updateStatus',
    order_id: orderId,
    status,
    location,
    description
  })
}

/**
 * 分配快递员
 */
function assignCourier(orderId, courierId, courierName) {
  return callFunction('order', {
    action: 'assignCourier',
    order_id: orderId,
    courier_id: courierId,
    courier_name: courierName
  })
}

// ============ 配件相关 ============

/**
 * 添加配件
 */
function addAccessory(data) {
  return callFunction('accessory', {
    action: 'add',
    ...data
  })
}

/**
 * 获取配件列表
 */
function getAccessoryList(page = 1, pageSize = 20) {
  return callFunction('accessory', {
    action: 'getList',
    page,
    pageSize
  })
}

/**
 * 更新配件库存
 */
function updateAccessoryStock(accessoryId, quantity, type, remark) {
  return callFunction('accessory', {
    action: 'updateStock',
    accessory_id: accessoryId,
    quantity,
    type, // in/out
    remark
  })
}

/**
 * 获取配件日志
 */
function getAccessoryLogs(accessoryId, page = 1, pageSize = 20) {
  return callFunction('accessory', {
    action: 'getLogs',
    accessory_id: accessoryId,
    page,
    pageSize
  })
}

// ============ 打印相关 ============

/**
 * 添加打印记录
 */
function addPrintLog(orderId, trackingNo, printerName, printType) {
  return callFunction('print-log', {
    action: 'add',
    order_id: orderId,
    tracking_no: trackingNo,
    printer_name: printerName,
    print_type: printType
  })
}

/**
 * 获取打印记录列表
 */
function getPrintLogList(orderId, page = 1, pageSize = 20) {
  return callFunction('print-log', {
    action: 'getList',
    order_id: orderId,
    page,
    pageSize
  })
}

// ============ 导出 ============

module.exports = {
  // 用户
  register,
  login,
  getUserInfo,

  // 订单
  createOrder,
  getOrderList,
  getOrderByTrackingNo,
  updateOrderStatus,
  assignCourier,

  // 配件
  addAccessory,
  getAccessoryList,
  updateAccessoryStock,
  getAccessoryLogs,

  // 打印
  addPrintLog,
  getPrintLogList,

  // 云函数调用
  callFunction
}
