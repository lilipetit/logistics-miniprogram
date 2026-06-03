const { generateTrackingNumber } = require('../../utils/util.js');

Page({
  data: {
    amount: '28.00',
    orderCode: 'FFB800',
    selectedMethod: 'wechat',
    isBatch: false,
    orderCount: 0
  },

  onLoad(options) {
    // 检查登录状态
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }

    if (options.fee) {
      this.setData({
        amount: parseFloat(options.fee).toFixed(2)
      });
    }

    // 检查是否是批量支付
    if (options.batch === 'true') {
      const orderIds = wx.getStorageSync('selectedOrderIds') || [];
      this.setData({
        isBatch: true,
        orderCount: orderIds.length,
        orderCode: `批量支付(${orderIds.length}单)`
      });
    } else {
      // 生成订单号
      const orderCode = 'ORDER' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      this.setData({
        orderCode: orderCode
      });
    }
  },

  _openPaymentQrcode(method) {
    const { amount, orderCode, isBatch, orderCount } = this.data;
    wx.setStorageSync('paymentContext', {
      amount,
      orderCode,
      isBatch: !!isBatch,
      orderCount: orderCount || 0,
      selectedMethod: method
    });
    wx.navigateTo({
      url: `/pages/payment-qrcode/payment-qrcode?method=${method}`
    });
  },

  selectPayment(e) {
    const method = e.currentTarget.dataset.method;
    // 选择微信/支付宝后，先跳转到对应支付界面展示二维码，再点确认支付执行真正付款
    if (method === 'wechat' || method === 'alipay') {
      this._openPaymentQrcode(method);
      return;
    }

    this.setData({ selectedMethod: method });
  },

  handlePayment() {
    const { amount, isBatch, selectedMethod } = this.data;
    // 仅选中微信/支付宝后点「确认支付」时也要进入收款码页（与点击列表行一致）
    if (selectedMethod === 'wechat' || selectedMethod === 'alipay') {
      this._openPaymentQrcode(selectedMethod);
      return;
    }

    const orders = wx.getStorageSync('orders') || [];
    
    if (isBatch) {
      // 批量支付
      const orderIds = wx.getStorageSync('selectedOrderIds') || [];
      if (orderIds.length === 0) {
        wx.showToast({
          title: '订单信息丢失',
          icon: 'none'
        });
        return;
      }

      // 更新所有选中订单的支付状态
      orderIds.forEach(orderId => {
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
          orders[orderIndex].paymentStatus = 'success';
          orders[orderIndex].paymentMethod = selectedMethod;
          orders[orderIndex].paymentTime = new Date().toISOString();
          orders[orderIndex].updateTime = new Date().toISOString();
        }
      });
      
      wx.setStorageSync('orders', orders);
      wx.removeStorageSync('selectedOrderIds');
      wx.removeStorageSync('batchPaymentAmount');

      wx.showToast({
        title: '支付成功',
        icon: 'success'
      });

      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/payment-success/payment-success?orderNumber=批量支付成功'
        });
      }, 1500);
    } else {
      // 单个订单支付（兼容旧逻辑）
      const orderInfo = wx.getStorageSync('currentOrder');
      
      if (!orderInfo) {
        wx.showToast({
          title: '订单信息丢失',
          icon: 'none'
        });
        return;
      }

      // 创建订单
      const userInfo = wx.getStorageSync('userInfo');
      const orderCode = 'ORDER' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      const newOrder = {
        id: Date.now().toString(),
        orderNumber: orderCode,
        trackingNumber: generateTrackingNumber(),
        userId: userInfo.id,
        userName: userInfo.username,
        ...orderInfo,
        amount: parseFloat(amount),
        status: 'pending',
        paymentStatus: 'success',
        paymentMethod: selectedMethod,
        paymentTime: new Date().toISOString(),
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString()
      };
      orders.push(newOrder);
      wx.setStorageSync('orders', orders);

      // 清除临时订单信息
      wx.removeStorageSync('currentOrder');

      // 跳转到支付成功页面
      wx.redirectTo({
        url: `/pages/payment-success/payment-success?orderNumber=${orderCode}`
      });
    }
  }
});
