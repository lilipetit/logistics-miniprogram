Page({
  data: {
    orderNumber: ''
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

    if (options.orderNumber) {
      this.setData({
        orderNumber: options.orderNumber
      });
    }
  },

  viewOrder() {
    wx.redirectTo({
      url: '/pages/send-package/send-package'
    });
  },

  backToHome() {
    wx.redirectTo({
      url: '/pages/send-package/send-package'
    });
  }
});
