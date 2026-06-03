const { copyToClipboard } = require('../../utils/clipboard.js');

Page({
  data: {
    packageList: []
  },

  onLoad() {
    this.loadPackageList();
  },

  onShow() {
    this.loadPackageList();
  },

  loadPackageList() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }

    const orders = wx.getStorageSync('orders') || [];
    const userPackages = orders.filter(order => order.userId === userInfo.id);
    
    this.setData({
      packageList: userPackages.map(pkg => ({
        id: pkg.id,
        trackingNumber: pkg.trackingNumber || pkg.id
      }))
    });
  },

  onCopyTracking(e) {
    copyToClipboard(e.currentTarget.dataset.text);
  },

  goToFillInfo() {
    wx.navigateTo({
      url: '/pages/fill-info/fill-info'
    });
  },

  viewPackageDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/update-status/update-status?id=${id}`
    });
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/my/my'
    });
  }
});
