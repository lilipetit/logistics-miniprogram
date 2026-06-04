// app.js
App({
  onLaunch() {
    // 初始化云开发
    this.initCloud();
    
    // 初始化存储数据
    this.initStorage();
  },

  initCloud() {
    // 初始化微信云开发
    wx.cloud.init({
      env: 'your-cloud-env-id', // ⚠️ 替换为您的云开发环境 ID
      traceUser: true
    });
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
    userInfo: null,
    isLogin: false
  }
})
