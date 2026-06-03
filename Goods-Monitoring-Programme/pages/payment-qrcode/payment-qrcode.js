const { generateTrackingNumber } = require('../../utils/util.js');

function orderStatusLabel(status) {
  const map = {
    pending: '待处理',
    received: '已接收',
    transit: '运输中',
    delivered: '已送达'
  };
  return map[status] || status || '未知';
}

function paymentStatusLabel(status) {
  const map = {
    pending: '待支付',
    success: '支付成功',
    failed: '支付失败'
  };
  return map[status] || '待支付';
}

const QR_WECHAT = '/images/WeiChatPayment.jpg';
const QR_ALIPAY = '/images/Alipay.jpg';

Page({
  data: {
    method: 'wechat',
    methodTitle: '微信支付',
    qrSrc: QR_WECHAT,
    amount: '0.00',
    orderCode: '',
    isBatch: false,
    orderCount: 0
  },

  onLoad(options) {
    const method = options && options.method ? options.method : 'wechat';
    const methodTitle = method === 'alipay' ? '支付宝支付' : '微信支付';
    const qrSrc = method === 'alipay' ? QR_ALIPAY : QR_WECHAT;

    const ctx = wx.getStorageSync('paymentContext') || {};

    const orderOk =
      ctx.orderCode !== undefined &&
      ctx.orderCode !== null &&
      String(ctx.orderCode).trim() !== '';
    const amountOk = ctx.amount !== undefined && ctx.amount !== null && String(ctx.amount).trim() !== '';

    // 如果上下文丢了，回到支付选择页
    if (!orderOk || !amountOk) {
      wx.showToast({ title: '支付信息丢失', icon: 'none' });
      setTimeout(() => wx.redirectTo({ url: '/pages/payment/payment' }), 800);
      return;
    }

    this.setData({
      method,
      methodTitle,
      qrSrc,
      amount: ctx.amount,
      orderCode: ctx.orderCode,
      isBatch: !!ctx.isBatch,
      orderCount: ctx.orderCount || 0
    });
  },

  onQrImageError() {
    wx.showToast({ title: '收款码图片加载失败', icon: 'none' });
  },

  confirmPayment() {
    const { method, isBatch } = this.data;
    const ctx = wx.getStorageSync('paymentContext') || {};
    const orders = wx.getStorageSync('orders') || [];

    if (isBatch) {
      const orderIds = wx.getStorageSync('selectedOrderIds') || [];
      if (orderIds.length === 0) {
        wx.showToast({ title: '订单信息丢失', icon: 'none' });
        return;
      }

      orderIds.forEach((orderId) => {
        const orderIndex = orders.findIndex((o) => o.id === orderId);
        if (orderIndex !== -1) {
          orders[orderIndex].paymentStatus = 'success';
          orders[orderIndex].paymentMethod = method;
          orders[orderIndex].paymentTime = new Date().toISOString();
          orders[orderIndex].updateTime = new Date().toISOString();
        }
      });

      wx.setStorageSync('orders', orders);
      wx.removeStorageSync('selectedOrderIds');
      wx.removeStorageSync('batchPaymentAmount');
    } else {
      const orderInfo = wx.getStorageSync('currentOrder');
      if (!orderInfo) {
        wx.showToast({ title: '订单信息丢失', icon: 'none' });
        return;
      }

      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }

      const newOrder = {
        id: Date.now().toString(),
        orderNumber: ctx.orderCode,
        trackingNumber: generateTrackingNumber(),
        userId: userInfo.id,
        userName: userInfo.username,
        ...orderInfo,
        amount: parseFloat(ctx.amount || 0),
        status: 'pending',
        paymentStatus: 'success',
        paymentMethod: method,
        paymentTime: new Date().toISOString(),
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString()
      };

      orders.push(newOrder);
      wx.setStorageSync('orders', orders);
      wx.removeStorageSync('currentOrder');
    }

    wx.removeStorageSync('paymentContext');

    wx.showToast({ title: '支付成功', icon: 'success' });
    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/payment-success/payment-success?orderNumber=' + (isBatch ? '批量支付成功' : ctx.orderCode)
      });
    }, 800);
  }
});

