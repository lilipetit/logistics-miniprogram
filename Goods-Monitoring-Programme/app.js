// app.js
App({
  onLaunch() {
    // 初始化存储数据
    this.initStorage();
  },

  initStorage() {
    // 初始化用户数据（如果不存在）
    if (!wx.getStorageSync('users')) {
      wx.setStorageSync('users', []);
    }
    
    // 初始化订单数据（如果不存在）
    if (!wx.getStorageSync('orders')) {
      wx.setStorageSync('orders', []);
    }
  },

  globalData: {
    userInfo: null
  }
})
